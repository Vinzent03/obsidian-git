import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
    EditorView,
    showTooltip,
    type Tooltip,
    type TooltipView,
} from "@codemirror/view";
import { GitCompareResultEffectType, hunksState } from "./signs";
import { Hunks, type Hunk } from "./hunks";
import { html } from "diff2html";
import { ColorSchemeType } from "diff2html/lib/types";
import { pluginRef } from "src/pluginGlobalRef";
import { editorEditorField, setIcon } from "obsidian";

export const selectHunkEffectType = StateEffect.define<{
    pos: number;
    add: boolean;
}>();

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
        return hunksData.hunks
            .filter((hunk) => {
                for (const pos of selectedHunks) {
                    const line = state.doc.lineAt(pos);
                    if (
                        hunk.added.start <= line.number &&
                        line.number <= hunk.vend
                    ) {
                        return true;
                    }
                }
                return false;
            })
            .map((hunk) => {
                const from = state.doc.line(hunk.added.start).from;
                return {
                    pos: from,
                    above: false,
                    arrow: false,
                    strictSide: true,
                    clip: false,
                    create: () => {
                        return createTooltip(hunk, state, from);
                    },
                };
            });
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

    // handlers
    closeBtn.onclick = () => {
        state.field(editorEditorField).dispatch({
            effects: selectHunkEffectType.of({
                pos: pos,
                add: false,
            }),
        });
    };

    stageBtn.onclick = () => {
        const plugin = pluginRef.plugin;
        if (!plugin) return;
        // enqueue same as commands
        plugin.promiseQueue.addTask(() => plugin.hunkActions.stageHunk(pos));

        // close tooltip selection afterwards
        state.field(editorEditorField).dispatch({
            effects: selectHunkEffectType.of({
                pos: pos,
                add: false,
            }),
        });
    };

    resetBtn.onclick = () => {
        const plugin = pluginRef.plugin;
        if (!plugin) return;
        plugin.hunkActions.resetHunk(pos);
        state.field(editorEditorField).dispatch({
            effects: selectHunkEffectType.of({
                pos: pos,
                add: false,
            }),
        });
    };

    return {
        dom: contentEl,
        update: (update) => {
            pos = update.changes.mapPos(pos);
        },
    };
}
