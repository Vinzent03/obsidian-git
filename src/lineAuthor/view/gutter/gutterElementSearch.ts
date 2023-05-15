import { attachedGutterElements } from "src/lineAuthor/view/cache";

const mouseXY = { x: -10, y: -10 };

// todo. According to a discord message from the Obsidian Team, the source bug
// will be fixed in the next release. Then this hack should be removed.
/**
 * Stores the last MouseDownEvent clientX and clientY position.
 *
 * This is part of the 'hack' to be able to detect the line author gutter element below
 * the mouse as part of the context menu. This is necessary, as I couldn't find
 * a way to retrieve the target gutter from the Obsidian "editor-menu" event.
 */
export function prepareGutterSearchForContextMenuHandling() {
    if (mouseXY.x === -10) {
        // event listener is not yet registered
        window.addEventListener("mousedown", (e) => {
            mouseXY.x = e.clientX;
            mouseXY.y = e.clientY;
        });
    }
}

export function findGutterElementUnderMouse(): HTMLElement | undefined {
    for (const elt of attachedGutterElements) {
        if (contains(elt, mouseXY)) return elt;
    }
}

function contains(elt: HTMLElement, pt: { x: number; y: number }): boolean {
    const { x, y, width, height } = elt.getBoundingClientRect();
    return x <= pt.x && pt.x <= x + width && y <= pt.y && pt.y <= y + height;
}
