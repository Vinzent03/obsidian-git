import { html } from "diff2html";
import { ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { DIFF_VIEW_CONFIG } from "src/constants";
import ObsidianGit from "src/main";
import { DiffViewState } from "src/types";


export default class DiffView extends ItemView {
    parser: DOMParser;
    gettingDiff: boolean = false;
    state: DiffViewState;

    constructor(leaf: WorkspaceLeaf, private plugin: ObsidianGit) {
        super(leaf);
        this.parser = new DOMParser();
        addEventListener('git-refresh', this.refresh.bind(this));
    }

    getViewType(): string {
        return DIFF_VIEW_CONFIG.type;
    }

    getDisplayText(): string {
        return DIFF_VIEW_CONFIG.name;
    }

    getIcon(): string {
        return DIFF_VIEW_CONFIG.icon;
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        this.state = state;

        await this.refresh();
        return;
    }

    getState() {
        return this.state;
    }

    onClose(): Promise<void> {
        removeEventListener('git-refresh', this.refresh.bind(this));
        return super.onClose();
    }

    onOpen(): Promise<void> {
        this.refresh();
        return super.onOpen();
    }

    async refresh(): Promise<void> {
        if (this.state?.file && !this.gettingDiff && this.plugin.gitManager) {

            this.gettingDiff = true;
            const diff = this.parser.parseFromString(
                html(await this.plugin.gitManager.getDiffString(this.state.file, this.state.staged)),
                'text/html')
                .querySelector('.d2h-file-diff');
            this.contentEl.empty();
            if (diff) {
                this.contentEl.append(diff);
            } else {
                const div = this.contentEl.createDiv({ cls: 'diff-err' });
                div.createSpan({ text: '⚠️', cls: 'diff-err-sign' });
                div.createEl('br');
                div.createSpan({ text: 'No changes to ' + this.state.file });
            }
            this.gettingDiff = false;

        }
    }

}
