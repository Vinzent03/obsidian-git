import { Notice, normalizePath } from "obsidian";
import type ObsidianGit from "../../main";
import type {
    Blame,
    BranchInfo,
    DiffFile,
    FileStatusResult,
    LogEntry,
    Status,
    UnstagedFile,
    WalkDifference,
} from "../../types";
import { GitOperation, NoNetworkError, UserCanceledError } from "../../types";
import { GeneralModal } from "../../ui/modals/generalModal";
import { splitRemoteBranch } from "../../utils";
import { GitManager } from "../gitManager";
import { HttpStatusError, WasmGitHttpBridge } from "./httpBridge";
import { Lg2 } from "./lg2";
import type { ParsedCommitObject } from "./parsers";
import {
    applyUnifiedPatch,
    extractFileDiff,
    extractPatchPath,
    parseBlame,
    parseCommitObject,
    parseForEachRef,
    parseLog,
    parseLsRemote,
    parseNameStatus,
    parseRemoteVerbose,
    parseStatus,
    removeConfigKey,
    resolveConflictMarkers,
    splitCommandLine,
    toPorcelainBlame,
} from "./parsers";
import type { MirrorAdapter } from "./vaultMirror";
import { VaultMirror } from "./vaultMirror";

const MEM_ROOT = "/repo";
const MEM_GITDIR = `${MEM_ROOT}/.git`;
/** Maximum number of paths passed to a single lg2 invocation. */
const PATH_BATCH_SIZE = 50;

/**
 * Sole Git backend for desktop and mobile, powered by wasm-git (libgit2
 * compiled to WebAssembly).
 *
 * The engine runs against an in-memory filesystem that is kept in sync with
 * the vault by {@link VaultMirror}: the working tree is re-synced from the
 * vault before every operation, and both the working tree and the `.git`
 * directory are persisted back to the vault after mutating operations.
 * Commands are serialized through {@link Lg2}'s mutex on the plugin thread
 * because Obsidian's adapter and `requestUrl` are main-thread APIs.
 * Remote access goes through {@link WasmGitHttpBridge} on top of Obsidian's
 * `requestUrl`, so HTTPS remotes work without CORS restrictions.
 */
export class WasmGit extends GitManager {
    private readonly httpBridge = new WasmGitHttpBridge();
    private readonly lg2 = new Lg2(this.httpBridge);
    private worktreeMirror: VaultMirror | undefined;
    private gitDirMirror: VaultMirror | undefined;
    private gitDirLoaded = false;
    private readonly noticeLength = 999_999;

    constructor(plugin: ObsidianGit) {
        super(plugin);
        this.httpBridge.getAuthHeader = () => {
            const username = this.plugin.localStorage.getUsername();
            const password = this.plugin.localStorage.getPassword();
            if (!username || !password) return undefined;
            return "Basic " + btoa(`${username}:${password}`);
        };
    }

    // ------------------------------------------------------------------
    // Setup and synchronization plumbing
    // ------------------------------------------------------------------

    private get adapter(): MirrorAdapter {
        return this.app.vault.adapter;
    }

    private getGitDirVaultPath(): string {
        return normalizePath(
            this.getRelativeVaultPath(this.plugin.settings.gitDir || ".git")
        );
    }

    private buildMirrors(): void {
        const basePath = this.plugin.settings.basePath;
        const gitDirVaultPath = this.getGitDirVaultPath();
        const gitDirInsideWorktree =
            basePath === ""
                ? gitDirVaultPath
                : gitDirVaultPath.startsWith(basePath + "/")
                  ? gitDirVaultPath.substring(basePath.length + 1)
                  : undefined;
        this.worktreeMirror = new VaultMirror(
            this.adapter,
            this.lg2.fs,
            basePath,
            MEM_ROOT,
            (relativePath) =>
                gitDirInsideWorktree != undefined &&
                (relativePath === gitDirInsideWorktree ||
                    relativePath.startsWith(gitDirInsideWorktree + "/"))
        );
        this.gitDirMirror = new VaultMirror(
            this.adapter,
            this.lg2.fs,
            gitDirVaultPath,
            MEM_GITDIR
        );
        this.gitDirLoaded = false;
    }

    private async ensureReady(): Promise<void> {
        if (!this.lg2.initialized) {
            await this.lg2.init();
        }
        if (!this.worktreeMirror || !this.gitDirMirror) {
            this.buildMirrors();
        }
        if (!this.gitDirLoaded) {
            // The .git directory is loaded once per session and treated as
            // owned by this engine afterwards; only git itself modifies it.
            await this.gitDirMirror!.syncIn();
            this.gitDirLoaded = true;
            await this.normalizeRepoConfig();
        }
    }

    /**
     * Repositories created by native git on desktop record
     * `core.filemode = true`. The in-memory filesystem reports one fixed mode
     * for every file, which would make all tracked files appear modified, so
     * the flag is forced off once per session.
     */
    private async normalizeRepoConfig(): Promise<void> {
        const configPath = `${MEM_GITDIR}/config`;
        if (!this.lg2.fs.analyzePath(configPath).exists) return;
        const content = this.lg2.fs.readFile(configPath, {
            encoding: "utf8",
        });
        const normalized = content.replace(
            /^(\s*filemode\s*=\s*)true\s*$/im,
            "$1false"
        );
        if (normalized !== content) {
            this.lg2.fs.writeFile(configPath, normalized);
            await this.gitDirMirror!.syncOut();
        }
    }

    private async syncIn(): Promise<void> {
        await this.ensureReady();
        await this.worktreeMirror!.syncIn();
    }

    private async syncOut(): Promise<void> {
        await this.worktreeMirror!.syncOut();
        await this.gitDirMirror!.syncOut();
    }

    /** Runs a read-only command against the current vault state. */
    private async read(
        args: string[],
        opts?: { ignoreErrors?: boolean }
    ): Promise<{ stdout: string; stderr: string }> {
        await this.syncIn();
        return this.lg2.run(MEM_ROOT, args, opts);
    }

    /**
     * Runs a mutating command and persists the in-memory changes back to the
     * vault, including when the command fails, so the vault never diverges
     * from what git already wrote (e.g. partial merges).
     */
    private async mutate(
        args: string[],
        opts?: {
            ignoreErrors?: boolean;
            onProgress?: (line: string) => void;
        }
    ): Promise<{ stdout: string; stderr: string }> {
        await this.syncIn();
        try {
            return await this.lg2.run(MEM_ROOT, args, opts);
        } finally {
            await this.syncOut();
        }
    }

    /**
     * Retries `fn` once with freshly prompted credentials when the remote
     * rejects the current ones, mirroring the isomorphic-git behavior.
     */
    private async withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (!(error instanceof HttpStatusError) || !error.isAuthFailure) {
                throw error;
            }
            new Notice(
                "Authentication failed. Please try with different credentials"
            );
            const username = await new GeneralModal(this.plugin, {
                placeholder: "Specify your username",
            }).openAndGetResult();
            if (username) {
                const password = await new GeneralModal(this.plugin, {
                    placeholder: "Specify your password/personal access token",
                    obscure: true,
                }).openAndGetResult();
                if (password) {
                    this.plugin.localStorage.setUsername(username);
                    this.plugin.localStorage.setPassword(password);
                    return await fn();
                }
            }
            throw new UserCanceledError();
        }
    }

    // ------------------------------------------------------------------
    // Status
    // ------------------------------------------------------------------

    async status(opts?: { path?: string }): Promise<Status> {
        let notice: Notice | undefined;
        const timeout = window.setTimeout(() => {
            notice = new Notice(
                "This takes longer: Getting status",
                this.noticeLength
            );
        }, 20000);
        try {
            const result = await this.read(["status", "-s", "-b", "-uall"]);
            const parsed = parseStatus(result.stdout);

            const all: FileStatusResult[] = [];
            const changed: FileStatusResult[] = [];
            const staged: FileStatusResult[] = [];
            for (const file of parsed.files) {
                if (
                    opts?.path != undefined &&
                    !file.path.startsWith(`${opts.path}/`) &&
                    file.path !== opts.path
                ) {
                    continue;
                }
                const entry: FileStatusResult = {
                    index: file.index === "?" ? "U" : file.index,
                    workingDir: file.workingDir === "?" ? "U" : file.workingDir,
                    path: file.path,
                    from: file.from,
                    vaultPath: this.getRelativeVaultPath(file.path),
                };
                if (entry.workingDir !== " ") changed.push(entry);
                if (entry.index !== " " && entry.index !== "U")
                    staged.push(entry);
                if (entry.index !== " " || entry.workingDir !== " ")
                    all.push(entry);
            }
            window.clearTimeout(timeout);
            notice?.hide();
            return { all, changed, staged, conflicted: parsed.conflicted };
        } catch (error) {
            window.clearTimeout(timeout);
            notice?.hide();
            this.plugin.displayError(error);
            throw error;
        }
    }

    async getStagedFiles(
        dir = "."
    ): Promise<{ vaultPath: string; path: string }[]> {
        const status = await this.status(
            dir === "." ? undefined : { path: dir }
        );
        return status.staged.map(({ path, vaultPath }) => ({
            path,
            vaultPath,
        }));
    }

    async getUnstagedFiles(dir = "."): Promise<UnstagedFile[]> {
        const status = await this.status(
            dir === "." ? undefined : { path: dir }
        );
        return status.changed.map((file) => ({
            path: file.path,
            type:
                file.workingDir === "D"
                    ? "D"
                    : file.workingDir === "U"
                      ? "A"
                      : "M",
        }));
    }

    async getUntrackedPaths(opts?: {
        path?: string;
        status?: Status;
    }): Promise<string[]> {
        // Deliberately without -uall: directories that only contain
        // untracked files are collapsed to `dir/`, matching native git and
        // allowing efficient recursive deletion.
        const result = await this.read(["status", "-s"]);
        const untracked: string[] = [];
        for (const file of parseStatus(result.stdout).files) {
            if (file.index !== "?" || file.workingDir !== "?") continue;
            if (
                opts?.path != undefined &&
                !file.path.startsWith(`${opts.path}/`)
            ) {
                continue;
            }
            untracked.push(file.path);
        }
        return untracked;
    }

    // ------------------------------------------------------------------
    // Staging
    // ------------------------------------------------------------------

    async stage(filepath: string, relativeToVault: boolean): Promise<void> {
        try {
            const gitPath = this.getRelativeRepoPath(filepath, relativeToVault);
            // lg2's `add` uses git_index_add_all and therefore also stages
            // deletions, like `git add -A`.
            await this.mutate(["add", gitPath]);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async stageAll({
        dir,
        status,
    }: {
        dir?: string;
        status?: Status;
    }): Promise<void> {
        try {
            if (status) {
                const paths = status.changed.map((file) => file.path);
                await this.addPaths(paths);
            } else if (dir != undefined && dir !== ".") {
                await this.mutate(["add", `${dir}/*`, dir]);
            } else {
                await this.mutate(["add", "."]);
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    private async addPaths(paths: string[]): Promise<void> {
        for (let i = 0; i < paths.length; i += PATH_BATCH_SIZE) {
            const batch = paths.slice(i, i + PATH_BATCH_SIZE);
            if (batch.length > 0) {
                await this.mutate(["add", ...batch]);
            }
        }
    }

    async unstage(filepath: string, relativeToVault: boolean): Promise<void> {
        try {
            const gitPath = this.getRelativeRepoPath(filepath, relativeToVault);
            await this.unstagePaths((path) => path === gitPath);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async unstageAll({
        dir,
    }: {
        dir?: string;
        status?: Status;
    }): Promise<void> {
        try {
            if (dir == undefined || dir === ".") {
                await this.resetIndexToHead();
            } else {
                await this.unstagePaths(
                    (path) => path === dir || path.startsWith(`${dir}/`)
                );
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    /**
     * lg2's `reset` cannot operate on individual paths, so per-path
     * unstaging resets the whole index to HEAD and re-stages everything that
     * should stay staged. Because Obsidian's UI only ever stages whole files
     * from the working tree, re-adding from the working tree is equivalent.
     */
    private async unstagePaths(
        shouldUnstage: (path: string) => boolean
    ): Promise<void> {
        const status = await this.status();
        const keepStaged = status.staged
            .map((file) => file.path)
            .filter((path) => !shouldUnstage(path));
        await this.resetIndexToHead();
        await this.addPaths(keepStaged);
    }

    private async resetIndexToHead(): Promise<void> {
        if (await this.headExists()) {
            await this.mutate(["reset", "HEAD"]);
        } else {
            // Unborn HEAD: there is no commit to reset to, so clearing the
            // index file empties the staging area instead.
            await this.ensureReady();
            const indexPath = `${MEM_GITDIR}/index`;
            if (this.lg2.fs.analyzePath(indexPath).exists) {
                this.lg2.fs.unlink(indexPath);
                await this.syncOut();
            }
        }
    }

    private async headExists(): Promise<boolean> {
        const result = await this.read(["rev-parse", "HEAD"], {
            ignoreErrors: true,
        });
        return /^[0-9a-f]{40}$/m.test(result.stdout);
    }

    async discard(filepath: string): Promise<void> {
        try {
            await this.mutate(["checkout", "--", filepath]);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async discardAll({
        dir,
        status,
    }: {
        dir?: string;
        status?: Status;
    }): Promise<void> {
        try {
            const currentStatus = status ?? (await this.status());
            const files = currentStatus.changed
                .filter(
                    (file) =>
                        file.workingDir !== "U" &&
                        (dir == undefined || file.path.startsWith(dir))
                )
                .map((file) => file.path);
            for (let i = 0; i < files.length; i += PATH_BATCH_SIZE) {
                const batch = files.slice(i, i + PATH_BATCH_SIZE);
                if (batch.length > 0) {
                    await this.mutate(["checkout", "--", ...batch]);
                }
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    // ------------------------------------------------------------------
    // Committing
    // ------------------------------------------------------------------

    async commitAll({
        message,
        amend,
    }: {
        message: string;
        status?: Status;
        unstagedFiles?: UnstagedFile[];
        amend?: boolean;
    }): Promise<number | undefined> {
        try {
            await this.checkAuthorInfo();
            await this.stageAll({});
            return await this.commit({ message, amend });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async commit({
        message,
        amend,
    }: {
        message: string;
        amend?: boolean;
    }): Promise<number | undefined> {
        return this.withGitOperation(GitOperation.commit, async () => {
            try {
                await this.checkAuthorInfo();
                const formattedMessage =
                    await this.formatCommitMessage(message);
                const status = await this.status();
                const mergeInProgress = this.lg2.fs.analyzePath(
                    `${MEM_GITDIR}/MERGE_HEAD`
                ).exists;
                if (status.staged.length === 0 && !mergeInProgress && !amend) {
                    // lg2's commit would happily create an empty commit.
                    return 0;
                }
                if (amend) {
                    const parentExists = await this.read(
                        ["rev-parse", "HEAD~1"],
                        { ignoreErrors: true }
                    );
                    if (!/^[0-9a-f]{40}$/m.test(parentExists.stdout)) {
                        throw new Error(
                            "Amending the initial commit is not supported with the wasm-git engine."
                        );
                    }
                    await this.mutate(["reset", "--soft", "HEAD~1"]);
                }
                await this.mutate(["commit", "-m", formattedMessage]);
                if (mergeInProgress) {
                    this.plugin.localStorage.setConflict(false);
                }
                return status.staged.length;
            } catch (error) {
                this.plugin.displayError(error);
                throw error;
            }
        });
    }

    private async checkAuthorInfo(): Promise<void> {
        const name = await this.getConfig("user.name");
        const email = await this.getConfig("user.email");
        if (!name || !email) {
            throw Error(
                "Git author name and email are not set. Please set both fields in the settings."
            );
        }
    }

    // ------------------------------------------------------------------
    // Remote operations
    // ------------------------------------------------------------------

    async pull(): Promise<FileStatusResult[] | undefined> {
        const progressNotice = this.showNotice("Initializing pull");
        return this.withGitOperation(GitOperation.pull, async () => {
            try {
                await this.checkAuthorInfo();
                const localCommit = await this.revParse("HEAD");
                await this.fetchInternal(undefined, progressNotice);
                const branchInfo = await this.branchInfo();
                if (!branchInfo.tracking) {
                    throw new Error(
                        "No upstream branch is set. Please set one in the settings or via the 'Edit remotes' command."
                    );
                }

                const mergeResult = await this.withAuthRetry(() =>
                    this.mutate(["merge", branchInfo.tracking!], {
                        ignoreErrors: true,
                    })
                );
                const conflicted = this.parseMergeConflicts(mergeResult.stderr);
                if (conflicted.length > 0) {
                    await this.handleMergeConflicts(conflicted, branchInfo);
                } else if (/Bad news:|\s\[-?\d+\]/m.test(mergeResult.stderr)) {
                    throw new Error(
                        `Merge failed: ${mergeResult.stderr.trim()}`
                    );
                }

                progressNotice?.hide();
                const upstreamCommit = await this.revParse("HEAD");
                const changedFiles =
                    localCommit && upstreamCommit
                        ? await this.getFileChangesCount(
                              localCommit,
                              upstreamCommit
                          )
                        : [];
                this.showNotice("Finished pull", false);
                return changedFiles.map<FileStatusResult>((file) => ({
                    path: file.path,
                    workingDir: "P",
                    index: "P",
                    vaultPath: this.getRelativeVaultPath(file.path),
                }));
            } catch (error) {
                progressNotice?.hide();
                this.plugin.displayError(error);
                throw error;
            }
        });
    }

    private parseMergeConflicts(stderr: string): string[] {
        const conflicted: string[] = [];
        for (const line of stderr.split("\n")) {
            const match = line.match(/^conflict: a:(.*) o:(.*) t:(.*)$/);
            if (!match) continue;
            const path = [match[2], match[3], match[1]].find(
                (candidate) => candidate && candidate !== "NULL"
            );
            if (path && !conflicted.includes(path)) {
                conflicted.push(path);
            }
        }
        return conflicted;
    }

    /**
     * Applies the configured merge strategy to conflicted files. Files with
     * standard conflict markers are auto-resolved for the "ours"/"theirs"
     * strategies; everything else is handed to the user like on desktop.
     */
    private async handleMergeConflicts(
        conflicted: string[],
        branchInfo: BranchInfo
    ): Promise<void> {
        const strategy = this.plugin.settings.mergeStrategy;
        if (strategy !== "none") {
            const unresolved: string[] = [];
            for (const path of conflicted) {
                const memPath = `${MEM_ROOT}/${path}`;
                if (!this.lg2.fs.analyzePath(memPath).exists) {
                    unresolved.push(path);
                    continue;
                }
                const content = this.lg2.fs.readFile(memPath, {
                    encoding: "utf8",
                });
                const resolved = resolveConflictMarkers(content, strategy);
                if (resolved == undefined) {
                    unresolved.push(path);
                    continue;
                }
                this.lg2.fs.writeFile(memPath, resolved);
            }
            if (unresolved.length === 0) {
                await this.addPaths(conflicted);
                await this.mutate([
                    "commit",
                    "-m",
                    `Merge branch '${branchInfo.tracking}'`,
                ]);
                return;
            }
        }
        await this.syncOut();
        this.plugin.localStorage.setConflict(true);
        await this.plugin.handleConflict(
            conflicted.map((path) => this.getRelativeVaultPath(path))
        );
        throw new Error(
            `You have conflicts in ${conflicted.length} ${
                conflicted.length === 1 ? "file" : "files"
            }`
        );
    }

    async push(): Promise<number | undefined | null> {
        if (!(await this.canPush())) {
            return 0;
        }
        const progressNotice = this.showNotice("Initializing push");
        return this.withGitOperation(GitOperation.push, async () => {
            try {
                const branchInfo = await this.branchInfo();
                const remote = await this.getCurrentRemote();
                if (remote !== "origin") {
                    throw new Error(
                        "The wasm-git engine can only push to the 'origin' remote."
                    );
                }
                let numChangedFiles = 0;
                if (branchInfo.current && branchInfo.tracking) {
                    const trackingOid = await this.revParse(
                        branchInfo.tracking
                    );
                    if (trackingOid) {
                        numChangedFiles = (
                            await this.getFileChangesCount(
                                branchInfo.current,
                                branchInfo.tracking
                            )
                        ).length;
                    }
                }
                await this.withAuthRetry(() => this.mutate(["push"]));
                if (branchInfo.current && !branchInfo.tracking) {
                    // lg2's push always pushes the current branch to the
                    // same-named branch on origin; record that as upstream.
                    await this.setConfig(
                        `branch.${branchInfo.current}.remote`,
                        "origin"
                    );
                    await this.setConfig(
                        `branch.${branchInfo.current}.merge`,
                        `refs/heads/${branchInfo.current}`
                    );
                }
                progressNotice?.hide();
                return numChangedFiles;
            } catch (error) {
                progressNotice?.hide();
                if (!(error instanceof NoNetworkError)) {
                    this.plugin.displayError(error);
                }
                throw error;
            }
        });
    }

    async fetch(remote?: string): Promise<void> {
        const progressNotice = this.showNotice("Initializing fetch");
        try {
            await this.fetchInternal(remote, progressNotice);
            progressNotice?.hide();
        } catch (error) {
            progressNotice?.hide();
            this.plugin.displayError(error);
            throw error;
        }
    }

    private async fetchInternal(
        remote: string | undefined,
        progressNotice: Notice | undefined
    ): Promise<void> {
        const remoteName = remote ?? (await this.getCurrentRemote());
        await this.withAuthRetry(() =>
            this.mutate(["fetch", remoteName], {
                onProgress: (line) => {
                    if (
                        progressNotice &&
                        (line.startsWith("Received") ||
                            line.startsWith("remote:"))
                    ) {
                        progressNotice.setMessage(`Fetching: ${line}`);
                    }
                },
            })
        );
    }

    async getUnpushedCommits(): Promise<number> {
        const branchInfo = await this.branchInfo();
        if (!branchInfo.current || !branchInfo.tracking) {
            return 0;
        }
        const result = await this.read(
            ["rev-list", `${branchInfo.tracking}..HEAD`],
            { ignoreErrors: true }
        );
        return result.stdout
            .split("\n")
            .filter((line) => /^[0-9a-f]{40}$/.test(line)).length;
    }

    async canPush(): Promise<boolean> {
        const branchInfo = await this.branchInfo();
        if (!branchInfo.current) return false;
        const current = await this.revParse(branchInfo.current);
        if (!current) return false;
        if (!branchInfo.tracking) return true;
        const tracking = await this.revParse(branchInfo.tracking);
        if (!tracking) return true;
        return current !== tracking;
    }

    // ------------------------------------------------------------------
    // Repository and branches
    // ------------------------------------------------------------------

    async checkRequirements(): Promise<"valid" | "missing-repo"> {
        const headExists = await this.adapter.exists(
            normalizePath(`${this.getGitDirVaultPath()}/HEAD`)
        );
        return headExists ? "valid" : "missing-repo";
    }

    async branchInfo(): Promise<BranchInfo & { remote: string }> {
        try {
            await this.ensureReady();
            let current: string | undefined;
            const headPath = `${MEM_GITDIR}/HEAD`;
            if (this.lg2.fs.analyzePath(headPath).exists) {
                const head = this.lg2.fs
                    .readFile(headPath, { encoding: "utf8" })
                    .trim();
                const symref = head.match(/^ref: refs\/heads\/(.*)$/);
                current = symref ? symref[1] : undefined;
            }

            const refs = await this.read(["for-each-ref"], {
                ignoreErrors: true,
            });
            const branches = parseForEachRef(refs.stdout)
                .filter((ref) => ref.refName.startsWith("refs/heads/"))
                .map((ref) => ref.refName.substring("refs/heads/".length));

            let tracking: string | undefined;
            let remote = "origin";
            if (current) {
                remote =
                    (await this.getConfig(`branch.${current}.remote`)) ??
                    "origin";
                const mergeRef = await this.getConfig(
                    `branch.${current}.merge`
                );
                const trackingBranch = mergeRef?.split("refs/heads/")[1];
                tracking = trackingBranch
                    ? `${remote}/${trackingBranch}`
                    : undefined;
            }
            return { current, tracking, branches, remote };
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async getCurrentRemote(): Promise<string> {
        const branchInfo = await this.branchInfo();
        return branchInfo.remote;
    }

    async checkout(branch: string, remote?: string): Promise<void> {
        try {
            const args = ["checkout"];
            if (remote) args.push("--force");
            args.push(remote ? `${remote}/${branch}` : branch);
            await this.mutate(args);
            if (remote) {
                // Checking out `remote/branch` leaves a local branch behind;
                // make sure HEAD points at the plain branch name.
                await this.mutate(["checkout", branch]);
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async createBranch(branch: string): Promise<void> {
        try {
            await this.mutate(["checkout", "-b", branch]);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async deleteBranch(branch: string, force: boolean): Promise<void> {
        try {
            await this.ensureReady();
            const branchInfo = await this.branchInfo();
            if (branchInfo.current === branch) {
                throw new Error(
                    `Cannot delete branch '${branch}' while it is checked out.`
                );
            }
            if (!branchInfo.branches.includes(branch)) {
                throw new Error(`Branch '${branch}' not found.`);
            }
            if (!force && !(await this.branchIsMerged(branch))) {
                throw new Error(
                    `The branch '${branch}' is not fully merged. Use force delete to delete it anyway.`
                );
            }
            // lg2 has no `branch` command, so the ref is removed directly:
            // as a loose ref file and, if present, from packed-refs.
            const looseRef = `${MEM_GITDIR}/refs/heads/${branch}`;
            if (this.lg2.fs.analyzePath(looseRef).exists) {
                this.lg2.fs.unlink(looseRef);
            }
            const packedRefsPath = `${MEM_GITDIR}/packed-refs`;
            if (this.lg2.fs.analyzePath(packedRefsPath).exists) {
                const packed = this.lg2.fs.readFile(packedRefsPath, {
                    encoding: "utf8",
                });
                const filtered = packed
                    .split("\n")
                    .filter((line) => !line.endsWith(` refs/heads/${branch}`))
                    .join("\n");
                this.lg2.fs.writeFile(packedRefsPath, filtered);
            }
            await this.syncOut();
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async branchIsMerged(branch: string): Promise<boolean> {
        const result = await this.read(["rev-list", branch, "--not", "HEAD"], {
            ignoreErrors: true,
        });
        return !/^[0-9a-f]{40}$/m.test(result.stdout);
    }

    async init(): Promise<void> {
        try {
            await this.ensureReady();
            await this.mutate(["init", "."]);
            this.gitDirLoaded = true;
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async clone(url: string, _dir: string, depth?: number): Promise<void> {
        const progressNotice = this.showNotice("Initializing clone");
        try {
            if (depth != undefined) {
                new Notice(
                    "Shallow clones are not supported by the wasm-git engine. Performing a full clone instead."
                );
            }
            // The base path may have been changed right before this call;
            // rebuild the mirrors so they match the clone target.
            if (!this.lg2.initialized) {
                await this.lg2.init();
            }
            this.buildMirrors();
            await this.syncIn();
            const fs = this.lg2.fs;
            const cloneDir = "/clone-tmp";
            await this.withAuthRetry(() =>
                this.lg2.run("/", ["clone", url, cloneDir], {
                    onProgress: (line) => {
                        if (progressNotice && line.startsWith("net")) {
                            progressNotice.setMessage(`Cloning: ${line}`);
                        }
                    },
                })
            );
            if (fs.analyzePath(`${MEM_GITDIR}/HEAD`).exists) {
                throw new Error(
                    "A git repository already exists at the clone target."
                );
            }
            const head = fs
                .readFile(`${cloneDir}/.git/HEAD`, { encoding: "utf8" })
                .trim();
            const branch = head.match(/^ref: refs\/heads\/(.*)$/)?.[1];
            if (fs.analyzePath(MEM_GITDIR).exists) {
                // The mirror pre-creates the (empty) directory; remove it so
                // the cloned .git can be moved into place.
                removeMemTree(fs, MEM_GITDIR);
            }
            fs.rename(`${cloneDir}/.git`, MEM_GITDIR);
            removeMemTree(fs, cloneDir);
            // Materialize the working tree in place. This intentionally
            // overwrites clashing vault files, matching the previous
            // isomorphic-git behavior of cloning into a non-empty vault.
            await this.lg2.run(MEM_ROOT, [
                "checkout",
                "--force",
                branch ?? "HEAD",
            ]);
            this.gitDirLoaded = true;
            await this.syncOut();
            progressNotice?.hide();
        } catch (error) {
            progressNotice?.hide();
            this.plugin.displayError(error);
            throw error;
        }
    }

    // ------------------------------------------------------------------
    // Config and remotes
    // ------------------------------------------------------------------

    async setConfig(
        path: string,
        value: string | number | boolean | undefined
    ): Promise<void> {
        try {
            await this.ensureReady();
            if (value == undefined) {
                // lg2's config command cannot unset values; edit the config
                // file directly instead.
                const configPath = `${MEM_GITDIR}/config`;
                if (this.lg2.fs.analyzePath(configPath).exists) {
                    const content = this.lg2.fs.readFile(configPath, {
                        encoding: "utf8",
                    });
                    this.lg2.fs.writeFile(
                        configPath,
                        removeConfigKey(content, path)
                    );
                    await this.syncOut();
                }
            } else {
                await this.mutate(["config", path, String(value)]);
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async getConfig(path: string): Promise<string | undefined> {
        await this.ensureReady();
        const result = await this.lg2.run(MEM_ROOT, ["config", path], {
            ignoreErrors: true,
        });
        const value = result.stdout;
        if (value === "" || value.startsWith("Unable to get configuration")) {
            return undefined;
        }
        return value;
    }

    async setRemote(name: string, url: string): Promise<void> {
        try {
            const remotes = await this.getRemotes();
            if (remotes.includes(name)) {
                await this.mutate(["remote", "set-url", name, url]);
            } else {
                await this.mutate(["remote", "add", name, url]);
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async getRemotes(): Promise<string[]> {
        const result = await this.read(["remote", "show"], {
            ignoreErrors: true,
        });
        return result.stdout.split("\n").filter((line) => line.length > 0);
    }

    async getRemoteUrl(remote: string): Promise<string | undefined> {
        const result = await this.read(["remote", "show", "-v"], {
            ignoreErrors: true,
        });
        return parseRemoteVerbose(result.stdout).get(remote);
    }

    async removeRemote(remoteName: string): Promise<void> {
        await this.mutate(["remote", "remove", remoteName]);
    }

    async getRemoteBranches(remote: string): Promise<string[]> {
        try {
            const result = await this.withAuthRetry(() =>
                this.read(["ls-remote", remote])
            );
            const branches = parseLsRemote(result.stdout)
                .filter((ref) => ref.refName.startsWith("refs/heads/"))
                .map(
                    (ref) =>
                        `${remote}/${ref.refName.substring("refs/heads/".length)}`
                );
            if (branches.length > 0) return branches;
        } catch {
            // Offline or unauthenticated: fall back to the locally known
            // remote-tracking branches below.
        }
        const refs = await this.read(["for-each-ref"], {
            ignoreErrors: true,
        });
        return parseForEachRef(refs.stdout)
            .filter(
                (ref) =>
                    ref.refName.startsWith(`refs/remotes/${remote}/`) &&
                    !ref.refName.endsWith("/HEAD")
            )
            .map((ref) => ref.refName.substring("refs/remotes/".length));
    }

    async updateUpstreamBranch(remoteBranch: string): Promise<void> {
        const [remote, branch] = splitRemoteBranch(remoteBranch);
        const branchInfo = await this.branchInfo();
        if (!branchInfo.current) {
            throw new Error("No branch is currently checked out.");
        }
        if (remote !== "origin" || branch !== branchInfo.current) {
            // lg2's push has no refspec support: it always pushes the
            // current branch to its namesake on origin. Still record the
            // requested upstream so pull merges the right branch.
            new Notice(
                "Note: the wasm-git engine always pushes the current branch to its namesake on 'origin'."
            );
        }
        await this.setConfig(`branch.${branchInfo.current}.remote`, remote);
        await this.setConfig(
            `branch.${branchInfo.current}.merge`,
            `refs/heads/${branch ?? branchInfo.current}`
        );
        await this.withAuthRetry(() => this.mutate(["push"]));
    }

    // ------------------------------------------------------------------
    // History and diffs
    // ------------------------------------------------------------------

    async log(
        file?: string,
        relativeToVault = true,
        limit?: number,
        ref?: string
    ): Promise<LogEntry[]> {
        const args = ["log"];
        if (limit != undefined) {
            args.push("-n", String(limit));
        }
        if (ref != undefined) {
            args.push(ref);
        }
        if (file != undefined) {
            args.push("--", this.getRelativeRepoPath(file, relativeToVault));
        }
        const result = await this.read(args, { ignoreErrors: true });
        const entries = parseLog(result.stdout);

        const logEntries: LogEntry[] = [];
        for (const entry of entries) {
            let files: DiffFile[] = [];
            const parent = await this.read(["rev-parse", `${entry.hash}~1`], {
                ignoreErrors: true,
            });
            const parentHash = parent.stdout.match(/^[0-9a-f]{40}$/m)?.[0];
            if (parentHash) {
                const diff = await this.read(
                    ["diff", "--name-status", parentHash, entry.hash],
                    { ignoreErrors: true }
                );
                files = parseNameStatus(diff.stdout).map((item) => ({
                    path: item.path,
                    status: item.type,
                    vaultPath: this.getRelativeVaultPath(item.path),
                    hash: entry.hash,
                }));
            }
            logEntries.push({
                hash: entry.hash,
                date: entry.date.toISOString(),
                message: entry.message,
                body: entry.body,
                refs: [],
                diff: { changed: files.length, files },
                author: {
                    name: entry.authorName,
                    email: entry.authorEmail,
                },
            });
        }
        return logEntries;
    }

    async getFileChangesCount(
        commitHash1: string,
        commitHash2: string
    ): Promise<WalkDifference[]> {
        const result = await this.read(
            ["diff", "--name-status", commitHash1, commitHash2],
            { ignoreErrors: true }
        );
        return parseNameStatus(result.stdout);
    }

    async getDiffString(
        filePath: string,
        stagedChanges = false,
        hash?: string
    ): Promise<string> {
        if (hash) {
            const parent = await this.read(["rev-parse", `${hash}~1`], {
                ignoreErrors: true,
            });
            const parentHash = parent.stdout.match(/^[0-9a-f]{40}$/m)?.[0];
            if (parentHash) {
                const result = await this.read(
                    ["diff", "-p", parentHash, hash],
                    { ignoreErrors: true }
                );
                return extractFileDiff(result.stdout, filePath) ?? "";
            }
            // Root commit: synthesize an "added file" patch.
            const content = await this.read(
                ["cat-file", "-p", `${hash}:${filePath}`],
                { ignoreErrors: true }
            );
            return buildAddedFilePatch(filePath, content.stdout);
        }
        const args = stagedChanges ? ["diff", "--cached"] : ["diff"];
        const result = await this.read(args, { ignoreErrors: true });
        return extractFileDiff(result.stdout, filePath) ?? "";
    }

    async getLastCommitTime(): Promise<Date | undefined> {
        const head = await this.revParse("HEAD");
        if (!head) return undefined;
        const commit = await this.catFileCommit(head);
        if (!commit) return undefined;
        return new Date(commit.committer.epochSeconds * 1000);
    }

    async revParse(rev: string): Promise<string | undefined> {
        const result = await this.read(["rev-parse", rev], {
            ignoreErrors: true,
        });
        return result.stdout.match(/^[0-9a-f]{40}$/m)?.[0];
    }

    async catFileCommit(hash: string): Promise<ParsedCommitObject | undefined> {
        const result = await this.read(["cat-file", "-p", hash], {
            ignoreErrors: true,
        });
        return parseCommitObject(result.stdout);
    }

    // ------------------------------------------------------------------
    // Extended features unique to the wasm-git engine on mobile
    // ------------------------------------------------------------------

    /** Stashes all tracked changes in the working directory. */
    async stashPush(): Promise<string> {
        const result = await this.mutate(["stash", "push"]);
        return result.stdout;
    }

    /** Applies and drops the most recent stash. */
    async stashPop(): Promise<string> {
        const result = await this.mutate(["stash", "pop"]);
        return result.stdout;
    }

    /** Applies a stash by index without dropping it. */
    async stashApply(index = 0): Promise<string> {
        const result = await this.mutate(["stash", "apply", String(index)]);
        return result.stdout;
    }

    /** Drops a stash by index. */
    async stashDrop(index = 0): Promise<string> {
        const result = await this.mutate(["stash", "drop", String(index)]);
        return result.stdout;
    }

    /** Lists all stashes (`stash@{n}: message` per line). */
    async stashList(): Promise<string[]> {
        const result = await this.read(["stash", "list"], {
            ignoreErrors: true,
        });
        return result.stdout.split("\n").filter((line) => line.length > 0);
    }

    /**
     * Reverts the given commit in the working tree and index. The revert is
     * left staged for the user to commit; sequencer state files are cleaned
     * up so later commands are not blocked by an "unexpected state".
     */
    async revert(rev: string): Promise<void> {
        await this.mutate(["revert", rev]);
        for (const stateFile of ["REVERT_HEAD", "MERGE_MSG"]) {
            const path = `${MEM_GITDIR}/${stateFile}`;
            if (this.lg2.fs.analyzePath(path).exists) {
                this.lg2.fs.unlink(path);
            }
        }
        await this.syncOut();
    }

    /** Creates a (lightweight or annotated) tag at HEAD. */
    async tagCreate(name: string, message?: string): Promise<void> {
        const args = message ? ["tag", name, message] : ["tag", name];
        await this.mutate(args);
    }

    /** Deletes a tag. */
    async tagDelete(name: string): Promise<void> {
        await this.mutate(["tag", "-d", name]);
    }

    /** Lists all tag names. */
    async tagList(): Promise<string[]> {
        const refs = await this.read(["for-each-ref"], {
            ignoreErrors: true,
        });
        return parseForEachRef(refs.stdout)
            .filter((ref) => ref.refName.startsWith("refs/tags/"))
            .map((ref) => ref.refName.substring("refs/tags/".length));
    }

    /**
     * Line-by-line blame in the porcelain-shaped {@link Blame} format used
     * by line authoring. Returns `"untracked"` when the path is not in the
     * index. wasm-git's blame has no `-C`/`-w` flags, so movement tracking
     * and whitespace ignoring are accepted for API compatibility only.
     */
    async blame(
        filePath: string,
        _trackMovement?: "inactive" | "same-commit" | "all-commits",
        _ignoreWhitespace?: boolean
    ): Promise<Blame | "untracked"> {
        const repoPath = this.getRelativeRepoPath(filePath);
        if (!(await this.isTracked(repoPath))) return "untracked";
        const result = await this.read(["blame", repoPath]);
        const lines = parseBlame(result.stdout);
        const commits = new Map<string, ParsedCommitObject>();
        const fullHashes = new Map<string, string>();
        for (const line of lines) {
            if (commits.has(line.hash)) continue;
            const full = (await this.revParse(line.hash)) ?? line.hash;
            fullHashes.set(line.hash, full);
            const commit = await this.catFileCommit(full);
            if (commit) commits.set(line.hash, commit);
        }
        return toPorcelainBlame(lines, commits, fullHashes);
    }

    async isTracked(path: string): Promise<boolean> {
        const repoPath = this.getRelativeRepoPath(path);
        const tracked = await this.lsFiles();
        return tracked.includes(repoPath);
    }

    async hashObject(filepath: string): Promise<string> {
        const repoPath = this.getRelativeRepoPath(filepath);
        const hashed = await this.read(["hash-object", repoPath], {
            ignoreErrors: true,
        });
        const hash = hashed.stdout.match(/^[0-9a-f]{40}$/m)?.[0];
        if (hash) return hash;
        const head = await this.revParse("HEAD");
        return head ?? "";
    }

    async submoduleAwareHeadRevisonInContainingDirectory(
        _filepath: string
    ): Promise<string> {
        return (await this.revParse("HEAD")) ?? "";
    }

    async getSubmodulePaths(): Promise<string[]> {
        return Promise.resolve([]);
    }

    async getSubmoduleOfFile(
        _repositoryRelativeFile: string
    ): Promise<{ submodule: string; relativeFilepath: string } | undefined> {
        return Promise.resolve(undefined);
    }

    async isFileTrackedByLFS(_filePath: string): Promise<boolean> {
        return Promise.resolve(false);
    }

    async show(
        commitHash: string,
        file: string,
        relativeToVault = true
    ): Promise<string> {
        const repoPath = this.getRelativeRepoPath(file, relativeToVault);
        // lg2's cat-file does not implement the `:path` index revision.
        // Resolve the staged blob via `ls-files -s` when no commit is given.
        if (commitHash === "") {
            const indexed = await this.readIndexFile(repoPath);
            if (indexed == undefined) {
                throw new Error(`exists on disk, but not in '${repoPath}'`);
            }
            return indexed;
        }
        const result = await this.read([
            "cat-file",
            "-p",
            `${commitHash}:${repoPath}`,
        ]);
        return result.stdout;
    }

    async diff(
        file: string,
        commit1: string,
        commit2: string
    ): Promise<string> {
        const result = await this.read(["diff", "-p", commit1, commit2], {
            ignoreErrors: true,
        });
        return extractFileDiff(result.stdout, file) ?? "";
    }

    /**
     * Applies a unified diff to the index (`git apply --cached`).
     * lg2 has no `apply` command, so the patch is applied in TypeScript to
     * the current index blob, then staged via a worktree swap that restores
     * the user's working-tree content afterwards.
     */
    async applyPatch(patch: string): Promise<void> {
        const repoPath = extractPatchPath(patch);
        if (repoPath == undefined) {
            throw new Error("Patch is missing a +++ b/<path> header");
        }
        await this.syncIn();
        try {
            const memPath = `${MEM_ROOT}/${repoPath}`;
            const originalExists = this.lg2.fs.analyzePath(memPath).exists;
            const original = originalExists
                ? this.lg2.fs.readFile(memPath, { encoding: "utf8" })
                : "";
            const source = (await this.readIndexFile(repoPath)) ?? "";
            const patched = applyUnifiedPatch(source, patch);
            this.lg2.fs.writeFile(memPath, patched);
            await this.lg2.run(MEM_ROOT, ["add", repoPath]);
            if (originalExists) {
                this.lg2.fs.writeFile(memPath, original);
            } else if (this.lg2.fs.analyzePath(memPath).exists) {
                this.lg2.fs.unlink(memPath);
            }
        } finally {
            await this.syncOut();
        }
    }

    /**
     * Soft-resets onto the tracking branch and recommits unpushed work as
     * one commit, reusing the previous HEAD message. No-op when there is
     * no tracking branch, fewer than two unpushed commits, staged but
     * uncommitted changes, or a merge in the unpushed range.
     */
    async squashAllUnpushedCommits(): Promise<void> {
        const branchInfo = await this.branchInfo();
        if (!branchInfo.tracking || !branchInfo.current) return;
        const remoteBranches = await this.getRemoteBranches(
            splitRemoteBranch(branchInfo.tracking)[0]
        );
        if (!remoteBranches.includes(branchInfo.tracking)) return;
        const status = await this.status();
        if (status.staged.length > 0) return;
        const unpushed = await this.getUnpushedCommits();
        if (unpushed < 2) return;
        const history = await this.log(undefined, false, unpushed);
        if (history.some((entry) => entry.message.startsWith("Merge"))) {
            return;
        }
        const oldHead = await this.revParse("HEAD");
        const tracking = await this.revParse(branchInfo.tracking);
        if (!oldHead || !tracking) return;
        const previous = await this.catFileCommit(oldHead);
        if (!previous) return;
        await this.withGitOperation(GitOperation.commit, async () => {
            await this.mutate(["reset", "--soft", tracking]);
            await this.mutate(["commit", "-m", previous.message.trim()]);
            this.app.workspace.trigger("obsidian-git:head-change");
        });
    }

    /** `git describe --tags` output, or undefined when nothing describes HEAD. */
    async describe(): Promise<string | undefined> {
        const result = await this.read(["describe", "--tags"], {
            ignoreErrors: true,
        });
        const description = result.stdout.trim();
        return description.length > 0 ? description : undefined;
    }

    /** All paths currently tracked in the index. */
    async lsFiles(): Promise<string[]> {
        const result = await this.read(["ls-files"], { ignoreErrors: true });
        return result.stdout.split("\n").filter((line) => line.length > 0);
    }

    /**
     * Runs a raw lg2 command for the command palette. Returns the combined
     * output; never throws so the palette can display errors verbatim.
     */
    async rawCommand(command: string): Promise<string> {
        const args = splitCommandLine(command);
        if (args.length === 0) return "";
        await this.syncIn();
        let result;
        try {
            result = await this.lg2.run(MEM_ROOT, args, {
                ignoreErrors: true,
            });
        } finally {
            await this.syncOut();
        }
        return [result.stdout, result.stderr]
            .filter((part) => part.length > 0)
            .join("\n");
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    async updateBasePath(basePath: string): Promise<void> {
        this.plugin.settings.basePath = basePath;
        if (this.lg2.initialized) {
            this.buildMirrors();
            resetMemRepo(this.lg2);
        }
        return Promise.resolve();
    }

    /** Reads the staged blob for `repoPath`, or undefined if it is untracked. */
    private async readIndexFile(repoPath: string): Promise<string | undefined> {
        const listed = await this.read(["ls-files", "-s"], {
            ignoreErrors: true,
        });
        const escaped = repoPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const hash = listed.stdout.match(
            new RegExp(`^[0-7]+ ([0-9a-f]{40})\\s+${escaped}$`, "m")
        )?.[1];
        if (hash) {
            const blob = await this.read(["cat-file", "-p", hash], {
                ignoreErrors: true,
            });
            return blob.stdout;
        }
        // lg2 may omit -s details or pathspecs; HEAD:path is the usual
        // index content when nothing is staged.
        const fromHead = await this.read(
            ["cat-file", "-p", `HEAD:${repoPath}`],
            { ignoreErrors: true }
        );
        return fromHead.stdout.length > 0 ? fromHead.stdout : undefined;
    }

    updateGitPath(_: string): Promise<void> {
        // wasm-git bundles its own git implementation.
        return Promise.resolve();
    }

    unload(): void {
        this.lg2.unload();
        this.worktreeMirror = undefined;
        this.gitDirMirror = undefined;
        this.gitDirLoaded = false;
    }

    private showNotice(message: string, infinity = true): Notice | undefined {
        if (!this.plugin.settings.disablePopups) {
            return new Notice(
                message,
                infinity ? this.noticeLength : undefined
            );
        }
        return undefined;
    }
}

function resetMemRepo(lg2: Lg2): void {
    if (lg2.fs.analyzePath(MEM_ROOT).exists) {
        removeMemTree(lg2.fs, MEM_ROOT);
    }
}

function removeMemTree(
    fs: {
        readdir(path: string): string[];
        stat(path: string): { mode: number };
        isDir(mode: number): boolean;
        unlink(path: string): void;
        rmdir(path: string): void;
    },
    path: string
): void {
    for (const name of fs.readdir(path)) {
        if (name === "." || name === "..") continue;
        const child = `${path}/${name}`;
        if (fs.isDir(fs.stat(child).mode)) {
            removeMemTree(fs, child);
        } else {
            fs.unlink(child);
        }
    }
    fs.rmdir(path);
}

function buildAddedFilePatch(path: string, content: string): string {
    if (content.length === 0) {
        return `diff --git a/${path} b/${path}\nnew file mode 100644\n`;
    }
    const lines = content.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    const body = lines.map((line) => `+${line}`).join("\n");
    return (
        `diff --git a/${path} b/${path}\n` +
        `new file mode 100644\n` +
        `--- /dev/null\n` +
        `+++ b/${path}\n` +
        `@@ -0,0 +1,${lines.length} @@\n` +
        body +
        "\n"
    );
}
