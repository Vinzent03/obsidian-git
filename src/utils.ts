import { Keymap, WorkspaceLeaf } from "obsidian";

export const worthWalking = (filepath: string, root?: string) => {
    if (filepath === '.' || root == null || root.length === 0 || root === '.') {
        return true;
    }
    if (root.length >= filepath.length) {
        return root.startsWith(filepath);
    } else {
        return filepath.startsWith(root);
    }
};


export function getNewLeaf(event?: MouseEvent): WorkspaceLeaf | undefined {
    let leaf: WorkspaceLeaf | undefined;
    if (event) {
        if ((event.button === 0 || event.button === 1)) {
            const type = Keymap.isModEvent(event);
            leaf = app.workspace.getLeaf(type);
        }
    } else {
        leaf = app.workspace.getLeaf(false);

    }
    return leaf;
}