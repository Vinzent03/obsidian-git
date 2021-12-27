import { html } from "diff2html";
import { HoverParent, HoverPopover, ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";
import { DIFF_VIEW_CONFIG } from "src/constants";
import ObsidianGit from "src/main";


export default class DiffView extends ItemView {

    plugin: ObsidianGit;
    filePath: string;
    parser: DOMParser;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianGit) {
        super(leaf);
        this.plugin = plugin;
        this.parser = new DOMParser();

        this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
            if (leaf.view instanceof MarkdownView) {
                this.filePath = leaf.view.file.path;
            } else {
                this.filePath = null;
            }
            this.refresh();
        }));
        this.firstOpen = this.firstOpen.bind(this);
        addEventListener('diff-update', this.firstOpen);
        this.registerInterval(window.setInterval(() => this.refresh(), 10000));
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
        removeEventListener('diff-update', this.firstOpen)
        return super.onClose();
    }

    onOpen(): Promise<void> {
        this.refresh();
        return super.onOpen();
    }

    refresh(): void {
        if (this.filePath) {
            this.contentEl.empty();
            const diff = this.parser.parseFromString(
                html(this.plugin.gitManager.getDiffString(this.filePath)),
                'text/html')
                .querySelector('.d2h-file-diff');
            if (diff) {
                this.contentEl.append(diff);
            } else {
                const div = this.contentEl.createDiv({ cls: 'diff-err' });
                div.createSpan({ text: '⚠️', cls: 'diff-err-sign' });
                div.createEl('br');
                div.createSpan({ text: 'No changes to this file.' });
            }
        }
    }

}
