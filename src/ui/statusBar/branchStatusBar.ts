import type ObsidianGit from "src/main";

export class BranchStatusBar {
    constructor(
        private statusBarEl: HTMLElement,
        private readonly plugin: ObsidianGit
    ) {
        this.statusBarEl.addClass("mod-clickable");
        this.statusBarEl.onClickEvent((_) => {
            this.plugin.switchBranch().catch((e) => plugin.displayError(e));
        });
    }

    async display() {
        if (this.plugin.gitReady) {
            const branchInfo = await this.plugin.gitManager.branchInfo();
            if (branchInfo.current != undefined) {
                this.statusBarEl.setText(branchInfo.current);
            } else {
                this.statusBarEl.empty();
            }
        } else {
            this.statusBarEl.empty();
        }
    }

    remove() {
        this.statusBarEl.remove();
    }
}
