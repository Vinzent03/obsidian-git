
import { Editor, MarkdownView, Menu } from "obsidian";
import { zeroCommit } from "src/simpleGit";
import { BlameCommit } from "src/types";
import { currentMoment } from "src/utils";

type LineAuthorGutterContextMenuMetadata = {
    creationTime: moment.Moment;
    commit: BlameCommit;
};

/**
 * Stores the last clicked line authoring gutter in a global variable.
 * We need this, because no other way was found on how we can access the click-target
 * on an Obsidian "context-menu" event.
 * 
 * With {@link registerLastClickedGutterHandler}, we register each mousedown event
 * on the line authoring gutters and save the commit information for that hash.
 * 
 * When the context menu is handled in {@link handleContextMenu}, we can
 * access this global variable and adapt the context menu based on that.
 * 
 * We also use {@link gutterWasRecentlyClicked} to ensure, that the context-menu shown
 * really corresponds to the mousedown for the same click.
 * 
 * The value is initialised with the zero commit for fallback safety.
 */
export const latestClickedLineAuthorGutter: LineAuthorGutterContextMenuMetadata = {
    creationTime: currentMoment(),
    commit: zeroCommit
};

export function registerLastClickedGutterHandler(
    elt: HTMLElement, commit: BlameCommit
) {
    elt.onmousedown = (_e) => {
        const newMetadata: LineAuthorGutterContextMenuMetadata = {
            commit, creationTime: currentMoment()
        };
        Object.assign(latestClickedLineAuthorGutter, newMetadata);
    };
}

export function handleContextMenu(menu: Menu, editor: Editor, _mdv: MarkdownView) {
    // Click was inside text-editor with active cursor. Don't trigger there.
    if (editor.hasFocus())
        return;

    if (!gutterWasRecentlyClicked())
        return;

    // Deactivate context-menu item for the zero commit
    if (latestClickedLineAuthorGutter.commit.isZeroCommit)
        return;

    addCopyHashMenuItem(menu);
}

function gutterWasRecentlyClicked(): boolean {
    return currentMoment()
        .diff(latestClickedLineAuthorGutter.creationTime, "milliseconds") <= 300;
}

function addCopyHashMenuItem(menu: Menu) {
    menu.addItem((item) =>
        item
            .setTitle("Copy commit hash")
            .setIcon("copy")
            .onClick((_e) => navigator.clipboard.writeText(latestClickedLineAuthorGutter.commit.hash))
    );
}