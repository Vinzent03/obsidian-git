import type {
    AnnotationType,
    EditorState,
    Transaction,
} from "@codemirror/state";
import { Annotation, StateField } from "@codemirror/state";
import type { Hasher } from "js-sha256";
import { sha256 } from "js-sha256";
import type { RGB } from "obsidian";
import { DEFAULT_SETTINGS } from "src/constants";
import { parseColoringMaxAgeDuration } from "src/setting/settings";
import type { Blame } from "src/types";

/*
================== MODEL ======================
Contains types and variables describing the essential
contents of the line authoring and further types.
*/

// use a more neutral word for this functionality
export type LineAuthoring = Blame | "untracked";

/**
 * An identifier for each line authoring.
 *
 * For every {@link LineAuthoring} there is exactly one valid corresponding {@link LineAuthoringId}
 * This is used to disambiguate differing line authoring content.
 *
 * For instance, when there are UI-changes in an editor, we want to quickly figure out
 * whether the LineAuthoring has changed as well. Computing this cache-identifiying key/id
 * allows us to quickly find that out and avoid re-computing the result, if the corresponding
 * line authoring already has been computed. This is used in lineAuthorInfoProvider.ts.
 *
 * This implementation assumes, that each {@link LineAuthoring} is unique, given
 * the HEAD revision of the git repository, the hash of the current contents of the file and
 * the path to the file within the vault. The exact syntax is determined by {@link lineAuthoringId}.
 *
 * * HEAD: This ensures, that adding a new commit or changing the checked out revision
 *      forces re-computation.
 *   * We always want to use the submodule which contains the file rather than any super-project,
 *     as the file is only committed in lowest level submodule - and only it's HEAD revision
 *     will be updated during a commit.
 * * contents-hash: Whenever the contents of the file produce a different hash,
 *      the view needs updating - hence the re-computation.
 * * the path of the file in git matters as well, as the exact file content at different
 *      paths in a git repository can have different histories
 */
export type LineAuthoringId = string;

export function lineAuthoringId(
    head: string,
    objHash: string,
    path: string
): string | undefined {
    if (head === undefined || objHash === undefined || path === undefined) {
        return undefined;
    }
    return `head${head}-obj${objHash}-path${path}`;
}

// =================== LineAuthoring inside a Codemirror Transaction =====================

export type LineAuthoringWithChanges = {
    la: LineAuthoring;
    key: LineAuthoringId;
    /**
     * See {@link enrichUnsavedChanges}
     */
    lineOffsetsFromUnsavedChanges: Map<number, number>;
};

/**
 * The {@link Annotation} used in Codemirror {@link Transaction}s to
 * update the {@link EditorState} with the {@link LineAuthoring}, that should be displayed.
 *
 * See users of {@link newComputationResultAsTransaction} for the value providers.
 * The {@link StateField} {@link lineAuthorState} hold the value of this transaction.
 */
const LineAuthoringContainerType: AnnotationType<LineAuthoringWithChanges> =
    Annotation.define<LineAuthoringWithChanges>();

export function newComputationResultAsTransaction(
    key: LineAuthoringId,
    la: LineAuthoring,
    state: EditorState
): Transaction {
    return state.update({
        annotations: LineAuthoringContainerType.of({
            key,
            la,
            lineOffsetsFromUnsavedChanges: new Map(),
        }),
    });
}

function getLineAuthorAnnotation(
    tr: Transaction
): LineAuthoringWithChanges | undefined {
    return tr.annotation(LineAuthoringContainerType);
}

// ================ Codemirror StateField containing the current Line Authoring ===================

/**
 * The Codemirror {@link StateField} which contains the current {@link LineAuthoring}
 * that is being shown.
 *
 * The update method extracts the value from the annotation, if one is provided.
 *
 * Strictly speaking, if the annotation of a previous and outdated computation
 * appears after a new a recent one, it might happen, that the old and stale one
 * will be shown instead. This is because we only ever show the annotation which
 * was most recently in a transaction - and we do not track any time here.
 *
 * When caching this, please use {@link laStateDigest} to compute the key.
 */
export const lineAuthorState: StateField<LineAuthoringWithChanges | undefined> =
    StateField.define<LineAuthoringWithChanges | undefined>({
        create: (_state) => undefined,
        /**
         * The state can be updated from either an annotated transaction containing
         * the newest line authoring (for the saved document) - or from
         * unsaved changes of the document as the user is actively typing in the editor.
         *
         * In the first case, we take the new line authoring and discard anything we had remembered
         * from unsaved changes. In the second case, we use the unsaved changes in {@link enrichUnsavedChanges} to pre-compute information to immediately update the
         * line author gutter without needing to wait until the document is saved and the
         * line authoring is properly computed.
         */
        update: (previous, transaction) =>
            getLineAuthorAnnotation(transaction) ??
            enrichUnsavedChanges(transaction, previous),
        // compare cache keys.
        // equality rate is >= 95% :)
        // hence avoids recomputation of views
        compare: (l, r) => l?.key === r?.key,
    });

export function laStateDigest(
    laState: LineAuthoringWithChanges | undefined
): Hasher {
    const digest = sha256.create();
    if (!laState) return digest;

    const { la, key, lineOffsetsFromUnsavedChanges } = laState;
    digest.update(la === "untracked" ? "t" : "f");
    digest.update(key);
    for (const [k, v] of lineOffsetsFromUnsavedChanges.entries() ?? [])
        digest.update([k, v]);
    return digest;
}

// =============== Line Authoring Settings =================

export type LineAuthorSettings = {
    show: boolean;
    showCommitHash: boolean;
    followMovement: LineAuthorFollowMovement;
    authorDisplay: LineAuthorDisplay;
    lastShownAuthorDisplay?: LineAuthorDisplay;
    dateTimeFormatOptions: LineAuthorDateTimeFormatOptions;
    lastShownDateTimeFormatOptions?: LineAuthorDateTimeFormatOptions;
    dateTimeFormatCustomString: string;
    dateTimeTimezone: LineAuthorTimezoneOption;
    coloringMaxAge: string;
    colorOld: RGB;
    colorNew: RGB;
    textColorCss: string;
    ignoreWhitespace: boolean;
    gutterSpacingFallbackLength: number;
};

export type LineAuthorFollowMovement =
    | "inactive"
    | "same-commit"
    | "all-commits";

export type LineAuthorDisplay =
    | "hide"
    | "full"
    | "first name"
    | "last name"
    | "initials";

export type LineAuthorDateTimeFormatOptions =
    | "hide"
    | "date"
    | "datetime"
    | "natural language"
    | "custom";

export type LineAuthorTimezoneOption =
    | "viewer-local"
    | "author-local"
    | "utc0000";

// ===============================================================

/**
 * Global mutable container to get access to the latest Obsidian settings.
 *
 * This is stored here globally and populated during line author feature loading
 * via {@link provideSettingsAccess}.
 *
 * It is used to provide the editors with the recent settings when created, as this allows
 * us to create the correct spacing up-front as well as have the latest settings
 * when rendering.
 */
export const latestSettings = {
    get: undefined! as () => LineAuthorSettings,
    save: undefined! as (settings: LineAuthorSettings) => void,
};

export function provideSettingsAccess(
    settingsGetter: () => LineAuthorSettings,
    settingsSetter: (settings: LineAuthorSettings) => void
) {
    latestSettings.get = settingsGetter;
    latestSettings.save = settingsSetter;
}

export function maxAgeInDaysFromSettings(settings: LineAuthorSettings) {
    return (
        parseColoringMaxAgeDuration(settings.coloringMaxAge)?.asDays() ??
        parseColoringMaxAgeDuration(
            DEFAULT_SETTINGS.lineAuthor.coloringMaxAge
        )!.asDays()
    );
}

/**
 * Given a transaction containing editor changes and the previous line author state,
 * we want to update the `lineOffsetsFromUnsavedChanges` in {@link LineAuthoringWithChanges}.
 *
 * This property contains for each line `ln` in the new document the following:
 * * if the line has not been changed, then it is not contained and `<map>.get(ln)` is undefined.
 * * if the line has been changed and its ChangeSet does not change the number of lines,
 *   then `<map>.get(ln)` is 0.
 * * if the line has been changed and its ChangeSet indicates that the number of lines has changed
 *   (e.g. removed or added lines), then all but the last lines in the ChangeSet will have
 *   `<map>.get(ln)=0` and the last line will have `<map>.get(ln)=n` where `n` is the number
 *   of added lines. If `n` is negative, then lines have been removed instead.
 */
function enrichUnsavedChanges(
    tr: Transaction,
    prev: LineAuthoringWithChanges | undefined
): LineAuthoringWithChanges | undefined {
    if (!prev) return undefined;

    if (!tr.changes.empty) {
        tr.changes.iterChanges((fromA, toA, fromB, toB) => {
            const oldDoc = tr.startState.doc;
            const { newDoc } = tr;

            const beforeFrom = oldDoc.lineAt(fromA).number;
            const beforeTo = oldDoc.lineAt(toA).number;

            const afterFrom = newDoc.lineAt(fromB).number;
            const afterTo = newDoc.lineAt(toB).number;

            const beforeLen = beforeTo - beforeFrom + 1;
            const afterLen = afterTo - afterFrom + 1;

            /*
            Current change:
            The lines beforeFrom..beforeTo (containing beforeLen lines) in the old doc
            have been replaced by
            the lines afterFrom..afterTo (containing afterLen lines) in the new doc.
            */

            // The lines afterFrom..afterTo for which we want to
            // set an offset in lineOffsetsFromUnsavedChanges.
            for (let afterI = afterFrom; afterI <= afterTo; afterI++) {
                // Multiple changes can be made from the current transaction
                // as well as from previous transactions since the last document save.
                // Hence, we want to cumulate all offsets.
                let offset =
                    prev.lineOffsetsFromUnsavedChanges.get(afterI) ?? 0;

                const isLastLine = afterTo === afterI;

                // positive = added lines, negative = removed lines.
                const changeInNumberOfLines = afterLen - beforeLen;
                if (isLastLine) offset += changeInNumberOfLines;

                prev.lineOffsetsFromUnsavedChanges.set(afterI, offset);
            }
        });
    }

    return prev;
}
