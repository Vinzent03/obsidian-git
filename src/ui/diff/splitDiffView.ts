import type { Debouncer, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { debounce, ItemView, Platform } from "obsidian";
import { SPLIT_DIFF_VIEW_CONFIG } from "src/constants";
import { SimpleGit } from "src/gitManager/simpleGit";
import type ObsidianGit from "src/main";
import type { DiffViewState } from "src/types";

import {
    drawSelection,
    EditorView,
    keymap,
    lineNumbers,
    ViewPlugin,
} from "@codemirror/view";
import { EditorState, Transaction } from "@codemirror/state";
import { MergeView } from "@codemirror/merge";
import { history, indentWithTab, standardKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, search } from "@codemirror/search";
import { GitError } from "simple-git";

// This class is not extending `FileView', because it needs a `TFile`, which is not possible for dot files like `.gitignore`, which this editor should support as well.`
export default class SplitDiffView extends ItemView {
    refreshing = false;
    state: DiffViewState;
    intervalRef: number;
    mergeView: MergeView | undefined;
    fileSaveDebouncer: Debouncer<[string], void>;
    bIsEditable: boolean;

    /**
     * Prevent to load text from file if the modification event was caused by this instance
     */
    ignoreNextModification = false;

    constructor(
        leaf: WorkspaceLeaf,
        private plugin: ObsidianGit
    ) {
        super(leaf);
        this.navigation = true;
        this.registerEvent(
            this.app.workspace.on("obsidian-git:status-changed", () => {
                if (!this.mergeView) {
                    this.createMergeView().catch(console.error);
                } else {
                    this.updateRefEditors().catch(console.error);
                }
            })
        );
        this.intervalRef = window.setInterval(() => {
            if (this.mergeView) {
                this.updateRefEditors().catch(console.error);
            }
        }, 30 * 1000);

        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (
                    this.state.bRef == undefined &&
                    file.path === this.state.bFile
                ) {
                    if (this.ignoreNextModification) {
                        this.ignoreNextModification = false;
                    } else {
                        this.updateModifiableEditor().catch(console.error);
                    }
                }
            })
        );
        this.registerEvent(
            this.app.vault.on("delete", (file) => {
                if (
                    this.state.bRef == undefined &&
                    file.path === this.state.bFile
                ) {
                    // If the file got deleted, we need to recreate the view to make the editor read-only
                    this.createMergeView().catch(console.error);
                }
            })
        );
        this.registerEvent(
            this.app.vault.on("create", (file) => {
                if (
                    this.state.bRef == undefined &&
                    file.path === this.state.bFile
                ) {
                    // If the file got created, we need to recreate the view to make the editor editable
                    this.createMergeView().catch(console.error);
                }
            })
        );
        this.registerEvent(
            this.app.vault.on("rename", (file, oldPath) => {
                if (
                    this.state.bRef == undefined &&
                    (file.path === this.state.bFile ||
                        oldPath === this.state.bFile)
                ) {
                    // If the file got created, we need to recreate the view to make the editor editable
                    this.createMergeView().catch(console.error);
                }
            })
        );

        this.fileSaveDebouncer = debounce(
            (data: string) => {
                const file = this.state.bFile;
                if (file) {
                    this.ignoreNextModification = true;
                    this.plugin.app.vault.adapter
                        .write(file, data)
                        .catch((e) => this.plugin.displayError(e));
                }
            },
            1000,
            false
        );
    }

    getViewType(): string {
        return SPLIT_DIFF_VIEW_CONFIG.type;
    }

    getDisplayText(): string {
        if (this.state?.bFile != null) {
            let fileName = this.state.bFile.split("/").last();
            if (fileName?.endsWith(".md")) fileName = fileName.slice(0, -3);

            return `Diff: ${fileName}`;
        }
        return SPLIT_DIFF_VIEW_CONFIG.name;
    }

    getIcon(): string {
        return SPLIT_DIFF_VIEW_CONFIG.icon;
    }

    async setState(state: DiffViewState, _: ViewStateResult): Promise<void> {
        this.state = state;

        if (Platform.isMobile) {
            //Update view title on mobile only to show the file name of the diff
            this.leaf.view.titleEl.textContent = this.getDisplayText();
        }
        await super.setState(state, _);

        await this.createMergeView();
    }

    getState(): Record<string, unknown> {
        return this.state as unknown as Record<string, unknown>;
    }

    onClose(): Promise<void> {
        window.clearInterval(this.intervalRef);
        return super.onClose();
    }

    async onOpen(): Promise<void> {
        await this.createMergeView();
        return super.onOpen();
    }

    async gitShow(commitHash: string, file: string): Promise<string> {
        try {
            return await (this.plugin.gitManager as SimpleGit).show(
                commitHash,
                file,
                false
            );
        } catch (error) {
            if (error instanceof GitError) {
                if (
                    error.message.includes("does not exist") ||
                    error.message.includes("unknown revision or path") ||
                    error.message.includes("exists on disk, but not in") ||
                    error.message.includes("fatal: bad object")
                ) {
                    // Occurs when trying to run diff with an object that's actually a nested respository
                    if (error.message.includes("fatal: bad object")) {
                        this.plugin.displayError(error.message);
                    }
                    // If the file does not exist in the commit, return an empty string
                    return "";
                }
            }
            throw error;
        }
    }

    async bShouldBeEditable(): Promise<boolean> {
        if (this.state.bRef != undefined) {
            return false;
        }
        const bVaultPath = this.plugin.gitManager.getRelativeVaultPath(
            this.state.bFile
        );
        return await this.app.vault.adapter.exists(bVaultPath);
    }

    async updateModifiableEditor() {
        if (!this.mergeView || this.refreshing) return;
        const bEditor = this.mergeView.b;

        this.refreshing = true;
        const newContent = await this.app.vault.adapter.read(this.state.bFile);
        if (newContent != bEditor.state.doc.toString()) {
            const transaction = bEditor.state.update({
                changes: {
                    from: 0,
                    to: bEditor.state.doc.length,
                    insert: newContent,
                },
                // The remote annotation is used to mark that change as external
                // so the new state is not written back to the file, because it
                // just came from the file system
                annotations: [Transaction.remote.of(true)],
            });
            bEditor.dispatch(transaction);
        }
        this.refreshing = false;
    }

    /**
     * Only update the editors which show a file state of some git ref ike HEAD or index and not the current working tree.
     * So only the non editable editors.
     */
    async updateRefEditors() {
        if (!this.mergeView || this.refreshing) return;
        const aEditor = this.mergeView.a;
        const bEditor = this.mergeView.b;

        this.refreshing = true;

        const aText = await this.gitShow(this.state.aRef, this.state.aFile);

        let bText: string | undefined;
        if (this.state.bRef != undefined) {
            bText = await this.gitShow(this.state.bRef, this.state.bFile);
        }
        if (aText != aEditor.state.doc.toString()) {
            const aTransaction = aEditor.state.update({
                changes: {
                    from: 0,
                    to: aEditor.state.doc.length,
                    insert: aText,
                },
            });
            aEditor.dispatch(aTransaction);
        }

        if (bText != undefined && bText != bEditor.state.doc.toString()) {
            const bTransaction = bEditor.state.update({
                changes: {
                    from: 0,
                    to: bEditor.state.doc.length,
                    insert: bText,
                },
            });
            bEditor.dispatch(bTransaction);
        }
        this.refreshing = false;
    }

    async createMergeView() {
        if (
            this.state?.aFile &&
            this.state?.bFile &&
            !this.refreshing &&
            this.plugin.gitManager
        ) {
            this.refreshing = true;

            // cleanup
            this.mergeView?.destroy();
            const container = this.containerEl.children[1];
            container.empty();

            // new
            this.contentEl.addClass("git-split-diff-view");
            this.bIsEditable = await this.bShouldBeEditable();

            const aText = await this.gitShow(this.state.aRef, this.state.aFile);

            let bText: string;
            if (this.state.bRef != undefined) {
                bText = await this.gitShow(this.state.bRef, this.state.bFile);
            } else {
                const bVaultPath = this.plugin.gitManager.getRelativeVaultPath(
                    this.state.bFile
                );
                if (await this.app.vault.adapter.exists(bVaultPath)) {
                    bText = await this.app.vault.adapter.read(bVaultPath);
                } else {
                    bText = "";
                }
            }

            const basicExtensions = [
                lineNumbers(),
                highlightSelectionMatches(),
                drawSelection(),
                keymap.of([...standardKeymap, indentWithTab]),
                history(),
                search(),
                EditorView.lineWrapping,
            ];

            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const myView = this;
            const autoSavePlugin = ViewPlugin.define((view) => ({
                update(update) {
                    if (
                        update.docChanged &&
                        !update.transactions.some((tr) =>
                            tr.annotation(Transaction.remote)
                        )
                    ) {
                        const lhsContent = view.state.doc.toString();
                        myView.fileSaveDebouncer(lhsContent);
                    }
                },
            }));

            const aState = {
                doc: aText,
                extensions: [
                    ...basicExtensions,
                    EditorView.editable.of(false),
                    EditorState.readOnly.of(true),
                ],
            };

            const bExtensions = [...basicExtensions];

            // Only make the editor modifiable when viewing the working tree version
            if (!this.bIsEditable) {
                bExtensions.push(
                    EditorView.editable.of(false),
                    EditorState.readOnly.of(true)
                );
            } else {
                bExtensions.push(autoSavePlugin);
            }

            const bState = {
                doc: bText,
                extensions: bExtensions,
            };

            container.addClasses([
                "cm-s-obsidian",
                "mod-cm6",
                "markdown-source-view",
                "cm-content",
            ]);

            this.mergeView = new MergeView({
                b: bState,
                a: aState,
                diffConfig: {
                    scanLimit: this.bIsEditable ? 1000 : 10000, // default is 500
                },
                parent: container,
            });

            this.refreshing = false;
        }
    }
}
