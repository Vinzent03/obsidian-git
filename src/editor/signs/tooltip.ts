import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
    EditorView,
    showTooltip,
    type Tooltip,
    type TooltipView,
} from "@codemirror/view";
import { GitCompareResultEffectType, hunksState } from "./hunkState";
import { Hunks, type Hunk } from "./hunks";
import { html } from "diff2html";
import { ColorSchemeType } from "diff2html/lib/types";
import { pluginRef } from "src/pluginGlobalRef";
import { editorEditorField, MarkdownView, setIcon } from "obsidian";

const selectHunkEffectType = StateEffect.define<{
    pos: number;
    add: boolean;
}>();

export function togglePreviewHunk(editor: EditorView, pos?: number) {
    const state = editor.state;
    const selectedHunks = state.field(selectedHunksState);
    const hunksData = state.field(hunksState);
    const line = state.doc.lineAt(pos ?? state.selection.main.head).number;

    const hunk = Hunks.findHunk(line, hunksData?.hunks)[0];
    if (!hunk) return;
    const hunkStartPos = state.doc.line(Math.max(1, hunk.added.start)).from;

    const isSelected = selectedHunks.has(hunkStartPos);
    return state.field(editorEditorField).dispatch({
        effects: selectHunkEffectType.of({
            pos: hunkStartPos,
            add: !isSelected,
        }),
    });
}

export const selectedHunksState = StateField.define<Set<number>>({
    create: () => new Set<number>(),
    update(value, transaction) {
        const newValue = new Set<number>();
        for (const effect of transaction.effects) {
            if (effect.is(selectHunkEffectType)) {
                if (effect.value.add) {
                    value.add(effect.value.pos);
                } else {
                    value.delete(effect.value.pos);
                }
            }
        }
        for (const pos of value) {
            newValue.add(transaction.changes.mapPos(pos));
        }
        return newValue;
    },
});

export const diffTooltipField = StateField.define<readonly Tooltip[]>({
    create: (state) => {
        return getTooltips(state);
    },
    update(value, transaction) {
        if (
            transaction.docChanged ||
            transaction.effects.some(
                (e) =>
                    e.is(GitCompareResultEffectType) ||
                    e.is(selectHunkEffectType)
            )
        ) {
            return getTooltips(transaction.state);
        }
        return value;
    },
    provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
});

export const cursorTooltipBaseTheme = EditorView.baseTheme({
    ".cm-tooltip.git-diff-tooltip": {
        "z-index": "var(--layer-popover)",
        backgroundColor: "var(--background-primary-alt)",
        border: "var(--border-width) solid var(--background-primary-alt)",
        borderRadius: "var(--radius-s)",
    },
    ".cm-tooltip.git-diff-tooltip .tooltip-toolbar": {
        display: "flex",
        padding: "var(--size-2-1)",
    },
});

function getTooltips(state: EditorState): Tooltip[] {
    const hunksData = state.field(hunksState);
    if (hunksData) {
        const selectedHunks = state.field(selectedHunksState);
        return [...selectedHunks]
            .map((selectedPos) => {
                const line = state.doc.lineAt(selectedPos);
                const hunk = Hunks.findHunk(line.number, hunksData.hunks)[0];
                if (!hunk) return undefined;
                return {
                    pos: selectedPos,
                    above: false,
                    arrow: false,
                    strictSide: true,
                    clip: false,
                    create: () => {
                        return createTooltip(hunk, state, selectedPos);
                    },
                };
            })
            .filter((tip) => tip !== undefined);
    } else {
        return [];
    }
}

function createTooltip(
    hunk: Hunk,
    state: EditorState,
    pos: number
): TooltipView {
    const patch =
        Hunks.createPatch("file", [hunk], "10064", false).join("\n") + "\n";
    const patchHtml = html(patch, {
        colorScheme: ColorSchemeType.AUTO,
        diffStyle: "word",
        drawFileList: false,
    });
    const diffEl = new DOMParser()
        .parseFromString(patchHtml, "text/html")
        .querySelector(".d2h-file-diff");

    const contentEl = document.createElement("div");

    // toolbar
    const toolbar = document.createElement("div");
    toolbar.addClass("tooltip-toolbar");

    const makeButton = (icon: string, label: string) => {
        const btn = document.createElement("div");
        setIcon(btn, icon);
        btn.setAttr("aria-label", label);
        btn.addClass("clickable-icon");
        return btn;
    };

    const closeBtn = makeButton("x", "Close hunk");
    const stageBtn = makeButton("plus", "Stage hunk");
    const resetBtn = makeButton("undo", "Reset hunk");

    toolbar.appendChild(closeBtn);
    toolbar.appendChild(stageBtn);
    toolbar.appendChild(resetBtn);

    // append toolbar and diff
    contentEl.appendChild(toolbar);
    contentEl.appendChild(diffEl!);
    contentEl.addClass("git-diff-tooltip", "git-diff");

    const editor = state.field(editorEditorField);
    // handlers
    closeBtn.onclick = () => {
        togglePreviewHunk(editor, pos);
    };

    stageBtn.onclick = () => {
        const plugin = pluginRef.plugin;
        if (!plugin) return;
        plugin.promiseQueue.addTask(() => plugin.hunkActions.stageHunk(pos));

        togglePreviewHunk(editor, pos);
    };

    resetBtn.onclick = () => {
        const plugin = pluginRef.plugin;
        if (!plugin) return;
        plugin.hunkActions.resetHunk(pos);
        togglePreviewHunk(editor, pos);
    };

    const scope =
        pluginRef.plugin?.app.workspace.getActiveViewOfType(
            MarkdownView
        )?.scope;

    const eventHandler = scope?.register(null, "Escape", (_, __) => {
        // close on escape
        togglePreviewHunk(editor, pos);
    });

    return {
        dom: contentEl,
        destroy: () => {
            if (eventHandler) {
                scope?.unregister(eventHandler);
            }
        },
        update: (update) => {
            pos = update.changes.mapPos(pos);
        },
    };
}
