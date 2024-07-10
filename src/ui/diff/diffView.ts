import { html } from "diff2html";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import { ItemView, Platform } from "obsidian";
import { DIFF_VIEW_CONFIG } from "src/constants";
import { SimpleGit } from "src/gitManager/simpleGit";
import type ObsidianGit from "src/main";
import type { DiffViewState } from "src/types";

export default class DiffView extends ItemView {
    parser: DOMParser;
    gettingDiff = false;
    state: DiffViewState;
    gitRefreshBind = this.refresh.bind(this);
    gitViewRefreshBind = this.refresh.bind(this);

    constructor(
        leaf: WorkspaceLeaf,
        private plugin: ObsidianGit
    ) {
        super(leaf);
        this.parser = new DOMParser();
        this.navigation = true;
        addEventListener("git-refresh", this.gitRefreshBind);
        addEventListener("git-view-refresh", this.gitViewRefreshBind);
    }

    getViewType(): string {
        return DIFF_VIEW_CONFIG.type;
    }

    getDisplayText(): string {
        if (this.state?.file != null) {
            let fileName = this.state.file.split("/").last();
            if (fileName?.endsWith(".md")) fileName = fileName.slice(0, -3);

            return DIFF_VIEW_CONFIG.name + ` (${fileName})`;
        }
        return DIFF_VIEW_CONFIG.name;
    }

    getIcon(): string {
        return DIFF_VIEW_CONFIG.icon;
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        this.state = state;

        if (Platform.isMobile) {
            //Update view title on mobile only to show the file name of the diff
            this.leaf.view.titleEl.textContent = this.getDisplayText();
        }

        await this.refresh();
    }

    getState() {
        return this.state;
    }

    onClose(): Promise<void> {
        removeEventListener("git-refresh", this.gitRefreshBind);
        removeEventListener("git-view-refresh", this.gitViewRefreshBind);
        return super.onClose();
    }

    onOpen(): Promise<void> {
        this.refresh();
        return super.onOpen();
    }

    async refresh(): Promise<void> {
        if (this.state?.file && !this.gettingDiff && this.plugin.gitManager) {
            this.gettingDiff = true;
            try {
                let diff = await this.plugin.gitManager.getDiffString(
                    this.state.file,
                    this.state.staged,
                    this.state.hash
                );
                this.contentEl.empty();

                if (!diff) {
                    if (
                        this.plugin.gitManager instanceof SimpleGit &&
                        (await this.plugin.gitManager.isTracked(
                            this.state.file
                        ))
                    ) {
                        diff = [
                            `--- ${this.state.file}`,
                            `+++ ${this.state.file}`,
                            "",
                        ].join("\n");
                    } else {
                        const content = await this.app.vault.adapter.read(
                            this.plugin.gitManager.getRelativeVaultPath(
                                this.state.file
                            )
                        );
                        const header = `--- /dev/null
+++ ${this.state.file}
@@ -0,0 +1,${content.split("\n").length} @@`;

                        diff = [
                            ...header.split("\n"),
                            ...content.split("\n").map((line) => `+${line}`),
                        ].join("\n");
                    }
                }

                const diffEl = this.parser
                    .parseFromString(html(diff), "text/html")
                    .querySelector(".d2h-file-diff");
                this.contentEl.append(diffEl!);
                // const div = this.contentEl.createDiv({ cls: 'diff-err' });
                // div.createSpan({ text: '⚠️', cls: 'diff-err-sign' });
                // div.createEl('br');
                // div.createSpan({ text: 'No changes to ' + this.state.file });
            } finally {
                this.gettingDiff = false;
            }
        }
    }
}
