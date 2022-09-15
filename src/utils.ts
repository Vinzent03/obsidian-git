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


export function getNewLeaf(): WorkspaceLeaf {
    let leaf: WorkspaceLeaf;
    if (requireApiVersion("0.16.0")) {
        leaf = app.workspace.getLeaf("tab");
    } else {
        leaf = app.workspace.createLeafInParent(app.workspace.rootSplit, 0);
    }
    return leaf;
}