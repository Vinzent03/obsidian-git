import {
    Annotation,
    AnnotationType,
    EditorState,
    StateField,
    Transaction
} from "@codemirror/state";
import { RGB } from "obsidian";
import { parseColoringMaxAgeDuration } from "src/settings";
import {
    Blame
} from "src/types";

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

export type LineAuthoringWithId = { la: LineAuthoring; key: LineAuthoringId };

/**
 * The {@link Annotation} used in Codemirror {@link Transaction}s to
 * update the {@link EditorState} with the {@link LineAuthoring}, that should be displayed.
 * 
 * See users of {@link newComputationResultAsTransaction} for the value providers.
 * The {@link StateField} {@link lineAuthorState} hold the value of this transaction.
 */
const LineAuthoringContainerType: AnnotationType<LineAuthoringWithId> =
    Annotation.define<LineAuthoringWithId>();

export function newComputationResultAsTransaction(
    key: LineAuthoringId,
    la: LineAuthoring,
    state: EditorState
): Transaction {
    return state.update({
        annotations: LineAuthoringContainerType.of({ key, la }),
    });
}

function getLineAuthorAnnotation(tr: Transaction): LineAuthoringWithId | undefined {
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
 */
export const lineAuthorState: StateField<LineAuthoringWithId | undefined> =
    StateField.define<LineAuthoringWithId | undefined>({
        create: (_state) => undefined,
        update(previousValue, transaction) {
            // We always show the newest thing here. concurrent changes are ignored.
            return getLineAuthorAnnotation(transaction) ?? previousValue;
        },
        // compare cache keys.
        // equality rate is >= 95% :)
        // hence avoids recomputation of views
        compare: (l, r) => l?.key === r?.key,
    });

// =============== Line Authoring Settings =================

export type LineAuthorSettings = {
    show: boolean;
    showCommitHash: boolean;
    followMovement: LineAuthorFollowMovement;
    authorDisplay: LineAuthorDisplay;
    dateTimeFormatOptions: LineAuthorDateTimeFormatOptions;
    dateTimeFormatCustomString: string;
    dateTimeTimezone: LineAuthorTimezoneOption;
    coloringMaxAge: string;
    colorOld: RGB;
    colorNew: RGB;
    gutterSpacingFallbackLength: number;
};

export type LineAuthorFollowMovement = "inactive" | "same-commit" | "all-commits"

export type LineAuthorDisplay = 'hide' | 'full' | 'first name' | 'last name' | 'initials';

export type LineAuthorDateTimeFormatOptions = "hide" | "date" | "datetime" | "natural language" | "custom";

export type LineAuthorTimezoneOption = "viewer-local" | "author-local" | "utc0000";

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
    save: undefined! as (settings: LineAuthorSettings) => void
}

export function provideSettingsAccess(
    settingsGetter: () => LineAuthorSettings,
    settingsSetter: (settings: LineAuthorSettings) => void,
) {
    latestSettings.get = settingsGetter;
    latestSettings.save = settingsSetter;
}

export function maxAgeInDaysFromSettings(settings: LineAuthorSettings) {
    return parseColoringMaxAgeDuration(settings.coloringMaxAge)?.asDays() ?? 356;
}