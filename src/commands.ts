import { Notice, TFolder, WorkspaceLeaf } from "obsidian";
import { HISTORY_VIEW_CONFIG, SOURCE_CONTROL_VIEW_CONFIG } from "./constants";
import { WasmGit } from "./gitManager/wasmGit/wasmGit";
import ObsidianGit from "./main";
import { openHistoryInGitHub, openLineInGitHub } from "./openInGitHub";
import { ChangedFilesModal } from "./ui/modals/changedFilesModal";
import { GeneralModal } from "./ui/modals/generalModal";
import { IgnoreModal } from "./ui/modals/ignoreModal";
import { assertNever } from "./utils";
import { togglePreviewHunk } from "./editor/signs/tooltip";

export function addCommmands(plugin: ObsidianGit) {
    const app = plugin.app;

    plugin.addCommand({
        id: "edit-gitignore",
        name: "Edit .gitignore",
        callback: async () => {
            const path = plugin.gitManager.getRelativeVaultPath(".gitignore");
            if (!(await app.vault.adapter.exists(path))) {
                await app.vault.adapter.write(path, "");
            }
            const content = await app.vault.adapter.read(path);
            const modal = new IgnoreModal(app, content);
            const res = await modal.openAndGetReslt();
            if (res !== undefined) {
                await app.vault.adapter.write(path, res);
                await plugin.refresh();
            }
        },
    });
    plugin.addCommand({
        id: "open-git-view",
        name: "Open source control view",
        callback: async () => {
            const leafs = app.workspace.getLeavesOfType(
                SOURCE_CONTROL_VIEW_CONFIG.type
            );
            let leaf: WorkspaceLeaf;
            if (leafs.length === 0) {
                leaf =
                    app.workspace.getRightLeaf(false) ??
                    app.workspace.getLeaf();
                await leaf.setViewState({
                    type: SOURCE_CONTROL_VIEW_CONFIG.type,
                });
            } else {
                leaf = leafs.first()!;
            }
            await app.workspace.revealLeaf(leaf);

            // Is not needed for the first open, but allows to refresh the view
            // per hotkey even if already opened
            app.workspace.trigger("obsidian-git:refresh");
        },
    });
    plugin.addCommand({
        id: "open-history-view",
        name: "Open history view",
        callback: async () => {
            const leafs = app.workspace.getLeavesOfType(
                HISTORY_VIEW_CONFIG.type
            );
            let leaf: WorkspaceLeaf;
            if (leafs.length === 0) {
                leaf =
                    app.workspace.getRightLeaf(false) ??
                    app.workspace.getLeaf();
                await leaf.setViewState({
                    type: HISTORY_VIEW_CONFIG.type,
                });
            } else {
                leaf = leafs.first()!;
            }
            await app.workspace.revealLeaf(leaf);

            // Is not needed for the first open, but allows to refresh the view
            // per hotkey even if already opened
            app.workspace.trigger("obsidian-git:refresh");
        },
    });

    plugin.addCommand({
        id: "open-diff-view",
        name: "Open diff view",
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                const filePath = plugin.gitManager.getRelativeRepoPath(
                    file!.path,
                    true
                );
                plugin.tools.openDiff({
                    aFile: filePath,
                    aRef: "",
                });
                return true;
            }
        },
    });

    plugin.addCommand({
        id: "view-file-on-github",
        name: "Open file on GitHub",
        editorCallback: (editor, { file }) => {
            if (file) return openLineInGitHub(editor, file, plugin.gitManager);
            return undefined;
        },
    });

    plugin.addCommand({
        id: "view-history-on-github",
        name: "Open file history on GitHub",
        editorCallback: (_, { file }) => {
            if (file) return openHistoryInGitHub(file, plugin.gitManager);
            return undefined;
        },
    });

    plugin.addCommand({
        id: "pull",
        name: "Pull",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.pullChangesFromRemote()),
    });

    plugin.addCommand({
        id: "fetch",
        name: "Fetch",
        callback: () => plugin.promiseQueue.addTask(() => plugin.fetch()),
    });

    plugin.addCommand({
        id: "switch-to-remote-branch",
        name: "Switch to remote branch",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.switchRemoteBranch()),
    });

    plugin.addCommand({
        id: "add-to-gitignore",
        name: "Add file to .gitignore",
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin
                    .addFileToGitignore(file!.path, file instanceof TFolder)
                    .catch((e) => plugin.displayError(e));
                return true;
            }
        },
    });

    plugin.addCommand({
        id: "push",
        name: "Commit-and-sync",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.commitAndSync({ fromAutoBackup: false })
            ),
    });

    plugin.addCommand({
        id: "backup-and-close",
        name: "Commit-and-sync and then close Obsidian",
        callback: () =>
            plugin.promiseQueue.addTask(async () => {
                await plugin.commitAndSync({ fromAutoBackup: false });
                window.close();
            }),
    });

    plugin.addCommand({
        id: "commit-push-specified-message",
        name: "Commit-and-sync with specific message",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.commitAndSync({
                    fromAutoBackup: false,
                    requestCustomMessage: true,
                })
            ),
    });

    plugin.addCommand({
        id: "commit",
        name: "Commit all changes",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.commit({ fromAuto: false })
            ),
    });

    plugin.addCommand({
        id: "commit-specified-message",
        name: "Commit all changes with specific message",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                })
            ),
    });

    plugin.addCommand({
        id: "commit-smart",
        name: "Commit",
        callback: () =>
            plugin.promiseQueue.addTask(async () => {
                const status = await plugin.updateCachedStatus();
                const onlyStaged = status.staged.length > 0;
                return plugin.commit({
                    fromAuto: false,
                    requestCustomMessage: false,
                    onlyStaged: onlyStaged,
                });
            }),
    });

    plugin.addCommand({
        id: "commit-staged",
        name: "Commit staged",
        checkCallback: function (checking) {
            // Don't show this command in command palette, because the
            // commit-smart command is more useful. Still provide this command
            // for hotkeys and automation.
            if (checking) return false;

            plugin.promiseQueue.addTask(async () => {
                return plugin.commit({
                    fromAuto: false,
                    requestCustomMessage: false,
                });
            });
            return true;
        },
    });

    plugin.addCommand({
        id: "commit-amend-staged-specified-message",
        name: "Amend staged",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                    onlyStaged: true,
                    amend: true,
                })
            ),
    });

    plugin.addCommand({
        id: "commit-smart-specified-message",
        name: "Commit with specific message",
        callback: () =>
            plugin.promiseQueue.addTask(async () => {
                const status = await plugin.updateCachedStatus();
                const onlyStaged = status.staged.length > 0;
                return plugin.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                    onlyStaged: onlyStaged,
                });
            }),
    });

    plugin.addCommand({
        id: "commit-staged-specified-message",
        name: "Commit staged with specific message",
        checkCallback: function (checking) {
            // Same reason as for commit-staged
            if (checking) return false;
            return plugin.promiseQueue.addTask(() =>
                plugin.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                    onlyStaged: true,
                })
            );
        },
    });

    plugin.addCommand({
        id: "push2",
        name: "Push",
        callback: () => plugin.promiseQueue.addTask(() => plugin.push()),
    });

    plugin.addCommand({
        id: "stage-current-file",
        name: "Stage current file",
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin.promiseQueue.addTask(() => plugin.stageFile(file!));
                return true;
            }
        },
    });

    plugin.addCommand({
        id: "unstage-current-file",
        name: "Unstage current file",
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin.promiseQueue.addTask(() => plugin.unstageFile(file!));
                return true;
            }
        },
    });

    plugin.addCommand({
        id: "edit-remotes",
        name: "Edit remotes",
        callback: () =>
            plugin.editRemotes().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "remove-remote",
        name: "Remove remote",
        callback: () =>
            plugin.removeRemote().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "set-upstream-branch",
        name: "Set upstream branch",
        callback: () =>
            plugin.setUpstreamBranch().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "delete-repo",
        name: "CAUTION: Delete repository",
        callback: async () => {
            const repoExists = await app.vault.adapter.exists(
                `${plugin.settings.basePath}/.git`
            );
            if (repoExists) {
                const modal = new GeneralModal(plugin, {
                    options: ["NO", "YES"],
                    placeholder:
                        "Do you really want to delete the repository (.git directory)? plugin action cannot be undone.",
                    onlySelection: true,
                });
                const shouldDelete = (await modal.openAndGetResult()) === "YES";
                if (shouldDelete) {
                    await app.vault.adapter.rmdir(
                        `${plugin.settings.basePath}/.git`,
                        true
                    );
                    new Notice(
                        "Successfully deleted repository. Reloading plugin..."
                    );
                    plugin.unloadPlugin();
                    await plugin.init({ fromReload: true });
                }
            } else {
                new Notice("No repository found");
            }
        },
    });

    plugin.addCommand({
        id: "init-repo",
        name: "Initialize a new repo",
        callback: () =>
            plugin.createNewRepo().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "clone-repo",
        name: "Clone an existing remote repo",
        callback: () =>
            plugin.cloneNewRepo().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "list-changed-files",
        name: "List changed files",
        callback: async () => {
            if (!(await plugin.isAllInitialized())) return;

            try {
                const status = await plugin.updateCachedStatus();
                if (status.changed.length + status.staged.length > 500) {
                    plugin.displayError("Too many changes to display");
                    return;
                }

                new ChangedFilesModal(plugin, status.all).open();
            } catch (e) {
                plugin.displayError(e);
            }
        },
    });

    plugin.addCommand({
        id: "switch-branch",
        name: "Switch branch",
        callback: () => {
            plugin.switchBranch().catch((e) => plugin.displayError(e));
        },
    });

    plugin.addCommand({
        id: "create-branch",
        name: "Create new branch",
        callback: () => {
            plugin.createBranch().catch((e) => plugin.displayError(e));
        },
    });

    plugin.addCommand({
        id: "delete-branch",
        name: "Delete branch",
        callback: () => {
            plugin.deleteBranch().catch((e) => plugin.displayError(e));
        },
    });

    plugin.addCommand({
        id: "discard-all",
        name: "CAUTION: Discard all changes",
        callback: async () => {
            const res = await plugin.discardAll();
            switch (res) {
                case "discard":
                    new Notice("Discarded all changes in tracked files.");
                    break;
                case "delete":
                    new Notice("Discarded all files.");
                    break;
                case false:
                    break;
                default:
                    assertNever(res);
            }
        },
    });

    plugin.addCommand({
        id: "pause-automatic-routines",
        name: "Pause/Resume automatic routines",
        callback: () => {
            const pause = !plugin.localStorage.getPausedAutomatics();
            plugin.localStorage.setPausedAutomatics(pause);
            if (pause) {
                plugin.automaticsManager.unload();
                new Notice(`Paused automatic routines.`);
            } else {
                plugin.automaticsManager.reload("commit", "push", "pull");
                new Notice(`Resumed automatic routines.`);
            }
        },
    });

    plugin.addCommand({
        id: "raw-command",
        name: "Raw command",
        checkCallback: (checking) => {
            const gitManager = plugin.gitManager;
            if (checking) {
                return gitManager != undefined;
            } else {
                plugin.tools
                    .runRawCommand()
                    .catch((e) => plugin.displayError(e));
                return true;
            }
        },
    });

    addWasmGitCommands(plugin);

    plugin.addCommand({
        id: "toggle-line-author-info",
        name: "Toggle line author information",
        callback: () =>
            plugin.settingsTab?.configureLineAuthorShowStatus(
                !plugin.settings.lineAuthor.show
            ),
    });

    plugin.addCommand({
        id: "reset-hunk",
        name: "Reset hunk",
        editorCheckCallback(checking, _, __) {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }

            plugin.hunkActions.resetHunk();
            return true;
        },
    });

    plugin.addCommand({
        id: "stage-hunk",
        name: "Stage hunk",
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            plugin.promiseQueue.addTask(() => plugin.hunkActions.stageHunk());
            return true;
        },
    });

    plugin.addCommand({
        id: "preview-hunk",
        name: "Preview hunk",
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            const editor = plugin.hunkActions.editor!.editor;
            togglePreviewHunk(editor);
            return true;
        },
    });

    plugin.addCommand({
        id: "next-hunk",
        name: "Go to next hunk",
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            plugin.hunkActions.goToHunk("next");
            return true;
        },
    });

    plugin.addCommand({
        id: "prev-hunk",
        name: "Go to previous hunk",
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            plugin.hunkActions.goToHunk("prev");
            return true;
        },
    });
}

/**
 * Commands for git features that the wasm-git engine offers beyond the shared
 * GitManager contract. On desktop the same operations are available through
 * the "Raw command" palette entry backed by native git.
 */
function addWasmGitCommands(plugin: ObsidianGit) {
    const app = plugin.app;

    const wasmGitCommand = (
        id: string,
        name: string,
        action: (gitManager: WasmGit) => Promise<void>
    ) => {
        plugin.addCommand({
            id,
            name,
            checkCallback: (checking) => {
                const gitManager = plugin.gitManager;
                if (checking) {
                    return gitManager instanceof WasmGit;
                }
                if (!(gitManager instanceof WasmGit)) return false;
                plugin.promiseQueue.addTask(async () => {
                    if (!(await plugin.isAllInitialized())) return;
                    try {
                        await action(gitManager);
                        app.workspace.trigger("obsidian-git:refresh");
                    } catch (e) {
                        plugin.displayError(e);
                    }
                });
                return true;
            },
        });
    };

    wasmGitCommand("stash-push", "Stash changes", async (gitManager) => {
        await gitManager.stashPush();
        plugin.displayMessage("Stashed changes");
    });

    wasmGitCommand("stash-pop", "Pop latest stash", async (gitManager) => {
        await gitManager.stashPop();
        plugin.displayMessage("Applied and dropped latest stash");
    });

    wasmGitCommand("stash-apply", "Apply stash", async (gitManager) => {
        const stashes = await gitManager.stashList();
        if (stashes.length === 0) {
            new Notice("No stashes found");
            return;
        }
        const pick = await new GeneralModal(plugin, {
            options: stashes,
            placeholder: "Select the stash to apply",
            onlySelection: true,
        }).openAndGetResult();
        if (pick === undefined) return;
        await gitManager.stashApply(stashes.indexOf(pick));
        plugin.displayMessage("Applied stash");
    });

    wasmGitCommand("stash-drop", "Drop stash", async (gitManager) => {
        const stashes = await gitManager.stashList();
        if (stashes.length === 0) {
            new Notice("No stashes found");
            return;
        }
        const pick = await new GeneralModal(plugin, {
            options: stashes,
            placeholder: "Select the stash to drop",
            onlySelection: true,
        }).openAndGetResult();
        if (pick === undefined) return;
        await gitManager.stashDrop(stashes.indexOf(pick));
        plugin.displayMessage("Dropped stash");
    });

    wasmGitCommand("create-tag", "Create tag", async (gitManager) => {
        const name = await new GeneralModal(plugin, {
            placeholder: "Enter tag name",
        }).openAndGetResult();
        if (!name) return;
        const message = await new GeneralModal(plugin, {
            placeholder:
                "Enter tag message. Leave empty for a lightweight tag.",
            allowEmpty: true,
        }).openAndGetResult();
        if (message === undefined) return;
        await gitManager.tagCreate(name, message === "" ? undefined : message);
        plugin.displayMessage(`Created tag '${name}'`);
    });

    wasmGitCommand("delete-tag", "Delete tag", async (gitManager) => {
        const tags = await gitManager.tagList();
        if (tags.length === 0) {
            new Notice("No tags found");
            return;
        }
        const pick = await new GeneralModal(plugin, {
            options: tags,
            placeholder: "Select the tag to delete",
            onlySelection: true,
        }).openAndGetResult();
        if (pick === undefined) return;
        await gitManager.tagDelete(pick);
        plugin.displayMessage(`Deleted tag '${pick}'`);
    });

    wasmGitCommand("revert-commit", "Revert commit", async (gitManager) => {
        const commits = await gitManager.log(undefined, false, 20);
        const options = commits.map(
            (commit) =>
                `${commit.hash.substring(0, 8)} ${commit.message.split("\n")[0]}`
        );
        const pick = await new GeneralModal(plugin, {
            options,
            placeholder: "Select the commit to revert",
            onlySelection: true,
        }).openAndGetResult();
        if (pick === undefined) return;
        const commit = commits[options.indexOf(pick)]!;
        await gitManager.revert(commit.hash);
        plugin.displayMessage(
            "Reverted commit. The revert is staged and ready to commit."
        );
    });
}
