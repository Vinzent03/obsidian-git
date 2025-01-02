import type { HoverParent, HoverPopover, WorkspaceLeaf } from "obsidian";
import { ItemView } from "obsidian";
import { SOURCE_CONTROL_VIEW_CONFIG } from "src/constants";
import type ObsidianGit from "src/main";
import SourceControlViewComponent from "./sourceControl.svelte";
import { mount, unmount } from "svelte";

export default class GitView extends ItemView implements HoverParent {
    plugin: ObsidianGit;
    private _view: Record<string, unknown> | undefined;
    hoverPopover: HoverPopover | null;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianGit) {
        super(leaf);
        this.plugin = plugin;
        this.hoverPopover = null;
    }

    getViewType(): string {
        return SOURCE_CONTROL_VIEW_CONFIG.type;
    }

    getDisplayText(): string {
        return SOURCE_CONTROL_VIEW_CONFIG.name;
    }

    getIcon(): string {
        return SOURCE_CONTROL_VIEW_CONFIG.icon;
    }

    onClose(): Promise<void> {
        if (this._view) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            unmount(this._view);
        }
        return super.onClose();
    }

    reload(): void {
        if (this._view) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            unmount(this._view);
        }
        this._view = mount(SourceControlViewComponent, {
            target: this.contentEl,
            props: {
                plugin: this.plugin,
                view: this,
            },
        });
    }

    onOpen(): Promise<void> {
        this.reload();
        return super.onOpen();
    }
}
