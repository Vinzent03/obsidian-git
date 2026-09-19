import { StateField, type EditorState, type Range } from "@codemirror/state";
import {
    Decoration,
    EditorView,
    showPanel,
    WidgetType,
    type DecorationSet,
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
import { resolveAllConflicts, resolveConflict } from "./actions";
import {
    parseConflictBlocks,
    type ConflictBlock,
    type ConflictChoice,
} from "./model";

const CHOICES = ["ours", "base", "theirs", "both"] as const;

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
    labels: Partial<Record<ConflictChoice, string>>,
    onPick: (choice: ConflictChoice) => void
): void {
    for (const choice of CHOICES) {
        const label = labels[choice];
        if (label === undefined) {
            continue;
        }
        const button = new ButtonComponent(group)
            .setButtonText(label)
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

class ConflictButtonsWidget extends WidgetType {
    constructor(private readonly block: ConflictBlock) {
        super();
    }

    eq(other: ConflictButtonsWidget): boolean {
        return (
            other.block.from === this.block.from &&
            other.block.to === this.block.to &&
            other.block.ours === this.block.ours &&
            other.block.theirs === this.block.theirs &&
            other.block.base === this.block.base
        );
    }

    toDOM(view: EditorView): HTMLElement {
        const root = createDiv({
            cls: "git-conflict-actions-group git-conflict-actions-widget",
        });
        const labels: Partial<Record<ConflictChoice, string>> = {
            ours: "Keep ours",
            theirs: "Keep theirs",
            both: "Keep both",
        };
        if (this.block.base !== undefined) {
            labels.base = "Keep base";
        }
        addButtons(root, labels, (choice) =>
            resolveConflict(view, this.block, choice)
        );
        return root;
    }
}

function addSectionDecorations(
    decorations: Range<Decoration>[],
    state: EditorState,
    range: { from: number; to: number },
    lineClass: string
): void {
    if (range.from >= range.to) {
        return;
    }
    const firstLine = state.doc.lineAt(range.from).number;
    const lastLine = state.doc.lineAt(range.to - 1).number;
    for (let n = firstLine; n <= lastLine; n++) {
        decorations.push(
            Decoration.line({ class: lineClass }).range(state.doc.line(n).from)
        );
    }
}

function buildDecorations(state: EditorState): DecorationSet {
    const blocks = state.field(conflictBlocksField, false) ?? [];
    const decorations: Range<Decoration>[] = [];
    for (const block of blocks) {
        const headMarker = block.markers[0]!;
        for (const [index, marker] of block.markers.entries()) {
            const sideClass =
                index === 0
                    ? " git-conflict-marker-ours"
                    : index === block.markers.length - 1
                      ? " git-conflict-marker-theirs"
                      : "";
            decorations.push(
                Decoration.line({
                    class: `git-conflict-marker-line${sideClass}`,
                }).range(marker.from),
                Decoration.mark({
                    class: `git-conflict-marker${sideClass}`,
                }).range(marker.from, marker.to)
            );
        }
        decorations.push(
            Decoration.widget({
                widget: new ConflictButtonsWidget(block),
                side: 1,
            }).range(headMarker.to)
        );
        addSectionDecorations(
            decorations,
            state,
            block.oursRange,
            "git-conflict-ours-line"
        );
        if (block.baseRange !== undefined) {
            addSectionDecorations(
                decorations,
                state,
                block.baseRange,
                "git-conflict-base-line"
            );
        }
        addSectionDecorations(
            decorations,
            state,
            block.theirsRange,
            "git-conflict-theirs-line"
        );
    }
    return Decoration.set(decorations, true);
}

export const conflictMarkersField = StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state),
    update: (value, transaction) =>
        transaction.docChanged || transaction.reconfigured
            ? buildDecorations(transaction.state)
            : value,
    provide: (field) => EditorView.decorations.from(field),
});

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
        const labels: Partial<Record<ConflictChoice, string>> = {
            ours: "Keep all ours",
            theirs: "Keep all theirs",
            both: "Keep both",
        };
        if (blocks.every((block) => block.base !== undefined)) {
            labels.base = "Keep all base";
        }
        addButtons(
            this.dom.createDiv({ cls: "git-conflict-actions-group" }),
            labels,
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

export const conflictExtensions = [
    conflictBlocksField,
    conflictMarkersField,
    conflictPanel,
];
