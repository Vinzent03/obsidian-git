import type { HoverParent, HoverPopover, WorkspaceLeaf } from "obsidian";
import { ItemView } from "obsidian";
import { HISTORY_VIEW_CONFIG } from "src/constants";
import type ObsidianGit from "src/main";
import HistoryViewComponent from "./historyView.svelte";
import { mount, unmount } from "svelte";

export default class HistoryView extends ItemView implements HoverParent {
    plugin: ObsidianGit;
    private _view: Record<string, unknown> | undefined;
    hoverPopover: HoverPopover | null;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianGit) {
        super(leaf);
        this.plugin = plugin;
        this.hoverPopover = null;
    }

    getViewType(): string {
        return HISTORY_VIEW_CONFIG.type;
    }

    getDisplayText(): string {
        return HISTORY_VIEW_CONFIG.name;
    }

    getIcon(): string {
        return HISTORY_VIEW_CONFIG.icon;
    }

    async onClose(): Promise<void> {
        if (this._view) {
            await unmount(this._view);
        }
        return super.onClose();
    }

    async reload(): Promise<void> {
        if (this._view) {
            await unmount(this._view);
        }
        this._view = mount(HistoryViewComponent, {
            target: this.contentEl,
            props: {
                plugin: this.plugin,
                view: this,
            },
        });
    }

    async onOpen(): Promise<void> {
        await this.reload();
        return super.onOpen();
    }
}
