import { htmlToMarkdown, Menu } from "obsidian";

import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function getSelectedText(state: EditorState): string {
    return state.selection.ranges
        .filter((range) => !range.empty)
        .map((range) => state.sliceDoc(range.from, range.to))
        .join(state.lineBreak);
}

function deleteSelection(view: EditorView) {
    view.dispatch({
        ...view.state.replaceSelection(""),
        userEvent: "delete.cut",
    });
}

function insertText(view: EditorView, text: string) {
    view.dispatch({
        ...view.state.replaceSelection(text),
        scrollIntoView: true,
        userEvent: "input.paste",
    });
}

async function readClipboard(plainText: boolean): Promise<string> {
    if (!plainText && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            if (item.types.includes("text/html")) {
                const html = await (await item.getType("text/html")).text();
                return htmlToMarkdown(html);
            }
        }
    }

    return navigator.clipboard.readText();
}

export const diffContextMenu = EditorView.domEventHandlers({
    contextmenu(event, view) {
        event.preventDefault();

        const selectedText = getSelectedText(view.state);
        const canEdit =
            !view.state.readOnly && view.state.facet(EditorView.editable);
        const menu = Menu.forEvent(event);
        menu.addItem((item) =>
            item
                .setTitle("Cut")
                .setIcon("scissors")
                .setDisabled(!canEdit || selectedText.length === 0)
                .onClick(async () => {
                    await navigator.clipboard.writeText(selectedText);
                    deleteSelection(view);
                })
        );
        menu.addItem((item) =>
            item
                .setTitle("Copy")
                .setIcon("copy")
                .setDisabled(selectedText.length === 0)
                .onClick(() => navigator.clipboard.writeText(selectedText))
        );
        menu.addItem((item) =>
            item
                .setTitle("Paste")
                .setIcon("clipboard-paste")
                .setDisabled(!canEdit)
                .onClick(async () =>
                    insertText(view, await readClipboard(false))
                )
        );
        menu.addItem((item) =>
            item
                .setTitle("Paste as plain text")
                .setIcon("clipboard-type")
                .setDisabled(!canEdit)
                .onClick(async () =>
                    insertText(view, await readClipboard(true))
                )
        );
        menu.addItem((item) =>
            item
                .setTitle("Select all")
                .setIcon("scan")
                .onClick(() =>
                    view.dispatch({
                        selection: { anchor: 0, head: view.state.doc.length },
                    })
                )
        );
        menu.showAtMouseEvent(event);

        return true;
    },
});
