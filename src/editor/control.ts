import type { EditorState } from "@codemirror/state";
import { StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { editorEditorField, editorInfoField } from "obsidian";
import { eventsPerFilePathSingleton } from "./eventsPerFilepath";
import type { LineAuthoring, LineAuthoringId } from "./lineAuthor/model";
import { newComputationResultAsTransaction } from "./lineAuthor/model";
import {
    hunksState,
    newGitCompareResultAsTransaction,
    type GitCompareResult,
} from "./signs/hunkState";

/*
================== CONTROL ======================
Contains classes and function responsible for updating the model
given the changes in the Obsidian UI.
*/

/**
 * Subscribes to changes in the files on a specific filepath.
 * It knows its corresponding editor and initiates editor view changes.
 */
export class FileSubscriber {
    private lastSeenPath!: string; // remember path to detect and adapt to renames

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

    public notifyGitCompare(data: GitCompareResult) {
        if (this.view === undefined) {
            console.warn(
                `Git: View is not defined for editor cache key. Unforeseen situation. id: `
            );
            //TODO removed it above in the error message
            return;
        }

        // Prevent updates to stale subscribers
        if (this.removeIfStale()) {
            return;
        }

        // using "this.state" directly here leads to some problems when closing panes. Hence, "this.view.state"
        const state = this.view.state;
        const hunkState = state.field(hunksState);
        if (
            !hunkState ||
            hunkState.compareText != data.compareText ||
            hunkState.compareTextHead != data.compareTextHead
        ) {
            const transaction = newGitCompareResultAsTransaction(data, state);

            this.view.dispatch(transaction);
        }
    }

    public updateToNewState(state: EditorState) {
        this.state = state;

        // If no filepath was previously available subscribe now
        if (!this.lastSeenPath && this.filepath) {
            this.subscribeMe();
            // the update of the view by starting a new computation is done by
            // listening to rename events in the line authoring controller.
        }

        return this;
    }

    public removeIfStale(): boolean {
        // If a new `subscribeNewEditor` field has been created, then this instance is stale.
        // This happens when in the same leaf and `EditorView` a new file is opened
        if (
            this.view?.state.field(subscribeNewEditor, false) != this ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            (this.view as any).destroyed
        ) {
            this.unsubscribeMe(this.lastSeenPath);
            return true;
        }
        return false;
    }

    // When a file is renamed, the editor's filepath changes.
    // So we resubscribe all editors to the new filepath.
    public changeToNewFilepath(filepath: string) {
        this.unsubscribeMe(this.lastSeenPath);
        this.subscribeMe(filepath);
        // the update of the view by starting a new computation is done by
        // listening to rename events in the line authoring controller.
    }

    private subscribeMe(filepath?: string) {
        filepath ??= this.filepath;
        if (filepath === undefined) return; // happens on the very first editor after start.

        eventsPerFilePathSingleton.ifFilepathDefinedTransformSubscribers(
            filepath,
            (subs) => subs.add(this)
        );
        this.lastSeenPath = filepath;
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

export type FileSubscribers = Set<FileSubscriber>;

/**
 * The Codemirror {@link Extension} used to make each editor subscribe itself to this pub-sub.
 */
export const subscribeNewEditor: StateField<FileSubscriber> =
    StateField.define<FileSubscriber>({
        create: (state) => new FileSubscriber(state),
        update: (v, transaction) => v.updateToNewState(transaction.state),
        compare: (a, b) => a === b,
    });
