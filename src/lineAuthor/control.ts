import type { EditorState } from "@codemirror/state";
import { StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { editorEditorField, editorInfoField } from "obsidian";
import { eventsPerFilePathSingleton } from "src/lineAuthor/eventsPerFilepath";
import type { LineAuthoring, LineAuthoringId } from "src/lineAuthor/model";
import { newComputationResultAsTransaction } from "src/lineAuthor/model";

/*
================== CONTROL ======================
Contains classes and function responsible for updating the model
given the changes in the Obsidian UI.
*/

/**
 * Subscribes to changes in the files on a specific filepath.
 * It knows its corresponding editor and initiates editor view changes.
 */
export class LineAuthoringSubscriber {
    private lastSeenPath: string; // remember path to detect and adapt to renames

    constructor(private state: EditorState) {
        this.subscribeMe();
    }

    public notifyLineAuthoring(id: LineAuthoringId, la: LineAuthoring) {
        if (this.view === undefined) {
            console.warn(
                `Git: View is not defined for editor cache key. Unforeseen situation. id: ${id}`
            );
            return;
        }

        // using "this.state" directly here leads to some problems when closing panes. Hence, "this.view.state"
        const state = this.view.state;
        const transaction = newComputationResultAsTransaction(id, la, state);
        this.view.dispatch(transaction);
    }

    public updateToNewState(state: EditorState) {
        // if filepath has changed, then re-subcribe.
        const filepathChanged =
            this.lastSeenPath && this.filepath != this.lastSeenPath;
        this.state = state;

        if (filepathChanged) {
            this.unsubscribeMe(this.lastSeenPath);
            this.subscribeMe();
            // the update of the view by starting a new computation is done by
            // listening to rename events in the line authoring controller.
        }

        return this;
    }

    public removeIfStale(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if ((this.view as any).destroyed) {
            this.unsubscribeMe(this.lastSeenPath);
        }
    }

    private subscribeMe() {
        if (this.filepath === undefined) return; // happens on the very first editor after start.

        eventsPerFilePathSingleton.ifFilepathDefinedTransformSubscribers(
            this.filepath,
            (subs) => subs.add(this)
        );
        this.lastSeenPath = this.filepath;
    }

    private unsubscribeMe(oldFilepath: string) {
        eventsPerFilePathSingleton.ifFilepathDefinedTransformSubscribers(
            oldFilepath,
            (subs) => subs.delete(this)
        );
    }

    private get filepath(): string | undefined {
        return this.state.field(editorInfoField)?.file?.path;
    }

    private get view(): EditorView | undefined {
        return this.state.field(editorEditorField);
    }
}

export type LineAuthoringSubscribers = Set<LineAuthoringSubscriber>;

/**
 * The Codemirror {@link Extension} used to make each editor subscribe itself to this pub-sub.
 */
export const subscribeNewEditor: StateField<LineAuthoringSubscriber> =
    StateField.define<LineAuthoringSubscriber>({
        create: (state) => new LineAuthoringSubscriber(state),
        update: (v, transaction) => v.updateToNewState(transaction.state),
        compare: (a, b) => a === b,
    });
