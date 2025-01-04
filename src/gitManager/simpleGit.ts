import { spawnSync } from "child_process";
import debug from "debug";
import * as fsPromises from "fs/promises";
import type { FileSystemAdapter } from "obsidian";
import { normalizePath, Notice, Platform } from "obsidian";
import * as path from "path";
import { resolve, sep } from "path";
import type * as simple from "simple-git";
import simpleGit, { GitError } from "simple-git";
import {
    ASK_PASS_INPUT_FILE,
    ASK_PASS_SCRIPT,
    ASK_PASS_SCRIPT_FILE,
    DEFAULT_WIN_GIT_PATH,
    GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH,
} from "src/constants";
import type { LineAuthorFollowMovement } from "src/lineAuthor/model";
import { GeneralModal } from "src/ui/modals/generalModal";
import type ObsidianGit from "../main";
import type {
    Blame,
    BlameCommit,
    BranchInfo,
    DiffFile,
    FileStatusResult,
    LogEntry,
    Status,
} from "../types";
import { CurrentGitAction, NoNetworkError } from "../types";
import { impossibleBranch, splitRemoteBranch } from "../utils";
import { GitManager } from "./gitManager";

export class SimpleGit extends GitManager {
    git: simple.SimpleGit;
    absoluteRepoPath: string;
    watchAbortController: AbortController | undefined;
    useDefaultWindowsGitPath: boolean = false;
    constructor(plugin: ObsidianGit) {
        super(plugin);
    }

    async setGitInstance(ignoreError = false): Promise<void> {
        if (this.isGitInstalled()) {
            const adapter = this.app.vault.adapter as FileSystemAdapter;
            const vaultBasePath = adapter.getBasePath();
            let basePath = vaultBasePath;
            // Because the basePath setting is a relative path, a leading `/` must
            // be appended before concatenating with the path.
            if (this.plugin.settings.basePath) {
                const exists = await adapter.exists(
                    normalizePath(this.plugin.settings.basePath)
                );
                if (exists) {
                    basePath = path.join(
                        vaultBasePath,
                        this.plugin.settings.basePath
                    );
                } else if (!ignoreError) {
                    new Notice("ObsidianGit: Base path does not exist");
                }
            }
            this.absoluteRepoPath = basePath;

            this.git = simpleGit({
                baseDir: basePath,
                binary:
                    this.plugin.localStorage.getGitPath() ||
                    (this.useDefaultWindowsGitPath
                        ? DEFAULT_WIN_GIT_PATH
                        : undefined),
                config: ["core.quotepath=off"],
                unsafe: {
                    allowUnsafeCustomBinary: true,
                },
            });
            const pathPaths = this.plugin.localStorage.getPATHPaths();
            const envVars = this.plugin.localStorage.getEnvVars();
            const gitDir = this.plugin.settings.gitDir;
            if (pathPaths.length > 0) {
                const path = process.env["PATH"] + ":" + pathPaths.join(":");
                process.env["PATH"] = path;
            }
            if (gitDir) {
                process.env["GIT_DIR"] = gitDir;
            }
            for (const envVar of envVars) {
                const [key, value] = envVar.split("=");
                process.env[key] = value;
            }

            debug.enable("simple-git");
            if (await this.git.checkIsRepo()) {
                // Resolve the relative root reported by git into an absolute path
                // in case git resides in a different filesystem (eg, WSL)
                const relativeRoot = await this.git.revparse("--show-cdup");
                const absoluteRoot = resolve(basePath + sep + relativeRoot);

                this.absoluteRepoPath = absoluteRoot;
                await this.git.cwd(absoluteRoot);
            }

            const absolutePluginConfigPath = path.join(
                vaultBasePath,
                this.app.vault.configDir,
                "plugins",
                "obsidian-git"
            );
            const askPassPath = path.join(
                absolutePluginConfigPath,
                ASK_PASS_SCRIPT_FILE
            );

            if (process.env["SSH_ASKPASS"] == undefined) {
                process.env["SSH_ASKPASS"] = askPassPath;
            }
            process.env["OBSIDIAN_GIT_CREDENTIALS_INPUT"] = path.join(
                absolutePluginConfigPath,
                ASK_PASS_INPUT_FILE
            );
            if (process.env["SSH_ASKPASS"] == askPassPath) {
                this.askpass().catch((e) => this.plugin.displayError(e));
            }
        }
    }

    // Constructs a path relative to the vault from a path relative to the git repository
    getRelativeVaultPath(filePath: string): string {
        const adapter = this.app.vault.adapter as FileSystemAdapter;
        const from = adapter.getBasePath();

        const to = path.join(this.absoluteRepoPath, filePath);

        let res = path.relative(from, to);
        if (Platform.isWin) {
            res = res.replace(/\\/g, "/");
        }
        return res;
    }

    // Constructs a path relative to the git repository from a path relative to the vault
    //
    // @param doConversion - If false, the path is returned as is. This is added because that parameter is often passed on to functions where this method is called.
    getRelativeRepoPath(
        filePath: string,
        doConversion: boolean = true
    ): string {
        if (doConversion) {
            const adapter = this.plugin.app.vault.adapter as FileSystemAdapter;
            const vaultPath = adapter.getBasePath();
            const from = this.absoluteRepoPath;
            const to = path.join(vaultPath, filePath);
            let res = path.relative(from, to);
            if (Platform.isWin) {
                res = res.replace(/\\/g, "/");
            }
            return res;
        }
        return filePath;
    }

    async askpass(): Promise<void> {
        const adapter = this.app.vault.adapter as FileSystemAdapter;
        const vaultPath = adapter.getBasePath();
        const absPluginConfigPath = path.join(
            vaultPath,
            this.app.vault.configDir,
            "plugins",
            "obsidian-git"
        );
        const relPluginConfigDir =
            this.app.vault.configDir + "/plugins/obsidian-git/";

        await fsPromises.writeFile(
            path.join(absPluginConfigPath, ASK_PASS_SCRIPT_FILE),
            ASK_PASS_SCRIPT
        );
        await fsPromises.chmod(
            path.join(absPluginConfigPath, ASK_PASS_SCRIPT_FILE),
            0o755
        );
        this.watchAbortController = new AbortController();
        const { signal } = this.watchAbortController;
        try {
            const watcher = fsPromises.watch(absPluginConfigPath, { signal });

            for await (const event of watcher) {
                if (event.filename != ASK_PASS_INPUT_FILE) continue;
                const triggerFilePath =
                    relPluginConfigDir + ASK_PASS_INPUT_FILE;
                if (!(await adapter.exists(triggerFilePath))) continue;

                const data = await adapter.read(triggerFilePath);
                let notice: Notice | undefined;
                // The text is too long for the modal, so a notice is shown instead
                if (data.length > 60) {
                    notice = new Notice(data, 999_999);
                }
                const response = await new GeneralModal(this.plugin, {
                    allowEmpty: true,
                    placeholder:
                        data.length > 60
                            ? "Enter a response to the message."
                            : data,
                }).openAndGetResult();
                notice?.hide();

                // Just in case the trigger file was removed while the modal was open
                if (await adapter.exists(triggerFilePath)) {
                    await adapter.write(
                        `${triggerFilePath}.response`,
                        response ?? ""
                    );
                }
            }
        } catch (error) {
            this.plugin.displayError(error);
            await fsPromises.rm(
                path.join(absPluginConfigPath, ASK_PASS_SCRIPT_FILE),
                { force: true }
            );
            await fsPromises.rm(
                path.join(
                    absPluginConfigPath,
                    `${ASK_PASS_SCRIPT_FILE}.response`
                ),
                { force: true }
            );
            await new Promise((res) => setTimeout(res, 5000));
            this.plugin.log("Retry watch for ask pass");
            await this.askpass();
        }
    }

    unload(): void {
        this.watchAbortController?.abort();
    }

    async status(): Promise<Status> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.status });
        const status = await this.git.status();
        this.plugin.setPluginState({ gitAction: CurrentGitAction.idle });

        const allFilesFormatted = status.files.map<FileStatusResult>((e) => {
            const res = this.formatPath(e);
            return {
                path: res.path,
                from: res.from,
                index: e.index === "?" ? "U" : e.index,
                workingDir: e.working_dir === "?" ? "U" : e.working_dir,
                vaultPath: this.getRelativeVaultPath(res.path),
            };
        });
        return {
            all: allFilesFormatted,
            changed: allFilesFormatted.filter((e) => e.workingDir !== " "),
            staged: allFilesFormatted.filter(
                (e) => e.index !== " " && e.index != "U"
            ),
            conflicted: status.conflicted.map(
                (path) => this.formatPath({ path }).path
            ),
        };
    }

    async submoduleAwareHeadRevisonInContainingDirectory(
        filepath: string
    ): Promise<string> {
        const repoPath = this.getRelativeRepoPath(filepath);

        const containingDirectory = path.dirname(repoPath);
        const args = ["-C", containingDirectory, "rev-parse", "HEAD"];

        const result = this.git.raw(args);
        result.catch((err) =>
            console.warn("obsidian-git: rev-parse error:", err)
        );
        return result;
    }

    async getSubmodulePaths(): Promise<string[]> {
        return new Promise<string[]>((resolve) => {
            this.git.outputHandler((_cmd, stdout, _stderr, args) => {
                // Do not run this handler on other commands
                if (!(args.contains("submodule") && args.contains("foreach"))) {
                    return;
                }

                let body = "";
                const root =
                    (
                        this.app.vault.adapter as FileSystemAdapter
                    ).getBasePath() +
                    (this.plugin.settings.basePath
                        ? "/" + this.plugin.settings.basePath
                        : "");
                stdout.on("data", (chunk: Buffer) => {
                    body += chunk.toString("utf8");
                });
                stdout.on("end", () => {
                    const submods = body.split("\n");

                    // Remove words like `Entering` in front of each line and filter empty lines
                    const strippedSubmods: string[] = submods
                        .map((i) => {
                            const submod = i.match(/'([^']*)'/);
                            if (submod != undefined) {
                                return root + "/" + submod[1] + sep;
                            }
                        })
                        .filter((i): i is string => !!i);

                    strippedSubmods.reverse();
                    resolve(strippedSubmods);
                });
            });

            this.git.subModule(["foreach", "--recursive", ""]).then(
                () => {
                    this.git.outputHandler(() => {});
                },
                (e) => this.plugin.displayError(e)
            );
        });
    }

    //Remove wrong `"` like "My file.md"
    formatPath(
        path: { from?: string; path: string },
        renamed = false
    ): { path: string; from?: string } {
        function format(path?: string): string | undefined {
            if (path == undefined) return undefined;

            if (path.startsWith('"') && path.endsWith('"')) {
                return path.substring(1, path.length - 1);
            } else {
                return path;
            }
        }
        if (renamed) {
            return {
                from: format(path.from),
                path: format(path.path)!,
            };
        } else {
            return {
                path: format(path.path)!,
            };
        }
    }

    async blame(
        path: string,
        trackMovement: LineAuthorFollowMovement,
        ignoreWhitespace: boolean
    ): Promise<Blame | "untracked"> {
        path = this.getRelativeRepoPath(path);

        if (!(await this.isTracked(path))) return "untracked";

        const inSubmodule = await this.getSubmoduleOfFile(path);
        const args = inSubmodule ? ["-C", inSubmodule.submodule] : [];
        const relativePath = inSubmodule ? inSubmodule.relativeFilepath : path;

        args.push("blame", "--porcelain");

        if (ignoreWhitespace) args.push("-w");

        const trackCArg = `-C${GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH}`;
        switch (trackMovement) {
            case "inactive":
                break;
            case "same-commit":
                args.push("-C", trackCArg);
                break;
            case "all-commits":
                args.push("-C", "-C", trackCArg);
                break;
            default:
                impossibleBranch(trackMovement);
        }

        args.push("--", relativePath);

        const rawBlame = await this.git.raw(args);
        return parseBlame(rawBlame);
    }

    async isTracked(path: string): Promise<boolean> {
        const inSubmodule = await this.getSubmoduleOfFile(path);
        const args = inSubmodule ? ["-C", inSubmodule.submodule] : [];
        const relativePath = inSubmodule ? inSubmodule.relativeFilepath : path;

        args.push("ls-files", "--", relativePath);
        return this.git.raw(args).then((x) => x.trim() !== "");
    }

    async commitAll({ message }: { message: string }): Promise<number> {
        if (this.plugin.settings.updateSubmodules) {
            this.plugin.setPluginState({ gitAction: CurrentGitAction.commit });
            const submodulePaths = await this.getSubmodulePaths();
            for (const item of submodulePaths) {
                await this.git.cwd({ path: item, root: false }).add("-A");
                await this.git
                    .cwd({ path: item, root: false })
                    .commit(await this.formatCommitMessage(message));
            }
        }
        this.plugin.setPluginState({ gitAction: CurrentGitAction.add });

        await this.git.add("-A");

        this.plugin.setPluginState({ gitAction: CurrentGitAction.commit });

        const res = await this.git.commit(
            await this.formatCommitMessage(message)
        );
        this.app.workspace.trigger("obsidian-git:head-change");

        return res.summary.changes;
    }

    async commit({
        message,
        amend,
    }: {
        message: string;
        amend?: boolean;
    }): Promise<number> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.commit });

        const res = (
            await this.git.commit(
                await this.formatCommitMessage(message),
                amend ? ["--amend"] : []
            )
        ).summary.changes;
        this.app.workspace.trigger("obsidian-git:head-change");

        this.plugin.setPluginState({ gitAction: CurrentGitAction.idle });
        return res;
    }

    async stage(path: string, relativeToVault: boolean): Promise<void> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.add });

        path = this.getRelativeRepoPath(path, relativeToVault);
        await this.git.add(["--", path]);

        this.plugin.setPluginState({ gitAction: CurrentGitAction.idle });
    }

    async stageAll({ dir }: { dir?: string }): Promise<void> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.add });
        await this.git.add(dir ?? "-A");
        this.plugin.setPluginState({ gitAction: CurrentGitAction.idle });
    }

    async unstageAll({ dir }: { dir?: string }): Promise<void> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.add });
        await this.git.reset(dir != undefined ? ["--", dir] : []);
        this.plugin.setPluginState({ gitAction: CurrentGitAction.idle });
    }

    async unstage(path: string, relativeToVault: boolean): Promise<void> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.add });

        path = this.getRelativeRepoPath(path, relativeToVault);
        await this.git.reset(["--", path]);

        this.plugin.setPluginState({ gitAction: CurrentGitAction.idle });
    }

    async discard(filepath: string): Promise<void> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.add });
        if (await this.isTracked(filepath)) {
            await this.git.checkout(["--", filepath]);
        } else {
            await this.app.vault.adapter.rmdir(
                this.getRelativeVaultPath(filepath),
                true
            );
        }
        this.plugin.setPluginState({ gitAction: CurrentGitAction.idle });
    }

    async hashObject(filepath: string): Promise<string> {
        // Need to use raw command here to ensure filenames are literally used.
        // Perhaps we could file a PR? https://github.com/steveukx/git-js/blob/main/simple-git/src/lib/tasks/hash-object.ts
        filepath = this.getRelativeRepoPath(filepath);
        const inSubmodule = await this.getSubmoduleOfFile(filepath);
        const args = inSubmodule ? ["-C", inSubmodule.submodule] : [];
        const relativeFilepath = inSubmodule
            ? inSubmodule.relativeFilepath
            : filepath;

        args.push("hash-object", "--", relativeFilepath);

        const revision = this.git.raw(args);
        return revision;
    }

    async discardAll({ dir }: { dir?: string }): Promise<void> {
        return this.discard(dir ?? ".");
    }

    async pull(): Promise<FileStatusResult[] | undefined> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.pull });
        try {
            if (this.plugin.settings.updateSubmodules)
                await this.git.subModule([
                    "update",
                    "--remote",
                    "--merge",
                    "--recursive",
                ]);

            const branchInfo = await this.branchInfo();
            const localCommit = await this.git.revparse([branchInfo.current!]);

            if (!branchInfo.tracking && this.plugin.settings.updateSubmodules) {
                this.plugin.log(
                    "No tracking branch found. Ignoring pull of main repo and updating submodules only."
                );
                return;
            }

            await this.git.fetch();
            const upstreamCommit = await this.git.revparse([
                branchInfo.tracking!,
            ]);

            if (localCommit !== upstreamCommit) {
                if (
                    this.plugin.settings.syncMethod === "merge" ||
                    this.plugin.settings.syncMethod === "rebase"
                ) {
                    try {
                        switch (this.plugin.settings.syncMethod) {
                            case "merge":
                                await this.git.merge([branchInfo.tracking!]);
                                break;
                            case "rebase":
                                await this.git.rebase([branchInfo.tracking!]);
                        }
                    } catch (err) {
                        this.plugin.displayError(
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            `Pull failed (${this.plugin.settings.syncMethod}): ${"message" in err ? err.message : err}`
                        );
                        return;
                    }
                } else if (this.plugin.settings.syncMethod === "reset") {
                    try {
                        await this.git.raw([
                            "update-ref",
                            `refs/heads/${branchInfo.current}`,
                            upstreamCommit,
                        ]);
                        await this.unstageAll({});
                    } catch (err) {
                        this.plugin.displayError(
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            `Sync failed (${this.plugin.settings.syncMethod}): ${"message" in err ? err.message : err}`
                        );
                    }
                }
                this.app.workspace.trigger("obsidian-git:head-change");

                const afterMergeCommit = await this.git.revparse([
                    branchInfo.current!,
                ]);

                const filesChanged = await this.git.diff([
                    `${localCommit}..${afterMergeCommit}`,
                    "--name-only",
                ]);

                return filesChanged
                    .split(/\r\n|\r|\n/)
                    .filter((value) => value.length > 0)
                    .map((e) => {
                        return <FileStatusResult>{
                            path: e,
                            workingDir: "P",
                            vaultPath: this.getRelativeVaultPath(e),
                        };
                    });
            } else {
                return [];
            }
        } catch (e) {
            this.convertErrors(e);
        }
    }

    async push(): Promise<number | undefined> {
        this.plugin.setPluginState({ gitAction: CurrentGitAction.push });
        try {
            if (this.plugin.settings.updateSubmodules) {
                const res = await this.git
                    .env({ ...process.env, OBSIDIAN_GIT: 1 })
                    .subModule([
                        "foreach",
                        "--recursive",
                        `tracking=$(git for-each-ref --format='%(upstream:short)' "$(git symbolic-ref -q HEAD)"); echo $tracking; if [ ! -z "$(git diff --shortstat $tracking)" ]; then git push; fi`,
                    ]);
                console.log(res);
            }
            const status = await this.git.status();
            const trackingBranch = status.tracking!;
            const currentBranch = status.current!;

            if (!trackingBranch && this.plugin.settings.updateSubmodules) {
                this.plugin.log(
                    "No tracking branch found. Ignoring push of main repo and updating submodules only."
                );
                return undefined;
            }

            const remoteChangedFiles = (
                await this.git.diffSummary([
                    currentBranch,
                    trackingBranch,
                    "--",
                ])
            ).changed;

            await this.git.env({ ...process.env, OBSIDIAN_GIT: 1 }).push();

            return remoteChangedFiles;
        } catch (e) {
            this.convertErrors(e);
        }
    }

    async getUnpushedCommits(): Promise<number> {
        const status = await this.git.status();
        const trackingBranch = status.tracking;
        const currentBranch = status.current;

        if (trackingBranch == null || currentBranch == null) {
            return 0;
        }

        const remoteChangedFiles = (
            await this.git.diffSummary([currentBranch, trackingBranch, "--"])
        ).changed;

        return remoteChangedFiles;
    }

    async canPush(): Promise<boolean> {
        // allow pushing in submodules even if the root has no changes.
        if (this.plugin.settings.updateSubmodules === true) {
            return true;
        }
        const status = await this.git.status();
        const trackingBranch = status.tracking;
        const currentBranch = status.current!;
        if (!trackingBranch) {
            return false;
        }
        const remoteChangedFiles = (
            await this.git.diffSummary([currentBranch, trackingBranch, "--"])
        ).changed;

        return remoteChangedFiles !== 0;
    }

    async checkRequirements(): Promise<
        "valid" | "missing-repo" | "missing-git"
    > {
        if (!this.isGitInstalled()) {
            return "missing-git";
        }
        if (!(await this.git.checkIsRepo())) {
            return "missing-repo";
        }
        return "valid";
    }

    async branchInfo(): Promise<BranchInfo> {
        const status = await this.git.status();
        const branches = await this.git.branch(["--no-color"]);

        return {
            current: status.current || undefined,
            tracking: status.tracking || undefined,
            branches: branches.all,
        };
    }

    async getRemoteUrl(remote: string): Promise<string | undefined> {
        try {
            return (await this.git.remote(["get-url", remote])) || undefined;
        } catch (error) {
            // Verify the error is at least not about git is not found or similar. Checks if the remote exists or not
            if (String(error).contains(remote)) {
                return undefined;
            } else {
                throw error;
            }
        }
    }

    // https://github.com/kometenstaub/obsidian-version-history-diff/issues/3
    async log(
        file: string | undefined,
        relativeToVault = true,
        limit?: number,
        ref?: string
    ): Promise<(LogEntry & { fileName?: string })[]> {
        let path: string | undefined;
        if (file) {
            path = this.getRelativeRepoPath(file, relativeToVault);
        }
        const opts: Record<string, unknown> = {
            file: path,
            maxCount: limit,
            // Ensures that the changed files are listed for merge commits as well and the commit is not repeated for each parent.
            // This only lists the changed files for the first parent.
            "--diff-merges": "first-parent",
            "--name-status": null,
        };
        if (ref) {
            opts[ref] = null;
        }
        const res = await this.git.log(opts);

        return res.all.map<LogEntry>((e) => ({
            ...e,
            author: {
                name: e.author_name,
                email: e.author_email,
            },
            refs: e.refs.split(", ").filter((e) => e.length > 0),
            diff: {
                ...e.diff!,
                files:
                    e.diff?.files.map<DiffFile>(
                        (f: simple.DiffResultNameStatusFile) => ({
                            ...f,
                            status: f.status!,
                            path: f.file,
                            hash: e.hash,
                            vaultPath: this.getRelativeVaultPath(f.file),
                            fromPath: f.from,
                            fromVaultPath:
                                f.from != undefined
                                    ? this.getRelativeVaultPath(f.from)
                                    : undefined,
                            binary: f.binary,
                        })
                    ) ?? [],
            },
            fileName: e.diff?.files.first()?.file,
        }));
    }

    async show(
        commitHash: string,
        file: string,
        relativeToVault = true
    ): Promise<string> {
        const path = this.getRelativeRepoPath(file, relativeToVault);

        return this.git.show([commitHash + ":" + path]);
    }

    async checkout(branch: string, remote?: string): Promise<void> {
        if (remote) {
            branch = `${remote}/${branch}`;
        }
        await this.git.checkout(branch);
        if (this.plugin.settings.submoduleRecurseCheckout) {
            const submodulePaths = await this.getSubmodulePaths();
            for (const submodulePath of submodulePaths) {
                const branchSummary = await this.git
                    .cwd({ path: submodulePath, root: false })
                    .branch();
                if (Object.keys(branchSummary.branches).includes(branch)) {
                    await this.git
                        .cwd({ path: submodulePath, root: false })
                        .checkout(branch);
                }
            }
        }
    }

    async createBranch(branch: string): Promise<void> {
        await this.git.checkout(["-b", branch]);
    }

    async deleteBranch(branch: string, force: boolean): Promise<void> {
        await this.git.branch([force ? "-D" : "-d", branch]);
    }

    async branchIsMerged(branch: string): Promise<boolean> {
        const notMergedBranches = await this.git.branch(["--no-merged"]);
        return !notMergedBranches.all.contains(branch);
    }

    async init(): Promise<void> {
        await this.git.init(false);
    }

    async clone(url: string, dir: string, depth?: number): Promise<void> {
        await this.git.clone(
            url,
            path.join(
                (this.app.vault.adapter as FileSystemAdapter).getBasePath(),
                dir
            ),
            depth ? ["--depth", `${depth}`] : []
        );
    }

    async setConfig(path: string, value: string | undefined): Promise<void> {
        if (value == undefined) {
            await this.git.raw(["config", "--local", "--unset", path]);
        } else {
            await this.git.addConfig(path, value);
        }
    }

    async getConfig(path: string): Promise<string | undefined> {
        const config = await this.git.listConfig("local");
        const res = config.all[path];
        if (typeof res === "string" || res == undefined) {
            return res;
        } else {
            throw new Error("Config value is not a string");
        }
    }

    async fetch(remote?: string): Promise<void> {
        await this.git.fetch(remote != undefined ? [remote] : []);
    }

    async setRemote(name: string, url: string): Promise<void> {
        if ((await this.getRemotes()).includes(name))
            await this.git.remote(["set-url", name, url]);
        else {
            await this.git.remote(["add", name, url]);
        }
    }

    async getRemoteBranches(remote: string): Promise<string[]> {
        const res = await this.git.branch(["-r", "--list", `${remote}*`]);

        const list = [];
        for (const item in res.branches) {
            list.push(res.branches[item].name);
        }
        return list;
    }

    async getRemotes() {
        const res = await this.git.remote([]);
        if (res) {
            return res.trim().split("\n");
        } else {
            return [];
        }
    }

    async removeRemote(remoteName: string) {
        await this.git.removeRemote(remoteName);
    }

    async updateUpstreamBranch(remoteBranch: string) {
        try {
            // git 1.8+
            await this.git.branch(["--set-upstream-to", remoteBranch]);
        } catch {
            try {
                // git 1.7 - 1.8
                await this.git.branch(["--set-upstream", remoteBranch]);
            } catch {
                // fallback for when setting upstream branch to a branch that does not exist on the remote yet. Setting it with push instead.
                await this.git.push(
                    // @ts-expect-error A type error occurs here because the third element could be undefined.
                    // However, it is unlikely to be undefined due to the `remoteBranch`'s format, and error handling is in place.
                    // Therefore, we temporarily ignore the error.
                    ["--set-upstream", ...splitRemoteBranch(remoteBranch)]
                );
            }
        }
    }

    updateGitPath(_: string): Promise<void> {
        return this.setGitInstance();
    }

    updateBasePath(_: string): Promise<void> {
        return this.setGitInstance(true);
    }

    async getDiffString(
        filePath: string,
        stagedChanges = false,
        hash?: string
    ): Promise<string> {
        if (stagedChanges)
            return await this.git.diff(["--cached", "--", filePath]);
        if (hash) return await this.git.show([`${hash}`, "--", filePath]);
        else return await this.git.diff(["--", filePath]);
    }

    async diff(
        file: string,
        commit1: string,
        commit2: string
    ): Promise<string> {
        return await this.git.diff([`${commit1}..${commit2}`, "--", file]);
    }

    async rawCommand(command: string): Promise<string> {
        const parts = command.split(" "); // Very simple parsing, may need string-argv
        const res = await this.git.raw(parts[0], ...parts.slice(1));
        return res;
    }

    async getSubmoduleOfFile(
        repositoryRelativeFile: string
    ): Promise<{ submodule: string; relativeFilepath: string } | undefined> {
        // Documentation: https://git-scm.com/docs/git-rev-parse

        if (
            !(await this.app.vault.adapter.exists(
                path.dirname(repositoryRelativeFile)
            ))
        ) {
            return undefined;
        }

        // git -C <dir-of-file> rev-parse --show-toplevel
        // returns the submodules repository root as an absolute path
        let submoduleRoot = await this.git.raw(
            [
                "-C",
                path.dirname(repositoryRelativeFile),
                "rev-parse",
                "--show-toplevel",
            ],
            (err) => err && console.warn("get-submodule-of-file", err?.message)
        );
        submoduleRoot = submoduleRoot.trim();

        // git -C <dir-of-file> rev-parse --show-superproject-working-tree
        // returns the parent git repository, if the file is in a submodule - otherwise empty.
        const superProject = await this.git.raw(
            [
                "-C",
                path.dirname(repositoryRelativeFile),
                "rev-parse",
                "--show-superproject-working-tree",
            ],
            (err) => err && console.warn("get-submodule-of-file", err?.message)
        );

        if (superProject.trim() === "") {
            return undefined; // not in submodule
        }

        const fsAdapter = this.app.vault.adapter as FileSystemAdapter;
        const absolutePath = fsAdapter.getFullPath(
            path.normalize(repositoryRelativeFile)
        );
        const newRelativePath = path.relative(submoduleRoot, absolutePath);

        return { submodule: submoduleRoot, relativeFilepath: newRelativePath };
    }

    async getLastCommitTime(): Promise<Date | undefined> {
        const res = await this.git.log({ n: 1 });
        if (res != null && res.latest != null) {
            return new Date(res.latest.date);
        }
    }

    private isGitInstalled(): boolean {
        // https://github.com/steveukx/git-js/issues/402
        const gitPath = this.plugin.localStorage.getGitPath();
        const command = spawnSync(gitPath || "git", ["--version"], {
            stdio: "ignore",
        });

        if (command.error) {
            if (Platform.isWin && !gitPath) {
                this.plugin.log(
                    `Git not found in PATH. Checking standard installation path(${DEFAULT_WIN_GIT_PATH}) of Git for Windows.`
                );
                const command = spawnSync(DEFAULT_WIN_GIT_PATH, ["--version"], {
                    stdio: "ignore",
                });
                if (command.error) {
                    console.error(command.error);
                    return false;
                } else {
                    this.useDefaultWindowsGitPath = true;
                }
            } else {
                console.error(command.error);
                return false;
            }
        } else {
            this.useDefaultWindowsGitPath = false;
        }
        return true;
    }

    private convertErrors(error: unknown): never {
        if (error instanceof GitError) {
            const message = String(error.message);
            const networkFailure =
                message.contains("Could not resolve host") ||
                message.contains("Unable to resolve host") ||
                message.match(
                    /ssh: connect to host .*? port .*?: Operation timed out/
                ) != null ||
                message.match(
                    /ssh: connect to host .*? port .*?: Network is unreachable/
                ) != null ||
                message.match(
                    /ssh: connect to host .*? port .*?: Undefined error: 0/
                ) != null;
            if (networkFailure) {
                throw new NoNetworkError(message);
            }
        }
        throw error;
    }

    async isFileTrackedByLFS(filePath: string): Promise<boolean> {
        try {
            // Checks if Gits filter attribute is set to lfs for the file, which means it is (or will be) tracked by LFS.
            const result = await this.git.raw([
                "check-attr",
                "filter",
                filePath,
            ]);
            return result.includes("filter: lfs");
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.plugin.displayError(
                `Error checking LFS status: ${errorMessage}`
            );
            return false;
        }
    }
}

export const zeroCommit: BlameCommit = {
    hash: "000000",
    isZeroCommit: true,
    summary: "",
};

// Parse git blame porcelain format: https://git-scm.com/docs/git-blame#_the_porcelain_format
function parseBlame(blameOutputUnnormalized: string): Blame {
    const blameOutput = blameOutputUnnormalized.replace("\r\n", "\n");

    const blameLines = blameOutput.split("\n");

    const result: Blame = {
        commits: new Map(),
        hashPerLine: [undefined!], // one-based indices
        originalFileLineNrPerLine: [undefined!],
        finalFileLineNrPerLine: [undefined!],
        groupSizePerStartingLine: new Map(),
    };

    let line = 1;
    for (let bi = 0; bi < blameLines.length; ) {
        if (startsWithNonWhitespace(blameLines[bi])) {
            const lineInfo = blameLines[bi].split(" ");

            const commitHash = parseLineInfoInto(lineInfo, line, result);
            bi++;

            // parse header values until a tab is encountered
            for (; startsWithNonWhitespace(blameLines[bi]); bi++) {
                const spaceSeparatedHeaderValues = blameLines[bi].split(" ");
                parseHeaderInto(spaceSeparatedHeaderValues, result, line);
            }
            finalizeBlameCommitInfo(result.commits.get(commitHash)!);

            // skip tab prefixed line
            line += 1;
        } else if (blameLines[bi] === "" && bi === blameLines.length - 1) {
            // EOF
        } else {
            throw Error(
                `Expected non-whitespace line or EOF, but found: ${blameLines[bi]}`
            );
        }
        bi++;
    }
    return result;
}

function parseLineInfoInto(lineInfo: string[], line: number, result: Blame) {
    const hash = lineInfo[0];
    result.hashPerLine.push(hash);
    result.originalFileLineNrPerLine.push(parseInt(lineInfo[1]));
    result.finalFileLineNrPerLine.push(parseInt(lineInfo[2]));
    if (lineInfo.length >= 4)
        result.groupSizePerStartingLine.set(line, parseInt(lineInfo[3]));

    if (parseInt(lineInfo[2]) !== line) {
        throw Error(
            `git-blame output is out of order: ${line} vs ${lineInfo[2]}`
        );
    }

    return hash;
}

function parseHeaderInto(header: string[], out: Blame, line: number) {
    const key = header[0];
    const value = header.slice(1).join(" ");
    const commitHash = out.hashPerLine[line];
    const commit =
        out.commits.get(commitHash) ||
        <BlameCommit>{
            hash: commitHash,
            author: {},
            committer: {},
            previous: {},
        };

    switch (key) {
        case "summary":
            commit.summary = value;
            break;

        case "author":
            commit.author!.name = value;
            break;
        case "author-mail":
            commit.author!.email = removeEmailBrackets(value);
            break;
        case "author-time":
            commit.author!.epochSeconds = parseInt(value);
            break;
        case "author-tz":
            commit.author!.tz = value;
            break;

        case "committer":
            commit.committer!.name = value;
            break;
        case "committer-mail":
            commit.committer!.email = removeEmailBrackets(value);
            break;
        case "committer-time":
            commit.committer!.epochSeconds = parseInt(value);
            break;
        case "committer-tz":
            commit.committer!.tz = value;
            break;

        case "previous":
            commit.previous!.commitHash = value;
            break;
        case "filename":
            commit.previous!.filename = value;
            break;
    }
    out.commits.set(commitHash, commit);
}

function finalizeBlameCommitInfo(commit: BlameCommit) {
    if (commit.summary === undefined) {
        throw Error(`Summary not provided for commit: ${commit.hash}`);
    }

    if (isUndefinedOrEmptyObject(commit.author)) {
        commit.author = undefined;
    }
    if (isUndefinedOrEmptyObject(commit.committer)) {
        commit.committer = undefined;
    }
    if (isUndefinedOrEmptyObject(commit.previous)) {
        commit.previous = undefined;
    }

    commit.isZeroCommit = Boolean(commit.hash.match(/^0*$/));
}

function isUndefinedOrEmptyObject(obj: object | undefined | null): boolean {
    return !obj || Object.keys(obj).length === 0;
}

function startsWithNonWhitespace(str: string): boolean {
    return str.length > 0 && str[0].trim() === str[0];
}

function removeEmailBrackets(gitEmail: string) {
    const prefixCleaned = gitEmail.startsWith("<")
        ? gitEmail.substring(1)
        : gitEmail;
    return prefixCleaned.endsWith(">")
        ? prefixCleaned.substring(0, prefixCleaned.length - 1)
        : prefixCleaned;
}
