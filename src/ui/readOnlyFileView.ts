import { standardKeymap } from "@codemirror/commands";
import { search } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
    drawSelection,
    EditorView,
    keymap,
    lineNumbers,
} from "@codemirror/view";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import { ItemView } from "obsidian";
import { READ_ONLY_FILE_VIEW_CONFIG } from "src/constants";
import type ObsidianGit from "src/main";
import type { ReadOnlyFileViewState } from "src/types";

const readOnlyEditorTheme = EditorView.theme({
    "&": { height: "100%" },
    ".cm-scroller": { overflow: "auto" },
    "& .cm-content": { caretColor: "transparent !important" },
    "&.cm-focused .cm-cursor, & .cm-dropCursor": {
        display: "none !important",
    },
});

export default class ReadOnlyFileView extends ItemView {
    private editor: EditorView | undefined;
    private state: ReadOnlyFileViewState | undefined;

    constructor(
        leaf: WorkspaceLeaf,
        private readonly plugin: ObsidianGit
    ) {
        super(leaf);
        this.navigation = true;
        this.contentEl.addClass(
            "git-read-only-file-view",
            "cm-s-obsidian",
            "mod-cm6",
            "markdown-source-view"
        );
        this.registerEvent(
            this.app.workspace.on("obsidian-git:head-change", () => {
                if (!this.editor) {
                    this.renderFile().catch((error) =>
                        this.plugin.displayError(error)
                    );
                }
            })
        );
    }

    getViewType(): string {
        return READ_ONLY_FILE_VIEW_CONFIG.type;
    }

    getDisplayText(): string {
        if (!this.state) return READ_ONLY_FILE_VIEW_CONFIG.name;
        const fileName = this.state.file.split("/").last() ?? this.state.file;
        return `${fileName} (${this.state.ref.substring(0, 7)})`;
    }

    getIcon(): string {
        return READ_ONLY_FILE_VIEW_CONFIG.icon;
    }

    async setState(
        state: ReadOnlyFileViewState,
        result: ViewStateResult
    ): Promise<void> {
        this.state = state;
        await super.setState(state, result);

        this.leaf.view.titleEl.textContent = this.getDisplayText();

        await this.renderFile();
    }

    getState(): Record<string, unknown> {
        return this.state ?? {};
    }

    async onOpen(): Promise<void> {
        await this.renderFile();
        await super.onOpen();
    }

    async onClose(): Promise<void> {
        this.editor?.destroy();
        this.editor = undefined;
        await super.onClose();
    }

    private async renderFile(): Promise<void> {
        if (!this.state || !this.plugin.gitReady) return;

        const content = await this.plugin.gitManager.show(
            this.state.ref,
            this.state.file,
            false
        );

        this.editor?.destroy();
        this.contentEl.empty();
        this.editor = new EditorView({
            state: EditorState.create({
                doc: content,
                extensions: [
                    lineNumbers(),
                    drawSelection(),
                    keymap.of(standardKeymap),
                    search(),
                    EditorView.lineWrapping,
                    EditorState.readOnly.of(true),
                    readOnlyEditorTheme,
                ],
            }),
            parent: this.contentEl,
        });
    }
}
