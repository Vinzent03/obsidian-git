import type { Editor } from "obsidian";
import { HunksStateHelper } from "./signs";
import type { EditorView } from "codemirror";
import type ObsidianGit from "src/main";

export class HunkActions {
    constructor(private readonly plugin: ObsidianGit) {}

    resetHunk(): void {
        const obEditor = this.plugin.app.workspace.activeEditor?.editor;
        if (!obEditor) {
            return;
        }
        // @ts-expect-error, not typed
        const editor = obEditor.cm as EditorView;
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
            if (lines.length > 0 && !hunk.removed.no_nl_at_eof) {
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
}
