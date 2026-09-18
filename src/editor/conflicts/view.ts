import { StateField, type EditorState } from "@codemirror/state";
import {
    EditorView,
    showPanel,
    type Panel,
    type PanelConstructor,
    type ViewUpdate,
} from "@codemirror/view";
import {
    ButtonComponent,
    editorInfoField,
    editorLivePreviewField,
} from "obsidian";
import { CONFLICT_OUTPUT_FILE } from "src/constants";
import { resolveAllConflicts } from "./actions";
import {
    parseConflictBlocks,
    type ConflictBlock,
    type ConflictChoice,
} from "./model";

const CHOICES = ["ours", "theirs", "both"] as const;

function computeBlocks(state: EditorState): readonly ConflictBlock[] {
    if (!state.field(editorLivePreviewField, false)) {
        return [];
    }
    if (
        state.field(editorInfoField, false)?.file?.path === CONFLICT_OUTPUT_FILE
    ) {
        return [];
    }
    const text = state.doc.toString();
    return text.includes("<<<<<<<") ? parseConflictBlocks(text) : [];
}

export const conflictBlocksField = StateField.define<readonly ConflictBlock[]>({
    create: computeBlocks,
    update: (value, transaction) =>
        transaction.docChanged || transaction.reconfigured
            ? computeBlocks(transaction.state)
            : value,
});

function addButtons(
    group: HTMLElement,
    labels: Record<ConflictChoice, string>,
    onPick: (choice: ConflictChoice) => void
): void {
    for (const choice of CHOICES) {
        const button = new ButtonComponent(group)
            .setButtonText(labels[choice])
            .onClick((event) => {
                event.preventDefault();
                onPick(choice);
            });
        button.buttonEl.addClass(
            "clickable-icon",
            "nav-action-button",
            `git-conflict-choose-${choice}`
        );
    }
}

class ConflictPanel implements Panel {
    dom = createDiv({ cls: "git-conflict-panel" });
    top = true;

    constructor(private readonly view: EditorView) {
        this.render();
    }

    update(update: ViewUpdate): void {
        if (
            update.docChanged ||
            update.transactions.some((t) => t.reconfigured)
        ) {
            this.render();
        }
    }

    private render(): void {
        this.dom.empty();
        const blocks = this.view.state.field(conflictBlocksField, false) ?? [];
        if (blocks.length === 0) {
            return;
        }
        this.dom.createSpan({
            cls: "git-conflict-panel-label",
            text: `${blocks.length} conflict${
                blocks.length === 1 ? "" : "s"
            } in file`,
        });
        addButtons(
            this.dom.createDiv({ cls: "git-conflict-actions-group" }),
            {
                ours: "Keep all ours",
                theirs: "Keep all theirs",
                both: "Keep both",
            },
            (choice) => resolveAllConflicts(this.view, choice)
        );
    }
}

const conflictPanelConstructor: PanelConstructor = (view) =>
    new ConflictPanel(view);

const conflictPanel = showPanel.compute([conflictBlocksField], (state) =>
    state.field(conflictBlocksField).length > 0
        ? conflictPanelConstructor
        : null
);

export const conflictExtensions = [conflictBlocksField, conflictPanel];
