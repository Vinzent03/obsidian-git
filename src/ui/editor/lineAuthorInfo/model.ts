import {
    Annotation,
    AnnotationType,
    EditorState,
    StateField,
    Transaction
} from "@codemirror/state";
import * as moment from "moment";
import { editorViewField, RGB } from "obsidian";
import { DEFAULT_SETTINGS } from "src/constants";
import {
    Blame,
    BlameCommit,
    LineAuthorDateTimeFormatOptions,
    LineAuthorDisplay, LineAuthorFollowMovement, LineAuthorTimezoneOption, ObsidianGitSettings
} from "src/types";

// use a more neutral word for this functionality
export type LineAuthoring = Blame | "untracked";

// This cache key may be too strict.
// We actually don't always want to change the line authro view, when the document changes.
// For instance, when already modified lines are changed
// without creating new lines or deleting some,
// then no new git-blame information is necessary.
// This might be necessary for efficient usage of resources.
// Alternatively, we could simply "apply" the change updates to the git-blame
// and only update the view with the true git-blame after the last change has been at least x milliseconds away.
// Concretely, if the user writes a few new lines, then the gutter should also
// update itself and show the "no previous commit" information for these lines.
// If the user is still and hasn't made any change for say 700ms, then we can
// run git-blame and adapt the view with the true line author information.
// cacheKey = "head" + git-head-hash + "-obj" + object-hash + "-path" + path
export type LineAuthoringId = string;

/** todo. */
export function lineAuthoringId(
    head: string,
    objHash: string,
    path: string
): string | undefined {
    if (head === undefined || objHash === undefined || path === undefined) {
        return undefined;
    }
    return "head" + head + "-obj" + objHash + "-path" + path;
}

// =========================================================

// todo. explain

type LineAuthorAvailable = [LineAuthoringId, LineAuthoring];

const LineAuthorAvailableType: AnnotationType<LineAuthorAvailable> =
    Annotation.define<LineAuthorAvailable>();

export type OptLineAuthoring = [LineAuthoringId, LineAuthoring] | undefined;

export function newComputationResultAsTransaction(
    key: LineAuthoringId,
    result: LineAuthoring,
    state: EditorState
): Transaction {
    return state.update({
        annotations: LineAuthorAvailableType.of([key, result]),
    });
}

export function getLineAuthorAnnotation(tr: Transaction): OptLineAuthoring {
    return tr.annotation(LineAuthorAvailableType);
}

// =========================================================
export const LineAuthorSettingsAvailableType: AnnotationType<LineAuthorSettings> =
    Annotation.define<LineAuthorSettings>();

export function newSettingsAsTransaction(
    settings: LineAuthorSettings,
    state: EditorState
): Transaction {
    return state.update({
        annotations: LineAuthorSettingsAvailableType.of(settings),
    });
}

// =========================================================

/** todo. */
export const lineAuthorState: StateField<OptLineAuthoring> =
    StateField.define<OptLineAuthoring>({
        create: (_state) => undefined,
        update(previousValue, transaction) {
            // We always show the newest thing here. concurrent changes are ignored.
            return getLineAuthorAnnotation(transaction) ?? previousValue;
        },
        compare: (l, r) => l?.[0] === r?.[0],
        // compare cache keys.
        // equality rate is >= 95% :)
        // hence avoids recomputation of views
    });

/** todo. */
export function getObsidianFilepath(state: EditorState): string | undefined {
    return state.field(editorViewField, false)?.file?.path;
}

// =================================================

export type LineAuthorSettings = {
    showCommitHash: boolean;
    followMovement: LineAuthorFollowMovement;
    authorDisplay: LineAuthorDisplay;
    dateTimeFormatOptions: LineAuthorDateTimeFormatOptions;
    dateTimeFormatCustomString: string;
    dateTimeTimezone: LineAuthorTimezoneOption;
    coloringMaxAge: string;
    colorOld: RGB;
    colorNew: RGB;
};

export function settingsFrom(
    settings: ObsidianGitSettings
): LineAuthorSettings {
    return {
        showCommitHash: settings.showCommitHashLineAuthorInfo,
        followMovement: settings.followMovementLineAuthorInfo,
        authorDisplay: settings.authorDisplayLineAuthorInfo,
        dateTimeFormatOptions: settings.dateTimeFormatOptionsLineAuthorInfo,
        dateTimeFormatCustomString:
            settings.dateTimeFormatCustomStringLineAuthorInfo,
        dateTimeTimezone: settings.dateTimeTimezoneLineAuthorInfo,
        coloringMaxAge: settings.coloringMaxAgeLineAuthorInfo,
        colorOld: settings.colorOldLineAuthorInfo,
        colorNew: settings.colorNewLineAuthorInfo,
    };
}

// ===============================================================

export type LineAuthorGutterContextMenuMetadata = {
    creationTime: moment.Moment;
    hash: string;
    commit: BlameCommit;
};

export const zeroCommit: BlameCommit = {
    hash: "000000",
    isZeroCommit: true,
    summary: "",
};

/**
 * Save the latest setting in a global variable to enable new editors to start with
 * updated settings rightaway. This avoids minor flickering due to async updates in the editor.
*/
const latestSettings: LineAuthorSettings = settingsFrom(DEFAULT_SETTINGS);
export function getLatestSettings() {
    return latestSettings;
}
export function updateLatestSettings(settings: LineAuthorSettings) {
    Object.assign(latestSettings, settings);
}
