import { EditorState, StateField } from "@codemirror/state";
import { EditorView, showTooltip, type Tooltip } from "@codemirror/view";
import { GitCompareResultEffectType, hunksState } from "./signs";
import { Hunks } from "./hunks";
import { html } from "diff2html";
import { ColorSchemeType } from "diff2html/lib/types";

export const diffTooltipField = StateField.define<readonly Tooltip[]>({
    create: (state) => {
        return getTooltips(state);
    },
    update(value, transaction) {
        if (
            transaction.docChanged ||
            transaction.effects.some((e) => e.is(GitCompareResultEffectType))
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
});

function getTooltips(state: EditorState): Tooltip[] {
    const hunksData = state.field(hunksState);
    if (hunksData) {
        return hunksData.hunks.map((hunk) => {
            const from = state.doc.line(hunk.added.start).from;
            return {
                pos: from,
                above: false,
                arrow: false,
                strictSide: true,
                clip: false,
                create: () => {
                    const patch =
                        Hunks.createPatch("file", [hunk], "10064", false).join(
                            "\n"
                        ) + "\n";
                    const patchHtml = html(patch, {
                        colorScheme: ColorSchemeType.AUTO,
                        diffStyle: "word",
                        drawFileList: false,
                    });
                    const diffEl = new DOMParser()
                        .parseFromString(patchHtml, "text/html")
                        .querySelector(".d2h-file-diff");

                    const contentEl = document.createElement("div");
                    contentEl.appendChild(diffEl!);
                    contentEl.addClass("git-diff-tooltip", "git-diff");
                    return {
                        dom: contentEl,
                    };
                },
            };
        });
    } else {
        return [];
    }
}
