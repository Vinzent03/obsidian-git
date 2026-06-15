import { Notice, Platform, TFolder, WorkspaceLeaf } from "obsidian";
import { t } from "./locale";
import { HISTORY_VIEW_CONFIG, SOURCE_CONTROL_VIEW_CONFIG } from "./constants";
import { SimpleGit } from "./gitManager/simpleGit";
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
        name: t("cmd.edit_gitignore"),
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
        name: t("cmd.open_source_control"),
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
        name: t("cmd.open_history"),
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
        name: t("cmd.open_diff"),
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
            }
        },
    });

    plugin.addCommand({
        id: "view-file-on-github",
        name: t("cmd.open_file_on_github"),
        editorCallback: (editor, { file }) => {
            if (file) return openLineInGitHub(editor, file, plugin.gitManager);
        },
    });

    plugin.addCommand({
        id: "view-history-on-github",
        name: t("cmd.open_history_on_github"),
        editorCallback: (_, { file }) => {
            if (file) return openHistoryInGitHub(file, plugin.gitManager);
        },
    });

    plugin.addCommand({
        id: "pull",
        name: t("cmd.pull"),
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.pullChangesFromRemote()),
    });

    plugin.addCommand({
        id: "fetch",
        name: t("cmd.fetch"),
        callback: () => plugin.promiseQueue.addTask(() => plugin.fetch()),
    });

    plugin.addCommand({
        id: "switch-to-remote-branch",
        name: t("cmd.switch_remote_branch"),
        callback: () =>
            plugin.promiseQueue.addTask(() => plugin.switchRemoteBranch()),
    });

    plugin.addCommand({
        id: "add-to-gitignore",
        name: t("cmd.add_to_gitignore"),
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin
                    .addFileToGitignore(file!.path, file instanceof TFolder)
                    .catch((e) => plugin.displayError(e));
            }
        },
    });

    plugin.addCommand({
        id: "push",
        name: t("cmd.commit_and_sync"),
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.commitAndSync({ fromAutoBackup: false })
            ),
    });

    plugin.addCommand({
        id: "backup-and-close",
        name: t("cmd.commit_and_sync_close"),
        callback: () =>
            plugin.promiseQueue.addTask(async () => {
                await plugin.commitAndSync({ fromAutoBackup: false });
                window.close();
            }),
    });

    plugin.addCommand({
        id: "commit-push-specified-message",
        name: t("cmd.commit_and_sync_message"),
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
        name: t("cmd.commit_all"),
        callback: () =>
            plugin.promiseQueue.addTask(() =>
                plugin.commit({ fromAuto: false })
            ),
    });

    plugin.addCommand({
        id: "commit-specified-message",
        name: t("cmd.commit_all_message"),
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
        name: t("cmd.commit"),
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
        name: t("cmd.commit_staged"),
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
        },
    });

    if (Platform.isDesktopApp) {
        plugin.addCommand({
            id: "commit-amend-staged-specified-message",
            name: t("cmd.amend_staged"),
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
    }

    plugin.addCommand({
        id: "commit-smart-specified-message",
        name: t("cmd.commit_message"),
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
        name: t("cmd.commit_staged_message"),
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
        name: t("cmd.push"),
        callback: () => plugin.promiseQueue.addTask(() => plugin.push()),
    });

    plugin.addCommand({
        id: "stage-current-file",
        name: t("cmd.stage_current_file"),
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin.promiseQueue.addTask(() => plugin.stageFile(file!));
            }
        },
    });

    plugin.addCommand({
        id: "unstage-current-file",
        name: t("cmd.unstage_current_file"),
        checkCallback: (checking) => {
            const file = app.workspace.getActiveFile();
            if (checking) {
                return file !== null;
            } else {
                plugin.promiseQueue.addTask(() => plugin.unstageFile(file!));
            }
        },
    });

    plugin.addCommand({
        id: "edit-remotes",
        name: t("cmd.edit_remotes"),
        callback: () =>
            plugin.editRemotes().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "remove-remote",
        name: t("cmd.remove_remote"),
        callback: () =>
            plugin.removeRemote().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "set-upstream-branch",
        name: t("cmd.set_upstream"),
        callback: () =>
            plugin.setUpstreamBranch().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "delete-repo",
        name: t("cmd.delete_repo"),
        callback: async () => {
            const repoExists = await app.vault.adapter.exists(
                `${plugin.settings.basePath}/.git`
            );
            if (repoExists) {
                const modal = new GeneralModal(plugin, {
                    options: [t("notice.no"), t("notice.yes")],
                    placeholder: t("modal.delete_repo_confirm"),
                    onlySelection: true,
                });
                const shouldDelete = (await modal.openAndGetResult()) === t("notice.yes");
                if (shouldDelete) {
                    await app.vault.adapter.rmdir(
                        `${plugin.settings.basePath}/.git`,
                        true
                    );
                    new Notice(t("modal.success_deleted_repo"));
                    plugin.unloadPlugin();
                    await plugin.init({ fromReload: true });
                }
            } else {
                new Notice(t("modal.no_repo_found"));
            }
        },
    });

    plugin.addCommand({
        id: "init-repo",
        name: t("cmd.init_repo"),
        callback: () =>
            plugin.createNewRepo().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "clone-repo",
        name: t("cmd.clone_repo"),
        callback: () =>
            plugin.cloneNewRepo().catch((e) => plugin.displayError(e)),
    });

    plugin.addCommand({
        id: "list-changed-files",
        name: t("cmd.list_changed_files"),
        callback: async () => {
            if (!(await plugin.isAllInitialized())) return;

            try {
                const status = await plugin.updateCachedStatus();
                if (status.changed.length + status.staged.length > 500) {
                    plugin.displayError(t("msg.too_many_changes"));
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
        name: t("cmd.switch_branch"),
        callback: () => {
            plugin.switchBranch().catch((e) => plugin.displayError(e));
        },
    });

    plugin.addCommand({
        id: "create-branch",
        name: t("cmd.create_branch"),
        callback: () => {
            plugin.createBranch().catch((e) => plugin.displayError(e));
        },
    });

    plugin.addCommand({
        id: "delete-branch",
        name: t("cmd.delete_branch"),
        callback: () => {
            plugin.deleteBranch().catch((e) => plugin.displayError(e));
        },
    });

    plugin.addCommand({
        id: "discard-all",
        name: t("cmd.discard_all"),
        callback: async () => {
            const res = await plugin.discardAll();
            switch (res) {
                case "discard":
                    new Notice(t("notice.discarded_tracked"));
                    break;
                case "delete":
                    new Notice(t("notice.discarded_all"));
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
        name: t("cmd.pause_resume"),
        callback: () => {
            const pause = !plugin.localStorage.getPausedAutomatics();
            plugin.localStorage.setPausedAutomatics(pause);
            if (pause) {
                plugin.automaticsManager.unload();
                new Notice(t("notice.paused_routines"));
            } else {
                plugin.automaticsManager.reload("commit", "push", "pull");
                new Notice(t("notice.resumed_routines"));
            }
        },
    });

    plugin.addCommand({
        id: "raw-command",
        name: t("cmd.raw_command"),
        checkCallback: (checking) => {
            const gitManager = plugin.gitManager;
            if (checking) {
                // only available on desktop
                return gitManager instanceof SimpleGit;
            } else {
                plugin.tools
                    .runRawCommand()
                    .catch((e) => plugin.displayError(e));
            }
        },
    });

    plugin.addCommand({
        id: "toggle-line-author-info",
        name: t("cmd.toggle_line_author"),
        callback: () =>
            plugin.settingsTab?.configureLineAuthorShowStatus(
                !plugin.settings.lineAuthor.show
            ),
    });

    plugin.addCommand({
        id: "reset-hunk",
        name: t("cmd.reset_hunk"),
        editorCheckCallback(checking, _, __) {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }

            plugin.hunkActions.resetHunk();
        },
    });

    plugin.addCommand({
        id: "stage-hunk",
        name: t("cmd.stage_hunk"),
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            plugin.promiseQueue.addTask(() => plugin.hunkActions.stageHunk());
        },
    });

    plugin.addCommand({
        id: "preview-hunk",
        name: t("cmd.preview_hunk"),
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            const editor = plugin.hunkActions.editor!.editor;
            togglePreviewHunk(editor);
        },
    });

    plugin.addCommand({
        id: "next-hunk",
        name: t("cmd.next_hunk"),
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            plugin.hunkActions.goToHunk("next");
        },
    });

    plugin.addCommand({
        id: "prev-hunk",
        name: t("cmd.prev_hunk"),
        editorCheckCallback: (checking, _, __) => {
            if (checking) {
                return (
                    plugin.settings.hunks.hunkCommands &&
                    plugin.hunkActions.editor !== undefined
                );
            }
            plugin.hunkActions.goToHunk("prev");
        },
    });
}
