import { editorInfoField, type Editor } from "obsidian";
import { hunksState, HunksStateHelper } from "./signs";
import type { EditorView } from "codemirror";
import type ObsidianGit from "src/main";
import { Hunks } from "./hunks";
import type { SimpleGit } from "src/gitManager/simpleGit";

export class HunkActions {
    constructor(private readonly plugin: ObsidianGit) {}

    get editor(): { obEditor: Editor; editor: EditorView } | undefined {
        const obEditor = this.plugin.app.workspace.activeEditor?.editor;
        // @ts-expect-error, not typed
        const editor = obEditor?.cm as EditorView;

        if (!obEditor || !HunksStateHelper.hasHunksData(editor.state)) {
            return undefined;
        }
        return { editor, obEditor };
    }

    private get gitManager(): SimpleGit {
        return this.plugin.gitManager as SimpleGit;
    }

    resetHunk(): void {
        if (!this.editor) {
            return;
        }
        const { editor, obEditor } = this.editor;
        const hunk = HunksStateHelper.getHunk(editor.state, false);
        if (hunk) {
            let lstart: number, lend: number;
            if (hunk.type === "delete") {
                lstart = hunk.added.start + 1;
                lend = hunk.added.start + 1;
            } else {
                lstart = hunk.added.start - 0;
                lend = hunk.added.start - 1 + hunk.added.count;
            }
            const from = editor.state.doc.line(lstart).from;
            const to =
                hunk.type === "delete"
                    ? editor.state.doc.line(lend).from
                    : editor.state.doc.line(lend).to + 1;
            let lines = hunk.removed.lines.join("\n");
            if (!hunk.removed.no_nl_at_eof) {
                lines += "\n";
            }

            obEditor.replaceRange(
                lines,
                obEditor.offsetToPos(from),
                obEditor.offsetToPos(to)
            );

            obEditor.setSelection(obEditor.offsetToPos(from));
        }
    }

    async stageHunk(): Promise<void> {
        if (!(await this.plugin.isAllInitialized())) {
            return;
        }
        if (!this.editor) {
            return;
        }
        const { editor } = this.editor;

        let hunk = HunksStateHelper.getHunk(editor.state, false);
        let invert = false;
        if (!hunk) {
            hunk = HunksStateHelper.getHunk(editor.state, true);
            invert = true;
        }
        if (!hunk) {
            return;
        }
        const filepath = editor.state.field(editorInfoField).file!.path;

        const patch =
            Hunks.createPatch(filepath, [hunk], "100644", invert).join("\n") +
            "\n";
        await this.gitManager.applyPatch(patch);

        this.plugin.app.workspace.trigger("obsidian-git:refresh");
    }
}
