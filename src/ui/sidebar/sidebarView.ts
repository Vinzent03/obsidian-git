import { HoverParent, HoverPopover, ItemView, WorkspaceLeaf } from "obsidian";
import ObsidianGit from "src/main";
import GitViewComponent from './gitView.svelte';


export default class GitView extends ItemView implements HoverParent{

    plugin: ObsidianGit;
    private _view: GitViewComponent;
    hoverPopover: HoverPopover | null;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianGit) {
        super(leaf);
        this.plugin = plugin;
        this.hoverPopover = null;
    }

    getViewType(): string {
        return 'git-view';
    }

    getDisplayText(): string {
        return 'Source Control';
    }

    getIcon(): string {
        return 'feather-git-pull-request';
    }

    onClose(): Promise<void> {
        this._view.$destroy();
        return super.onClose();
    }

    onOpen(): Promise<void>{
        this._view = new GitViewComponent({
            target: this.contentEl,
            props: {
                plugin: this.plugin,
                view: this,
            }
        });
        return super.onOpen();
    }

}
