import type { Editor, MarkdownView, Menu } from "obsidian";
import { DEFAULT_SETTINGS } from "src/constants";
import type { LineAuthorSettings } from "src/lineAuthor/model";
import { findGutterElementUnderMouse } from "src/lineAuthor/view/gutter/gutterElementSearch";
import { pluginRef } from "src/pluginGlobalRef";
import type { BlameCommit } from "src/types";
import { impossibleBranch } from "src/utils";

type ContextMenuConfigurableSettingsKeys =
    | "showCommitHash"
    | "authorDisplay"
    | "dateTimeFormatOptions";

type CtxMenuCommitInfo = Pick<BlameCommit, "hash" | "isZeroCommit"> & {
    isWaitingGutter: boolean;
};
const COMMIT_ATTR = "data-commit";

export function handleContextMenu(
    menu: Menu,
    editor: Editor,
    _mdv: MarkdownView
) {
    // Click was inside text-editor with active cursor. Don't trigger there.
    if (editor.hasFocus()) return;

    const gutterElement = findGutterElementUnderMouse();
    if (!gutterElement) return;

    const info = getCommitInfo(gutterElement);
    if (!info) return;

    // Zero-commit and waiting-for-result must not be copied
    if (!info.isZeroCommit && !info.isWaitingGutter) {
        addCopyHashMenuItem(info, menu);
    }

    addConfigurableLineAuthorSettings("showCommitHash", menu);
    addConfigurableLineAuthorSettings("authorDisplay", menu);
    addConfigurableLineAuthorSettings("dateTimeFormatOptions", menu);
}

function addCopyHashMenuItem(commit: CtxMenuCommitInfo, menu: Menu) {
    menu.addItem((item) =>
        item
            .setTitle("Copy commit hash")
            .setIcon("copy")
            .setSection("obs-git-line-author-copy")
            .onClick((_e) => navigator.clipboard.writeText(commit.hash))
    );
}

function addConfigurableLineAuthorSettings(
    key: ContextMenuConfigurableSettingsKeys,
    menu: Menu
) {
    let title: string;
    let actionNewValue: LineAuthorSettings[typeof key];

    const settings = pluginRef.plugin!.settings.lineAuthor;
    const currentValue = settings[key];
    const currentlyShown =
        typeof currentValue === "boolean"
            ? currentValue
            : currentValue !== "hide";

    const defaultValue = DEFAULT_SETTINGS.lineAuthor[key];

    if (key === "showCommitHash") {
        title = "Show commit hash";
        actionNewValue = <LineAuthorSettings["showCommitHash"]>currentValue;
    } else if (key === "authorDisplay") {
        const showOption = settings.lastShownAuthorDisplay ?? defaultValue;
        title = "Show author " + (currentlyShown ? currentValue : showOption);
        actionNewValue = currentlyShown ? "hide" : showOption;
    } else if (key === "dateTimeFormatOptions") {
        const showOption =
            settings.lastShownDateTimeFormatOptions ?? defaultValue;
        title = "Show " + (currentlyShown ? currentValue : showOption);
        title += !title.contains("date") ? " date" : "";
        actionNewValue = currentlyShown ? "hide" : showOption;
    } else {
        impossibleBranch(key);
    }

    menu.addItem((item) =>
        item
            .setTitle(title)
            .setSection("obs-git-line-author-configure") // group settings together
            .setChecked(currentlyShown)
            .onClick((_e) =>
                pluginRef.plugin?.settingsTab?.lineAuthorSettingHandler(
                    key,
                    actionNewValue
                )
            )
    );
}

export function enrichCommitInfoForContextMenu(
    commit: BlameCommit,
    isWaitingGutter: boolean,
    elt: HTMLElement
) {
    elt.setAttr(
        COMMIT_ATTR,
        JSON.stringify(<CtxMenuCommitInfo>{
            hash: commit.hash,
            isZeroCommit: commit.isZeroCommit,
            isWaitingGutter,
        })
    );
}

function getCommitInfo(elt: HTMLElement): CtxMenuCommitInfo | undefined {
    const commitInfoStr = elt.getAttr(COMMIT_ATTR);
    return commitInfoStr
        ? (JSON.parse(commitInfoStr) as CtxMenuCommitInfo)
        : undefined;
}
