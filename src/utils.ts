import { requireApiVersion, WorkspaceLeaf } from "obsidian";

export const worthWalking = (filepath: string, root: string) => {
    if (filepath === '.' || root == null || root.length === 0 || root === '.') {
        return true;
    }
    if (root.length >= filepath.length) {
        return root.startsWith(filepath);
    } else {
        return filepath.startsWith(root);
    }
};


export function getNewLeaf(event?: MouseEvent | KeyboardEvent): WorkspaceLeaf {
    let leaf: WorkspaceLeaf;
    if (!event) {
        leaf = app.workspace.getLeaf(false);
    } else {
        if (requireApiVersion("0.16.0")) {
            if (event.ctrlKey && event.altKey && event.shiftKey) {
                leaf = app.workspace.getLeaf("window");
            } else if (event.ctrlKey && event.altKey) {
                leaf = app.workspace.getLeaf("split");
            } else if (event.ctrlKey) {
                leaf = app.workspace.getLeaf("tab");
            } else {
                leaf = app.workspace.getLeaf(false);
            }
        } else {
            if (event.ctrlKey) {
                leaf = app.workspace.getLeaf(true);
            } else {
                leaf = app.workspace.getLeaf(false);
            }
        }
    }
    return leaf;
}