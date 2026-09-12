import type { EditorView } from "@codemirror/view";
import {
    resolveBlockText,
    type ConflictBlock,
    type ConflictChoice,
} from "./model";

export function resolveConflict(
    view: EditorView,
    block: ConflictBlock,
    choice: ConflictChoice
): void {
    view.dispatch({
        changes: {
            from: block.from,
            to: block.to,
            insert: resolveBlockText(block, choice),
        },
    });
    view.focus();
}
