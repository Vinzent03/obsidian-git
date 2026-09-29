import { Notice, TFolder, WorkspaceLeaf } from "obsidian";
import { HISTORY_VIEW_CONFIG, SOURCE_CONTROL_VIEW_CONFIG } from "./constants";
import { SimpleGit } from "./gitManager/simpleGit";
import ObsidianGit from "./main";
import { openHistoryInGitHub, openLineInGitHub } from "./openInGitHub";
import { IgnoreModal } from "./ui/modals/ignoreModal";
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
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.pullChangesFromRemote()
            ),
    });

    plugin.addCommand({
        id: "fetch",
        name: "Fetch",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.fetch()),
    });

    plugin.addCommand({
        id: "switch-to-remote-branch",
        name: "Switch to remote branch",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.switchRemoteBranch()
            ),
    });

    plugin.addCommand({
        id: "add-to-gitignore",
        name: "Add file to .gitignore",
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin.promiseQueue.addTask(() =>
                    plugin.gitActions.addFileToGitignore(
                        file!.path,
                        file instanceof TFolder
                    )
                );
                return true;
            }
        },
    });

    plugin.addCommand({
        id: "push",
        name: "Commit-and-sync",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commitAndSync({ fromAutoBackup: false })
            ),
    });

    plugin.addCommand({
        id: "backup-and-close",
        name: "Commit-and-sync and then close Obsidian",
        callback: () =>
            plugin.promiseQueue.addTask(async () => {
                await plugin.gitActions.commitAndSync({
                    fromAutoBackup: false,
                });
                window.close();
            }),
    });

    plugin.addCommand({
        id: "commit-push-specified-message",
        name: "Commit-and-sync with specific message",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commitAndSync({
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
                plugin.gitActions.commit({ fromAuto: false, mode: "all" })
            ),
    });

    plugin.addCommand({
        id: "commit-specified-message",
        name: "Commit all changes with specific message",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                    mode: "all",
                })
            ),
    });

    plugin.addCommand({
        id: "commit-smart",
        name: "Commit",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commit({
                    fromAuto: false,
                    requestCustomMessage: false,
                    mode: "smart",
                })
            ),
    });

    plugin.addCommand({
        id: "commit-staged",
        name: "Commit staged",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commit({
                    fromAuto: false,
                    requestCustomMessage: false,
                    mode: "staged",
                })
            ),
    });

    plugin.addCommand({
        id: "commit-amend-staged-specified-message",
        name: "Amend staged",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                    mode: "staged",
                    amend: true,
                })
            ),
    });

    plugin.addCommand({
        id: "commit-smart-specified-message",
        name: "Commit with specific message",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                    mode: "smart",
                })
            ),
    });

    plugin.addCommand({
        id: "commit-staged-specified-message",
        name: "Commit staged with specific message",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.commit({
                    fromAuto: false,
                    requestCustomMessage: true,
                    mode: "staged",
                })
            ),
    });

    plugin.addCommand({
        id: "push2",
        name: "Push",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.push()),
    });

    plugin.addCommand({
        id: "stage-current-file",
        name: "Stage current file",
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin.promiseQueue.addTask(() =>
                    plugin.gitActions.stageFile(file!)
                );
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
                plugin.promiseQueue.addTask(() =>
                    plugin.gitActions.unstageFile(file!)
                );
                return true;
            }
        },
    });

    plugin.addCommand({
        id: "edit-remotes",
        name: "Edit remotes",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.editRemotes()),
    });

    plugin.addCommand({
        id: "remove-remote",
        name: "Remove remote",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.removeRemote()),
    });

    plugin.addCommand({
        id: "set-upstream-branch",
        name: "Set upstream branch",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.setUpstreamBranch()
            ),
    });

    plugin.addCommand({
        id: "delete-repo",
        name: "CAUTION: Delete repository",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.deleteRepository()
            ),
    });

    plugin.addCommand({
        id: "init-repo",
        name: "Initialize a new repo",
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.gitActions.createNewRepo()
            ),
    });

    plugin.addCommand({
        id: "clone-repo",
        name: "Clone an existing remote repo",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.cloneNewRepo()),
    });

    plugin.addCommand({
        id: "list-changed-files",
        name: "List changed files",
        callback: () => plugin.gitActions.listChangedFiles(),
    });

    plugin.addCommand({
        id: "switch-branch",
        name: "Switch branch",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.switchBranch()),
    });

    plugin.addCommand({
        id: "create-branch",
        name: "Create new branch",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.createBranch()),
    });

    plugin.addCommand({
        id: "delete-branch",
        name: "Delete branch",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.deleteBranch()),
    });

    plugin.addCommand({
        id: "discard-all",
        name: "CAUTION: Discard all changes",
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.gitActions.discardAll()),
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
                // only available on desktop
                return gitManager instanceof SimpleGit;
            } else {
                void plugin.tools.runRawCommand();
                return true;
            }
        },
    });

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
