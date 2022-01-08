import { html } from "diff2html";
import { ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";
import { DIFF_VIEW_CONFIG } from "src/constants";
import ObsidianGit from "src/main";


export default class DiffView extends ItemView {

    filePath: string;
    parser: DOMParser;
    intervalId: number;
    gettingDiff: boolean = false;
    constructor(leaf: WorkspaceLeaf, private plugin: ObsidianGit) {
        super(leaf);
        this.parser = new DOMParser();

        this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
            if (leaf.view instanceof MarkdownView) {
                this.filePath = leaf.view.file.path;
            } else {
                this.filePath = null;
            }
            this.refresh();
        }));
        addEventListener('diff-update', this.firstOpen.bind(this));
        this.intervalId = window.setInterval(() => this.refresh(), 10000);
        this.registerInterval(this.intervalId);
    }

    firstOpen(event: CustomEvent) {
        this.filePath = event.detail.path;
        this.refresh();
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

    onClose(): Promise<void> {
        removeEventListener('diff-update', this.firstOpen.bind(this));
        window.clearInterval(this.intervalId);
        return super.onClose();
    }

    onOpen(): Promise<void> {
        this.refresh();
        return super.onOpen();
    }

    async refresh(): Promise<void> {
        if (this.filePath && !this.gettingDiff) {
            if (!this.app.vault.getAbstractFileByPath(this.filePath)) {
                this.contentEl.empty();
                const div = this.contentEl.createDiv({ cls: 'diff-err' });
                div.createSpan({ text: '⚠️', cls: 'diff-err-sign' });
                div.createEl('br');
                div.createSpan({ text: this.filePath + ' was deleted' });
            } else {
                this.gettingDiff = true;
                const diff = this.parser.parseFromString(
                    html(await this.plugin.gitManager.getDiffString(this.filePath)),
                    'text/html')
                    .querySelector('.d2h-file-diff');
                this.contentEl.empty();
                if (diff) {
                    this.contentEl.append(diff);
                } else {
                    const div = this.contentEl.createDiv({ cls: 'diff-err' });
                    div.createSpan({ text: '⚠️', cls: 'diff-err-sign' });
                    div.createEl('br');
                    div.createSpan({ text: 'No changes to' + this.filePath });
                }
                this.gettingDiff = false;
            }
        }
    }

}
