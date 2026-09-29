import { Errors } from "isomorphic-git";
import { normalizePath, Notice, Platform, TFile, moment } from "obsidian";
import * as fsPromises from "fs/promises";
import { CustomMessageModal } from "src/ui/modals/customMessageModal";
import { IsomorphicGit } from "./gitManager/isomorphicGit";
import { SimpleGit } from "./gitManager/simpleGit";
import type {
    CommitAndSyncResult,
    CommitMode,
    CommitResult,
    CloneRepositoryResult,
    CreateBranchResult,
    DeleteBranchResult,
    DeleteRepositoryResult,
    DiscardActionResult,
    EditRemoteResult,
    FetchResult,
    FileStatusResult,
    InitRepositoryResult,
    ListChangedFilesResult,
    NotReadyResult,
    PullResult,
    PushResult,
    RawCommandResult,
    RemoveRemoteResult,
    SetUpstreamResult,
    SwitchBranchResult,
    UnstagedFile,
    FileStateMutationResult,
} from "./types";
import { GitConflictError } from "./types";
import { BranchModal } from "./ui/modals/branchModal";
import { ChangedFilesModal } from "./ui/modals/changedFilesModal";
import { GeneralModal } from "./ui/modals/generalModal";
import {
    convertPathToAbsoluteGitignoreRule,
    formatRemoteUrl,
    spawnAsync,
    splitRemoteBranch,
} from "./utils";
import { DiscardModal } from "./ui/modals/discardModal";
import { runGitAction, type GitActionResult } from "./gitAction";

import type ObsidianGit from "./main";

type CommitOptions = {
    fromAuto: boolean;
    requestCustomMessage?: boolean;
    mode?: CommitMode;
    commitMessage?: string;
    amend?: boolean;
};

type CommitAndSyncOptions = {
    fromAutoBackup: boolean;
    requestCustomMessage?: boolean;
    commitMessage?: string;
    mode?: CommitMode;
};

export class GitActions {
    constructor(private readonly plugin: ObsidianGit) {}

    async addFileToGitignore(
        filePath: string,
        isFolder?: boolean
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(async () => {
            const gitRelativePath = this.plugin.gitManager.getRelativeRepoPath(
                filePath,
                true
            );
            // Define an absolute rule that can apply only for this item.
            const gitignoreRule = convertPathToAbsoluteGitignoreRule({
                isFolder,
                gitRelativePath,
            });
            await this.plugin.app.vault.adapter.append(
                this.plugin.gitManager.getRelativeVaultPath(".gitignore"),
                "\n" + gitignoreRule
            );
        });
    }

    async createNewRepo(): Promise<GitActionResult<InitRepositoryResult>> {
        const actionResult = await runGitAction<InitRepositoryResult>(
            this.plugin,
            async () => {
                await this.plugin.gitManager.init();
                await this.plugin.init({ fromReload: true });
                return { status: "initialized" };
            }
        );
        if (actionResult.status === "success") {
            this.reportInitRepositoryResult(actionResult.value);
        }
        return actionResult;
    }

    private reportInitRepositoryResult(result: InitRepositoryResult): void {
        switch (result.status) {
            case "initialized":
                this.plugin.displayMessage("Initialized new repo");
                return;
        }
    }

    async deleteRepository(): Promise<GitActionResult<DeleteRepositoryResult>> {
        const actionResult = await runGitAction<DeleteRepositoryResult>(
            this.plugin,
            async () => {
                const repositoryPath = this.plugin.settings.basePath
                    ? `${this.plugin.settings.basePath}/.git`
                    : ".git";
                if (
                    !(await this.plugin.app.vault.adapter.exists(
                        repositoryPath
                    ))
                ) {
                    return { status: "not-found" };
                }

                const shouldDelete =
                    (await new GeneralModal(this.plugin, {
                        options: ["NO", "YES"],
                        placeholder:
                            "Do you really want to delete the repository (.git directory)? This action cannot be undone.",
                        onlySelection: true,
                    }).openAndGetResult()) === "YES";
                if (!shouldDelete) {
                    return { status: "cancelled" };
                }

                await this.plugin.app.vault.adapter.rmdir(repositoryPath, true);
                return { status: "deleted" };
            }
        );
        if (actionResult.status === "success") {
            this.reportDeleteRepositoryResult(actionResult.value);
            if (actionResult.value.status === "deleted") {
                this.plugin.unloadPlugin();
                await this.plugin.init({ fromReload: true });
            }
        }
        return actionResult;
    }

    private reportDeleteRepositoryResult(result: DeleteRepositoryResult): void {
        switch (result.status) {
            case "deleted":
                this.plugin.displayMessage(
                    "Successfully deleted repository. Reloading plugin..."
                );
                return;
            case "not-found":
                this.plugin.displayMessage("No repository found");
                return;
            case "cancelled":
                return;
        }
    }

    async cloneNewRepo(): Promise<GitActionResult<CloneRepositoryResult>> {
        const actionResult = await runGitAction<CloneRepositoryResult>(
            this.plugin,
            () => this.performCloneNewRepo()
        );
        if (actionResult.status === "success") {
            this.reportCloneRepositoryResult(actionResult.value);
        }
        return actionResult;
    }

    private async performCloneNewRepo(): Promise<CloneRepositoryResult> {
        const url = await new GeneralModal(this.plugin, {
            placeholder: "Enter remote URL",
        }).openAndGetResult();
        if (!url) {
            return { status: "cancelled", reason: "no-url" };
        }

        const confirmOption = "Vault Root";
        let dir = await new GeneralModal(this.plugin, {
            options:
                this.plugin.gitManager instanceof IsomorphicGit
                    ? [confirmOption]
                    : [],
            placeholder:
                "Enter directory for clone. It needs to be empty or not existent.",
            allowEmpty: this.plugin.gitManager instanceof IsomorphicGit,
        }).openAndGetResult();
        if (dir === undefined) {
            return { status: "cancelled", reason: "no-directory" };
        }
        if (dir === confirmOption) {
            dir = ".";
        }

        dir = normalizePath(dir);
        if (dir === "/") {
            dir = ".";
        }

        if (dir === ".") {
            const containsConflictDir = await new GeneralModal(this.plugin, {
                options: ["NO", "YES"],
                placeholder: `Does your remote repo contain a ${this.plugin.app.vault.configDir} directory at the root?`,
                onlySelection: true,
            }).openAndGetResult();
            if (containsConflictDir === undefined) {
                return { status: "cancelled", reason: "safety-declined" };
            } else if (containsConflictDir === "YES") {
                const deleteConfirmation =
                    "DELETE ALL YOUR LOCAL CONFIG AND PLUGINS";
                const shouldDelete =
                    (await new GeneralModal(this.plugin, {
                        options: ["Abort clone", deleteConfirmation],
                        placeholder: `To avoid conflicts, the local ${this.plugin.app.vault.configDir} directory needs to be deleted.`,
                        onlySelection: true,
                    }).openAndGetResult()) === deleteConfirmation;
                if (!shouldDelete) {
                    return { status: "cancelled", reason: "safety-declined" };
                }
                await this.plugin.app.vault.adapter.rmdir(
                    this.plugin.app.vault.configDir,
                    true
                );
            }
        }

        const depth = await new GeneralModal(this.plugin, {
            placeholder: "Specify depth of clone. Leave empty for full clone.",
            allowEmpty: true,
        }).openAndGetResult();
        if (depth === undefined) {
            return { status: "cancelled", reason: "no-depth" };
        }

        let depthInt: number | undefined;
        if (depth !== "") {
            depthInt = parseInt(depth);
            if (isNaN(depthInt)) {
                return { status: "invalid", reason: "depth" };
            }
        }

        new Notice(`Cloning new repo into "${dir}"`);
        const oldBase = this.plugin.settings.basePath;
        const customDir = dir !== ".";
        if (customDir) {
            this.plugin.settings.basePath = dir;
        }
        try {
            await this.plugin.gitManager.clone(
                formatRemoteUrl(url),
                dir,
                depthInt
            );
            if (customDir) {
                await this.plugin.saveSettings();
            }
            return { status: "cloned" };
        } catch (error) {
            this.plugin.settings.basePath = oldBase;
            await this.plugin.saveSettings();
            throw error;
        }
    }

    private reportCloneRepositoryResult(result: CloneRepositoryResult): void {
        switch (result.status) {
            case "cloned":
                this.plugin.displayMessage("Cloned new repo.");
                this.plugin.displayMessage("Please restart Obsidian");
                return;
            case "cancelled": {
                const reason = result.reason;
                switch (reason) {
                    case "safety-declined":
                    case "no-depth":
                        this.plugin.displayMessage("Aborted clone");
                        return;
                    case "no-url":
                    case "no-directory":
                        return;
                }
                return;
            }
            case "invalid": {
                const reason = result.reason;
                switch (reason) {
                    case "depth":
                        this.plugin.displayMessage(
                            "Invalid depth. Aborting clone."
                        );
                        return;
                }
            }
        }
    }

    private runReadyGitAction<T>(
        action: () => Promise<T>
    ): Promise<GitActionResult<T | NotReadyResult>> {
        return runGitAction(this.plugin, async () => {
            if (!(await this.plugin.isAllInitialized())) {
                return { status: "skipped", reason: "not-ready" };
            }
            return action();
        });
    }

    async listChangedFiles(): Promise<GitActionResult<ListChangedFilesResult>> {
        const actionResult =
            await this.runReadyGitAction<ListChangedFilesResult>(async () => {
                const status = await this.plugin.updateCachedStatus();
                const files = status.changed.length + status.staged.length;
                if (files > 500) {
                    return {
                        status: "blocked",
                        reason: "too-many-changes",
                        files,
                    };
                }

                new ChangedFilesModal(this.plugin, status.all).open();
                return { status: "displayed" };
            });
        if (actionResult.status === "success") {
            this.reportListChangedFilesResult(actionResult.value);
        }
        return actionResult;
    }

    private reportListChangedFilesResult(result: ListChangedFilesResult): void {
        switch (result.status) {
            case "displayed":
            case "skipped":
                return;
            case "blocked": {
                const reason = result.reason;
                switch (reason) {
                    case "too-many-changes":
                        this.plugin.displayError("Too many changes to display");
                        return;
                }
            }
        }
    }

    ///Used for command
    async pullChangesFromRemote(): Promise<void> {
        const actionResult = await this.pull();
        if (actionResult.status !== "success") {
            return;
        }
        const pullResult = actionResult.value;
        if (pullResult.status === "skipped") {
            return;
        }
        this.reportPullResult(pullResult);
        this.plugin.app.workspace.trigger("obsidian-git:refresh");
    }

    private reportPullResult(result: PullResult): void {
        switch (result.status) {
            case "updated":
                this.plugin.displayMessage(
                    `Pulled ${result.files.length} ${
                        result.files.length == 1 ? "file" : "files"
                    } from remote`
                );
                this.plugin.lastPulledFiles = result.files;
                return;
            case "up-to-date":
                this.plugin.displayMessage("Pull: Everything is up-to-date");
                return;
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "not-ready":
                    case "no-upstream":
                        return;
                }
            }
        }
    }

    private resolveCommitMode(
        mode: CommitMode,
        stagedCount: number
    ): Exclude<CommitMode, "smart"> | "nothing" {
        if (mode === "all") return "all";
        if (stagedCount > 0) return "staged";
        if (mode === "staged") return "nothing";
        return this.plugin.settings.autoStageOnEmptyIndex ? "all" : "nothing";
    }

    async commitAndSync(
        options: CommitAndSyncOptions
    ): Promise<GitActionResult<CommitAndSyncResult>> {
        return this.runReadyGitAction<CommitAndSyncResult>(() =>
            this.performCommitAndSync(options)
        );
    }

    private async performCommitAndSync({
        fromAutoBackup,
        requestCustomMessage = false,
        commitMessage,
        mode = "all",
    }: CommitAndSyncOptions): Promise<CommitAndSyncResult> {
        if (
            this.plugin.settings.syncMethod == "reset" &&
            this.plugin.settings.pullBeforePush
        ) {
            this.reportPullResult(await this.performPull());
        }

        const commitResult = await this.performCommit({
            fromAuto: fromAutoBackup,
            requestCustomMessage,
            commitMessage,
            mode,
        });
        this.reportCommitResult(commitResult);
        switch (commitResult.status) {
            case "committed":
            case "nothing-to-commit":
                break;
            case "skipped":
                return {
                    status: "skipped",
                    reason: "commit-skipped",
                    commit: commitResult,
                };
        }

        if (
            this.plugin.settings.syncMethod != "reset" &&
            this.plugin.settings.pullBeforePush
        ) {
            this.reportPullResult(await this.performPull());
        }

        if (this.plugin.settings.disablePush) {
            return {
                status: "commit-only",
                reason: "push-disabled",
                commit: commitResult,
            };
        }

        if (!(await this.isPushRemoteSet())) {
            return {
                status: "skipped",
                reason: "push-skipped",
                commit: commitResult,
            };
        }

        // Prevent trying to push every time. Only if unpushed commits are present
        if (await this.plugin.gitManager.canPush()) {
            const pushResult = await this.performPush();
            this.reportPushResult(pushResult);
            switch (pushResult.status) {
                case "pushed":
                    return { status: "synced", commit: commitResult };
                case "up-to-date":
                    return {
                        status: "nothing-to-push",
                        commit: commitResult,
                    };
                case "blocked":
                case "skipped":
                    return {
                        status: "skipped",
                        reason: "push-skipped",
                        commit: commitResult,
                    };
            }
        }

        this.reportPushResult({ status: "up-to-date" });
        return { status: "nothing-to-push", commit: commitResult };
    }

    async commit(
        options: CommitOptions
    ): Promise<GitActionResult<CommitResult>> {
        const actionResult = await this.runReadyGitAction<CommitResult>(() =>
            this.performCommit(options)
        );
        if (actionResult.status === "success") {
            this.reportCommitResult(actionResult.value);
        }
        return actionResult;
    }

    private async performCommit({
        fromAuto,
        requestCustomMessage = false,
        mode = "all",
        commitMessage,
        amend = false,
    }: CommitOptions): Promise<CommitResult> {
        let stagedFiles: { vaultPath: string; path: string }[] = [];
        let unstagedFiles: (UnstagedFile & { vaultPath: string })[] = [];
        let resolvedMode: Exclude<CommitMode, "smart"> | "nothing" =
            mode === "smart" ? "nothing" : mode;

        const status = await this.plugin.updateCachedStatus();
        const mergeInProgress = this.plugin.state.mergeInProgress;
        if (this.plugin.gitManager instanceof SimpleGit) {
            stagedFiles = status.staged;

            // This typecast is only needed to hide the fact that `type` is missing, but that is only needed for isomorphic-git
            unstagedFiles = status.changed as unknown as (UnstagedFile & {
                vaultPath: string;
            })[];
            resolvedMode = this.resolveCommitMode(mode, stagedFiles.length);
        } else {
            // isomorphic-git section

            const gitManager = this.plugin.gitManager as IsomorphicGit;
            stagedFiles = await gitManager.getStagedFiles();
            resolvedMode = this.resolveCommitMode(mode, stagedFiles.length);
            if (resolvedMode === "all") {
                const res = await gitManager.getUnstagedFiles();
                unstagedFiles = res.map(({ path, type }) => ({
                    vaultPath:
                        this.plugin.gitManager.getRelativeVaultPath(path),
                    path,
                    type,
                }));
            }
        }

        if (fromAuto && mergeInProgress) {
            if (status.conflicted.length > 0) {
                throw new GitConflictError(
                    status.conflicted,
                    new Error(
                        "Automatic commit stopped because of unresolved conflicts"
                    )
                );
            }
            return { status: "skipped", reason: "merge-in-progress" };
        }

        if (resolvedMode === "nothing") {
            return {
                status: "nothing-to-commit",
                reason: "nothing-staged",
            };
        }

        const onlyStaged = resolvedMode === "staged";

        if (
            await this.plugin.tools.hasTooBigFiles(
                onlyStaged ? stagedFiles : [...stagedFiles, ...unstagedFiles]
            )
        ) {
            return { status: "skipped", reason: "files-too-large" };
        }

        const changesCountToCommit =
            (onlyStaged ? 0 : unstagedFiles.length) + stagedFiles.length !== 0;
        if (changesCountToCommit || mergeInProgress) {
            // The commit message from settings or previously set in the
            // source control view
            let cmtMessage = (commitMessage ??= fromAuto
                ? this.plugin.settings.autoCommitMessage
                : this.plugin.settings.commitMessage);

            // Optionally ask the user via a modal for a commit message
            if (
                (fromAuto && this.plugin.settings.customMessageOnAutoBackup) ||
                requestCustomMessage
            ) {
                if (!this.plugin.settings.disablePopups && fromAuto) {
                    new Notice(
                        "Auto backup: Please enter a custom commit message. Leave empty to abort"
                    );
                }
                const modalMessage = await new CustomMessageModal(
                    this.plugin
                ).openAndGetResult();

                if (
                    modalMessage != undefined &&
                    modalMessage != "" &&
                    modalMessage != "..."
                ) {
                    cmtMessage = modalMessage;
                } else {
                    throw new Errors.UserCanceledError();
                }

                // On desktop may run a script to get the commit message
            } else if (
                this.plugin.gitManager instanceof SimpleGit &&
                this.plugin.settings.commitMessageScript
            ) {
                cmtMessage = await this.getMessageFromScript(cmtMessage);
            }

            // Check if commit message is empty after all processing
            if (!cmtMessage || cmtMessage.trim() === "") {
                throw new Errors.UserCanceledError();
            }

            let committedFiles: number;
            if (onlyStaged) {
                committedFiles = await this.plugin.gitManager.commit({
                    message: cmtMessage,
                    amend,
                });
            } else {
                committedFiles = await this.plugin.gitManager.commitAll({
                    message: cmtMessage,
                    status,
                    unstagedFiles,
                    amend,
                });
            }

            // Handle eventually resolved conflicts
            if (this.plugin.gitManager instanceof SimpleGit) {
                await this.plugin.updateCachedStatus();
            }

            this.plugin.app.workspace.trigger("obsidian-git:refresh");
            if (committedFiles === 0) {
                // simple-git resolves with { changes: 0 } instead of
                // throwing when there is nothing to commit (e.g. the
                // detected change was already committed by a previous run).
                return {
                    status: "nothing-to-commit",
                    reason: "no-changes",
                };
            }
            return { status: "committed", files: committedFiles };
        } else {
            this.plugin.app.workspace.trigger("obsidian-git:refresh");
            return {
                status: "nothing-to-commit",
                reason: "no-changes",
            };
        }
    }

    private async getMessageFromScript(cmtMessage: string) {
        const templateScript = this.plugin.settings.commitMessageScript;
        const hostname = this.plugin.localStorage.getHostname() || "";
        let formattedScript = templateScript.replace("{{hostname}}", hostname);

        formattedScript = formattedScript.replace(
            "{{date}}",
            moment().format(this.plugin.settings.commitDateFormat)
        );
        let shPath = "sh";
        if (Platform.isWin) {
            shPath = process.env.PROGRAMFILES + "\\Git\\bin\\sh.exe";
            let shExists = false;
            try {
                await fsPromises.access(shPath, fsPromises.constants.X_OK);
                shExists = true;
            } catch {
                shExists = false;
            }

            if (!shExists) {
                throw new Error(
                    `Cannot find sh.exe at ${shPath}. Please make sure Git is properly installed.`
                );
            }
        }

        const res = await spawnAsync(shPath, ["-c", formattedScript], {
            cwd: (this.plugin.gitManager as SimpleGit).absoluteRepoPath,
        });
        if (res.code != 0) {
            throw new Error(
                res.stderr ||
                    `Commit message script exited with code ${res.code}`
            );
        } else if (res.stdout.trim().length == 0) {
            this.plugin.displayMessage(
                "Stdout from commit message script is empty. Using default message."
            );
        } else {
            cmtMessage = res.stdout;
        }
        return cmtMessage;
    }

    private reportCommitResult(result: CommitResult): void {
        switch (result.status) {
            case "committed":
                this.plugin.displayMessage(
                    `Committed ${result.files} ${
                        result.files == 1 ? "file" : "files"
                    }`
                );
                return;
            case "nothing-to-commit": {
                const reason = result.reason;
                switch (reason) {
                    case "nothing-staged":
                        this.plugin.displayMessage(
                            "Nothing staged. Stage changes first or use Commit all changes."
                        );
                        return;
                    case "no-changes":
                        this.plugin.displayMessage("No changes to commit");
                        return;
                }
                return;
            }
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "merge-in-progress":
                        this.plugin.displayError(
                            "Did not commit automatically because a merge is in progress. Commit it manually."
                        );
                        return;
                    case "not-ready":
                    case "files-too-large":
                        return;
                }
            }
        }
    }

    async push(): Promise<GitActionResult<PushResult>> {
        const actionResult = await this.runReadyGitAction<PushResult>(() =>
            this.performPush()
        );
        if (actionResult.status === "success") {
            this.reportPushResult(actionResult.value);
        }
        return actionResult;
    }

    private async performPush(): Promise<PushResult> {
        if (!(await this.isPushRemoteSet())) {
            return { status: "skipped", reason: "no-upstream" };
        }
        // Refresh because of pull
        const status = await this.plugin.updateCachedStatus();
        if (status.conflicted.length > 0) {
            return {
                status: "blocked",
                reason: "conflicts",
                files: status.conflicted.length,
            };
        } else if (this.plugin.state.mergeInProgress) {
            return { status: "blocked", reason: "merge-in-progress" };
        }
        // Squash local unpushed commits into one before pushing, so frequent
        // local commits don't clutter the remote history. Only unpushed
        // history is rewritten (no force-push). Conflicts are excluded above.
        if (
            this.plugin.settings.squashCommitsBeforePush &&
            this.plugin.gitManager instanceof SimpleGit
        ) {
            await this.plugin.gitManager.squashAllUnpushedCommits();
        }
        this.plugin.log("Pushing....");
        const result = await this.plugin.gitManager.push();
        this.plugin.setPluginState({ offlineMode: false });
        this.plugin.app.workspace.trigger("obsidian-git:refresh");
        return result;
    }

    private reportPushResult(result: PushResult): void {
        switch (result.status) {
            case "pushed":
                if (result.files === null) {
                    this.plugin.displayMessage("Pushed to remote");
                } else {
                    this.plugin.displayMessage(
                        `Pushed ${result.files} ${
                            result.files == 1 ? "file" : "files"
                        } to remote`
                    );
                }
                return;
            case "up-to-date":
                this.plugin.displayMessage("No commits to push");
                return;
            case "blocked": {
                const reason = result.reason;
                switch (reason) {
                    case "no-branch":
                        this.plugin.displayError(
                            "No current branch found. Cannot push."
                        );
                        return;
                    case "conflicts":
                        this.plugin.displayError(
                            `Cannot push. You have conflicts in ${
                                result.files
                            } ${result.files == 1 ? "file" : "files"}`
                        );
                        return;
                    case "merge-in-progress":
                        this.plugin.displayError(
                            "Cannot push while a merge is still in progress"
                        );
                        return;
                }
                return;
            }
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "not-ready":
                    case "no-upstream":
                        return;
                }
            }
        }
    }

    async pull(): Promise<GitActionResult<PullResult>> {
        return this.runReadyGitAction<PullResult>(() => this.performPull());
    }

    private async performPull(): Promise<PullResult> {
        if (!(await this.isPullRemoteSet())) {
            return { status: "skipped", reason: "no-upstream" };
        }
        this.plugin.log("Pulling....");
        const result = await this.plugin.gitManager.pull();
        this.plugin.setPluginState({ offlineMode: false });
        return result;
    }

    async fetch(): Promise<GitActionResult<FetchResult>> {
        const actionResult = await this.runReadyGitAction<FetchResult>(
            async () => {
                if (!(await this.isPushRemoteSet())) {
                    return { status: "skipped", reason: "no-upstream" };
                }
                await this.plugin.gitManager.fetch();
                this.plugin.setPluginState({ offlineMode: false });
                this.plugin.app.workspace.trigger("obsidian-git:refresh");
                return { status: "fetched" };
            }
        );
        if (actionResult.status === "success") {
            this.reportFetchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportFetchResult(result: FetchResult): void {
        switch (result.status) {
            case "fetched":
                this.plugin.displayMessage("Fetched from remote");
                return;
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "not-ready":
                    case "no-upstream":
                        return;
                }
            }
        }
    }

    async stageFile(
        file: TFile
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.stage(file.path, true);
    }

    async stage(
        path: string,
        relativeToVault: boolean
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.plugin.gitManager.stage(path, relativeToVault)
        );
    }

    async stageAll(
        path?: string
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.plugin.gitManager.stageAll({ dir: path })
        );
    }

    async unstageFile(
        file: TFile
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.unstage(file.path, true);
    }

    async unstage(
        path: string,
        relativeToVault: boolean
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.plugin.gitManager.unstage(path, relativeToVault)
        );
    }

    async unstageAll(
        path?: string
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.plugin.gitManager.unstageAll({ dir: path })
        );
    }

    async applyPatch(
        patch: string
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(async () => {
            if (!(this.plugin.gitManager instanceof SimpleGit)) {
                throw new Error(
                    "Applying a patch is only supported on desktop"
                );
            }
            await this.plugin.gitManager.applyPatch(patch);
        });
    }

    private async runFileStateMutation(
        action: () => Promise<void>
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runReadyGitAction<FileStateMutationResult>(async () => {
            await action();
            this.plugin.app.workspace.trigger("obsidian-git:refresh");
            return { status: "updated" };
        });
    }

    async setGitConfig(
        path: string,
        value: string | number | boolean | undefined
    ): Promise<GitActionResult<void>> {
        return runGitAction(this.plugin, () =>
            this.plugin.gitManager.setConfig(path, value)
        );
    }

    async runRawCommand(
        command: string
    ): Promise<GitActionResult<RawCommandResult>> {
        const notice = new Notice(`Running '${command}'...`, 999_999);
        const actionResult = await runGitAction<RawCommandResult>(
            this.plugin,
            async () => {
                if (!(this.plugin.gitManager instanceof SimpleGit)) {
                    throw new Error(
                        "Raw Git commands are only supported on desktop"
                    );
                }
                return {
                    status: "completed",
                    output: await this.plugin.gitManager.rawCommand(command),
                };
            }
        );
        if (actionResult.status === "success" && actionResult.value.output) {
            notice.setMessage(actionResult.value.output);
            window.setTimeout(() => notice.hide(), 5000);
        } else {
            notice.hide();
        }
        return actionResult;
    }

    async switchBranch(): Promise<GitActionResult<SwitchBranchResult>> {
        const actionResult = await this.runReadyGitAction<SwitchBranchResult>(
            async () => {
                const branchInfo = await this.plugin.gitManager.branchInfo();
                const selectedBranch = await new BranchModal(
                    this.plugin,
                    branchInfo.branches
                ).openAndGetReslt();
                if (selectedBranch === undefined) {
                    return { status: "cancelled" };
                }

                await this.plugin.gitManager.checkout(selectedBranch);
                this.plugin.app.workspace.trigger("obsidian-git:refresh");
                await this.plugin.branchBar?.display();
                return { status: "switched", branch: selectedBranch };
            }
        );
        if (actionResult.status === "success") {
            this.reportSwitchBranchResult(actionResult.value);
        }
        return actionResult;
    }

    async switchRemoteBranch(): Promise<GitActionResult<SwitchBranchResult>> {
        const actionResult = await this.runReadyGitAction<SwitchBranchResult>(
            async () => {
                const selectedBranch = await this.selectRemoteBranch();
                if (selectedBranch === undefined) {
                    return { status: "cancelled" };
                }
                const [remote, branch] = splitRemoteBranch(selectedBranch);
                if (branch === undefined || remote === undefined) {
                    return { status: "cancelled" };
                }

                await this.plugin.gitManager.checkout(branch, remote);
                await this.plugin.branchBar?.display();
                return { status: "switched", branch: selectedBranch };
            }
        );
        if (actionResult.status === "success") {
            this.reportSwitchBranchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportSwitchBranchResult(result: SwitchBranchResult): void {
        switch (result.status) {
            case "switched":
                this.plugin.displayMessage(`Switched to ${result.branch}`);
                return;
            case "cancelled":
            case "skipped":
                return;
        }
    }

    async createBranch(): Promise<GitActionResult<CreateBranchResult>> {
        const actionResult = await this.runReadyGitAction<CreateBranchResult>(
            async () => {
                const branch = await new GeneralModal(this.plugin, {
                    placeholder: "Create new branch",
                }).openAndGetResult();
                if (branch === undefined) {
                    return { status: "cancelled" };
                }

                await this.plugin.gitManager.createBranch(branch);
                await this.plugin.branchBar?.display();
                return { status: "created", branch };
            }
        );
        if (actionResult.status === "success") {
            this.reportCreateBranchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportCreateBranchResult(result: CreateBranchResult): void {
        switch (result.status) {
            case "created":
                this.plugin.displayMessage(
                    `Created new branch ${result.branch}`
                );
                return;
            case "cancelled":
            case "skipped":
                return;
        }
    }

    async deleteBranch(): Promise<GitActionResult<DeleteBranchResult>> {
        const actionResult = await this.runReadyGitAction<DeleteBranchResult>(
            async () => {
                const branchInfo = await this.plugin.gitManager.branchInfo();
                if (branchInfo.current) {
                    branchInfo.branches.remove(branchInfo.current);
                }
                const branch = await new GeneralModal(this.plugin, {
                    options: branchInfo.branches,
                    placeholder: "Delete branch",
                    onlySelection: true,
                }).openAndGetResult();
                if (branch === undefined) {
                    return { status: "cancelled" };
                }

                let force = false;
                const merged =
                    await this.plugin.gitManager.branchIsMerged(branch);
                if (!merged) {
                    const forceAnswer = await new GeneralModal(this.plugin, {
                        options: ["YES", "NO"],
                        placeholder:
                            "This branch isn't merged into HEAD. Force delete?",
                        onlySelection: true,
                    }).openAndGetResult();
                    if (forceAnswer !== "YES") {
                        return { status: "cancelled" };
                    }
                    force = true;
                }
                await this.plugin.gitManager.deleteBranch(branch, force);
                await this.plugin.branchBar?.display();
                return { status: "deleted", branch };
            }
        );
        if (actionResult.status === "success") {
            this.reportDeleteBranchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportDeleteBranchResult(result: DeleteBranchResult): void {
        switch (result.status) {
            case "deleted":
                this.plugin.displayMessage(`Deleted branch ${result.branch}`);
                return;
            case "cancelled":
            case "skipped":
                return;
        }
    }

    private async canAutoSetupPushRemote(): Promise<boolean> {
        return (
            this.plugin.gitManager instanceof SimpleGit &&
            (await this.plugin.gitManager.getConfig(
                "push.autoSetupRemote",
                "all"
            )) == "true"
        );
    }

    /**
     * A pull needs an existing upstream. When Git is configured to create the
     * upstream on the first push, skip the pull and let that push establish it.
     */
    async isPullRemoteSet(): Promise<boolean> {
        if (this.plugin.settings.updateSubmodules) {
            return true;
        }
        if ((await this.plugin.gitManager.branchInfo()).tracking) {
            return true;
        }
        if (await this.canAutoSetupPushRemote()) {
            new Notice(
                "Upstream branch will be created on first push. Skipping pull.\nUse set upstream branch command to set it manually if desired."
            );
            return false;
        }
        new Notice("No upstream branch is set. Please select one.");
        const result = await this.performSetUpstreamBranch();
        this.reportSetUpstreamResult(result);
        return result.status === "updated";
    }

    /**
     * A push can proceed without an existing upstream when Git is configured
     * to create it automatically.
     */
    async isPushRemoteSet(): Promise<boolean> {
        if (
            this.plugin.settings.updateSubmodules ||
            (await this.canAutoSetupPushRemote())
        ) {
            return true;
        }
        if (!(await this.plugin.gitManager.branchInfo()).tracking) {
            new Notice("No upstream branch is set. Please select one.");
            const result = await this.performSetUpstreamBranch();
            this.reportSetUpstreamResult(result);
            return result.status === "updated";
        }
        return true;
    }

    async setUpstreamBranch(): Promise<GitActionResult<SetUpstreamResult>> {
        const actionResult = await this.runReadyGitAction<SetUpstreamResult>(
            async () => {
                return this.performSetUpstreamBranch();
            }
        );
        if (actionResult.status === "success") {
            this.reportSetUpstreamResult(actionResult.value);
        }
        return actionResult;
    }

    private async performSetUpstreamBranch(): Promise<SetUpstreamResult> {
        const remoteBranch = await this.selectRemoteBranch();

        if (remoteBranch == undefined) {
            return { status: "cancelled" };
        }
        await this.plugin.gitManager.updateUpstreamBranch(remoteBranch);
        return { status: "updated", branch: remoteBranch };
    }

    private reportSetUpstreamResult(result: SetUpstreamResult): void {
        switch (result.status) {
            case "updated":
                this.plugin.displayMessage(
                    `Set upstream branch to ${result.branch}`
                );
                return;
            case "cancelled":
                this.plugin.displayError(
                    "Aborted. No upstream-branch is set!",
                    10000
                );
                return;
            case "skipped":
                return;
        }
    }

    async discardFile(
        file: FileStatusResult
    ): Promise<GitActionResult<DiscardActionResult>> {
        const actionResult = await this.runReadyGitAction<DiscardActionResult>(
            async () => {
                const deleteFile = file.workingDir === "U";
                const selection = await new DiscardModal({
                    app: this.plugin.app,
                    filesToDeleteCount: deleteFile ? 1 : 0,
                    filesToDiscardCount: deleteFile ? 0 : 1,
                    path: file.vaultPath,
                }).openAndGetResult();
                if (selection === false) {
                    return { status: "cancelled" };
                }

                if (selection === "delete") {
                    const tFile = this.plugin.app.vault.getAbstractFileByPath(
                        file.vaultPath
                    );
                    if (tFile) {
                        await this.plugin.app.fileManager.trashFile(tFile);
                    } else {
                        await this.plugin.app.vault.adapter.remove(
                            file.vaultPath
                        );
                    }
                } else {
                    await this.plugin.gitManager.discard(file.path);
                }
                this.plugin.app.workspace.trigger("obsidian-git:refresh");
                return { status: "discarded", target: "file" };
            }
        );
        if (actionResult.status === "success") {
            this.reportDiscardResult(actionResult.value, false);
        }
        return actionResult;
    }

    async discardAll(
        path?: string
    ): Promise<GitActionResult<DiscardActionResult>> {
        const actionResult = await this.runReadyGitAction<DiscardActionResult>(
            async () => {
                const status = await this.plugin.gitManager.status({ path });
                let filesToDeleteCount = 0;
                let filesToDiscardCount = 0;
                for (const file of status.changed) {
                    if (file.workingDir == "U") {
                        filesToDeleteCount++;
                    } else {
                        filesToDiscardCount++;
                    }
                }
                if (filesToDeleteCount + filesToDiscardCount == 0) {
                    return { status: "skipped", reason: "no-changes" };
                }

                const selection = await new DiscardModal({
                    app: this.plugin.app,
                    filesToDeleteCount,
                    filesToDiscardCount,
                    path: path ?? "",
                }).openAndGetResult();
                if (selection === false) {
                    return { status: "cancelled" };
                }

                await this.plugin.gitManager.discardAll({ dir: path, status });
                if (selection === "delete") {
                    const untrackedPaths =
                        await this.plugin.gitManager.getUntrackedPaths({
                            path,
                            status,
                        });
                    for (const file of untrackedPaths) {
                        const vaultPath =
                            this.plugin.gitManager.getRelativeVaultPath(file);
                        const tFile =
                            this.plugin.app.vault.getAbstractFileByPath(
                                vaultPath
                            );

                        if (tFile) {
                            await this.plugin.app.fileManager.trashFile(tFile);
                        } else if (file.endsWith("/")) {
                            await this.plugin.app.vault.adapter.rmdir(
                                vaultPath,
                                true
                            );
                        } else {
                            await this.plugin.app.vault.adapter.remove(
                                vaultPath
                            );
                        }
                    }
                }
                this.plugin.app.workspace.trigger("obsidian-git:refresh");
                return {
                    status: "discarded",
                    target: selection === "delete" ? "all" : "tracked",
                };
            }
        );
        if (actionResult.status === "success") {
            this.reportDiscardResult(actionResult.value, path === undefined);
        }
        return actionResult;
    }

    private reportDiscardResult(
        result: DiscardActionResult,
        showSuccess: boolean
    ): void {
        switch (result.status) {
            case "discarded":
                if (!showSuccess || result.target === "file") return;
                this.plugin.displayMessage(
                    result.target === "all"
                        ? "Discarded all files."
                        : "Discarded all changes in tracked files."
                );
                return;
            case "cancelled":
            case "skipped":
                return;
        }
    }

    async editRemotes(): Promise<GitActionResult<EditRemoteResult>> {
        const actionResult = await this.runReadyGitAction<EditRemoteResult>(
            async () => {
                return this.performEditRemotes();
            }
        );
        if (actionResult.status === "success") {
            this.reportEditRemoteResult(actionResult.value);
        }
        return actionResult;
    }

    private async performEditRemotes(): Promise<EditRemoteResult> {
        const remotes = await this.plugin.gitManager.getRemotes();
        const remoteName = await new GeneralModal(this.plugin, {
            options: remotes,
            placeholder:
                "Select or create a new remote by typing its name and selecting it",
        }).openAndGetResult();
        if (!remoteName) {
            return { status: "cancelled" };
        }

        const oldUrl = await this.plugin.gitManager.getRemoteUrl(remoteName);
        const remoteURL = await new GeneralModal(this.plugin, {
            initialValue: oldUrl,
            placeholder: "Enter remote URL",
        }).openAndGetResult();
        if (!remoteURL) {
            return { status: "cancelled" };
        }

        await this.plugin.gitManager.setRemote(
            remoteName,
            formatRemoteUrl(remoteURL)
        );
        return { status: "updated", remote: remoteName };
    }

    private reportEditRemoteResult(result: EditRemoteResult): void {
        switch (result.status) {
            case "updated":
            case "cancelled":
            case "skipped":
                return;
        }
    }

    private async selectRemoteBranch(): Promise<string | undefined> {
        let remotes = await this.plugin.gitManager.getRemotes();
        let selectedRemote: string | undefined;
        if (remotes.length === 0) {
            const editResult = await this.performEditRemotes();
            if (editResult.status === "updated") {
                selectedRemote = editResult.remote;
            }
            if (selectedRemote == undefined) {
                remotes = await this.plugin.gitManager.getRemotes();
            }
        }

        const nameModal = new GeneralModal(this.plugin, {
            options: remotes,
            placeholder:
                "Select or create a new remote by typing its name and selecting it",
        });
        const remoteName =
            selectedRemote ?? (await nameModal.openAndGetResult());

        if (remoteName) {
            this.plugin.displayMessage("Fetching remote branches");
            await this.plugin.gitManager.fetch(remoteName);
            const branches =
                await this.plugin.gitManager.getRemoteBranches(remoteName);
            const branchModal = new GeneralModal(this.plugin, {
                options: branches,
                placeholder:
                    "Select or create a new remote branch by typing its name and selecting it",
            });
            const branch = await branchModal.openAndGetResult();
            if (branch == undefined) return undefined;
            if (!branch.startsWith(remoteName + "/")) {
                // If the branch does not start with the remote name, prepend it
                return `${remoteName}/${branch}`;
            }
            return branch; // Already in the correct format
        }
        return undefined;
    }

    async removeRemote(): Promise<GitActionResult<RemoveRemoteResult>> {
        const actionResult = await this.runReadyGitAction<RemoveRemoteResult>(
            async () => {
                const remotes = await this.plugin.gitManager.getRemotes();
                const remoteName = await new GeneralModal(this.plugin, {
                    options: remotes,
                    placeholder: "Select a remote",
                }).openAndGetResult();
                if (!remoteName) {
                    return { status: "cancelled" };
                }

                await this.plugin.gitManager.removeRemote(remoteName);
                return { status: "removed", remote: remoteName };
            }
        );
        if (actionResult.status === "success") {
            this.reportRemoveRemoteResult(actionResult.value);
        }
        return actionResult;
    }

    private reportRemoveRemoteResult(result: RemoveRemoteResult): void {
        switch (result.status) {
            case "removed":
            case "cancelled":
            case "skipped":
                return;
        }
    }
}
