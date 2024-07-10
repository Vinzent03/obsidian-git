import { setIcon } from "obsidian";
import type ObsidianGit from "./main";
import { PluginState } from "./types";

interface StatusBarMessage {
    message: string;
    timeout: number;
}

export class StatusBar {
    private messages: StatusBarMessage[] = [];
    private currentMessage: StatusBarMessage | null;
    private lastCommitTimestamp?: Date;
    private unPushedCommits?: number;
    public lastMessageTimestamp: number | null;
    private base = "obsidian-git-statusbar-";
    private iconEl: HTMLElement;
    private textEl: HTMLElement;

    constructor(
        private statusBarEl: HTMLElement,
        private readonly plugin: ObsidianGit
    ) {
        this.statusBarEl.setAttribute("data-tooltip-position", "top");

        addEventListener("git-refresh", this.refreshCommitTimestamp.bind(this));
    }

    public displayMessage(message: string, timeout: number) {
        this.messages.push({
            message: `Git: ${message.slice(0, 100)}`,
            timeout: timeout,
        });
        this.display();
    }

    public display() {
        if (this.messages.length > 0 && !this.currentMessage) {
            this.currentMessage = this.messages.shift() as StatusBarMessage;
            this.statusBarEl.addClass(this.base + "message");
            this.statusBarEl.ariaLabel = "";
            this.statusBarEl.setText(this.currentMessage.message);
            this.lastMessageTimestamp = Date.now();
        } else if (this.currentMessage) {
            const messageAge =
                Date.now() - (this.lastMessageTimestamp as number);
            if (messageAge >= this.currentMessage.timeout) {
                this.currentMessage = null;
                this.lastMessageTimestamp = null;
            }
        } else {
            this.displayState();
        }
    }

    private displayState() {
        //Messages have to be removed before the state is set
        if (
            this.statusBarEl.getText().length > 3 ||
            !this.statusBarEl.hasChildNodes()
        ) {
            this.statusBarEl.empty();

            this.iconEl = this.statusBarEl.createDiv();
            this.textEl = this.statusBarEl.createDiv();
            this.textEl.style.float = "right";
            this.textEl.style.marginLeft = "5px";
            this.iconEl.style.float = "left";
        }

        switch (this.plugin.state) {
            case PluginState.idle:
                this.displayFromNow();
                break;
            case PluginState.status:
                this.statusBarEl.ariaLabel = "Checking repository status...";
                setIcon(this.iconEl, "refresh-cw");
                this.statusBarEl.addClass(this.base + "status");
                break;
            case PluginState.add:
                this.statusBarEl.ariaLabel = "Adding files...";
                setIcon(this.iconEl, "refresh-w");
                this.statusBarEl.addClass(this.base + "add");
                break;
            case PluginState.commit:
                this.statusBarEl.ariaLabel = "Committing changes...";
                setIcon(this.iconEl, "git-commit");
                this.statusBarEl.addClass(this.base + "commit");
                break;
            case PluginState.push:
                this.statusBarEl.ariaLabel = "Pushing changes...";
                setIcon(this.iconEl, "upload");
                this.statusBarEl.addClass(this.base + "push");
                break;
            case PluginState.pull:
                this.statusBarEl.ariaLabel = "Pulling changes...";
                setIcon(this.iconEl, "download");
                this.statusBarEl.addClass(this.base + "pull");
                break;
            case PluginState.conflicted:
                this.statusBarEl.ariaLabel = "You have conflict files...";
                setIcon(this.iconEl, "alert-circle");
                this.statusBarEl.addClass(this.base + "conflict");
                break;
            default:
                this.statusBarEl.ariaLabel = "Failed on initialization!";
                setIcon(this.iconEl, "alert-triangle");
                this.statusBarEl.addClass(this.base + "failed-init");
                break;
        }
    }

    private displayFromNow(): void {
        const timestamp = this.lastCommitTimestamp;
        if (timestamp) {
            const moment = (window as any).moment;
            const fromNow = moment(timestamp).fromNow();
            this.statusBarEl.ariaLabel = `${
                this.plugin.offlineMode ? "Offline: " : ""
            }Last Commit: ${fromNow}`;

            if (this.unPushedCommits ?? 0 > 0) {
                this.statusBarEl.ariaLabel += `\n(${this.unPushedCommits} unpushed commits)`;
            }
        } else {
            this.statusBarEl.ariaLabel = this.plugin.offlineMode
                ? "Git is offline"
                : "Git is ready";
        }

        if (this.plugin.offlineMode) {
            setIcon(this.iconEl, "globe");
        } else {
            setIcon(this.iconEl, "check");
        }
        if (
            this.plugin.settings.changedFilesInStatusBar &&
            this.plugin.cachedStatus
        ) {
            this.textEl.setText(
                this.plugin.cachedStatus.changed.length.toString()
            );
        }
        this.statusBarEl.addClass(this.base + "idle");
    }

    private async refreshCommitTimestamp() {
        this.lastCommitTimestamp =
            await this.plugin.gitManager.getLastCommitTime();
        this.unPushedCommits =
            await this.plugin.gitManager.getUnpushedCommits();
    }
}
