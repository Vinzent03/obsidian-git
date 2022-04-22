import { setIcon } from "obsidian";
import ObsidianGit from "./main";
import { PluginState } from "./types";

interface StatusBarMessage {
    message: string;
    timeout: number;
}

export class StatusBar {
    private messages: StatusBarMessage[] = [];
    private currentMessage: StatusBarMessage;
    public lastMessageTimestamp: number;
    private base = "obsidian-git-statusbar-";


    constructor(private statusBarEl: HTMLElement, private readonly plugin: ObsidianGit) {
        this.statusBarEl.setAttribute("aria-label-position", "top");
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
            this.currentMessage = this.messages.shift();
            this.statusBarEl.addClass(this.base + "message");
            this.statusBarEl.ariaLabel = "";
            this.statusBarEl.setText(this.currentMessage.message);
            this.lastMessageTimestamp = Date.now();
        } else if (this.currentMessage) {
            const messageAge = Date.now() - this.lastMessageTimestamp;
            if (messageAge >= this.currentMessage.timeout) {
                this.currentMessage = null;
                this.lastMessageTimestamp = null;
            }
        } else {
            this.displayState();
        }
    }

    private displayState() {
        switch (this.plugin.state) {
            case PluginState.idle:
                this.displayFromNow(this.plugin.lastUpdate);
                break;
            case PluginState.status:
                this.statusBarEl.ariaLabel = "Checking repository status...";
                setIcon(this.statusBarEl, "refresh-cw");
                this.statusBarEl.addClass(this.base + "status");
                break;
            case PluginState.add:
                this.statusBarEl.ariaLabel = "Adding files...";
                setIcon(this.statusBarEl, "refresh-w");
                this.statusBarEl.addClass(this.base + "add");
                break;
            case PluginState.commit:
                this.statusBarEl.ariaLabel = "Committing changes...";
                setIcon(this.statusBarEl, "git-commit");
                this.statusBarEl.addClass(this.base + "commit");
                break;
            case PluginState.push:
                this.statusBarEl.ariaLabel = "Pushing changes...";
                setIcon(this.statusBarEl, "upload");
                this.statusBarEl.addClass(this.base + "push");
                break;
            case PluginState.pull:
                this.statusBarEl.ariaLabel = "Pulling changes...";
                setIcon(this.statusBarEl, "download");
                this.statusBarEl.addClass(this.base + "pull");
                break;
            case PluginState.conflicted:
                this.statusBarEl.ariaLabel = "You have conflict files...";
                setIcon(this.statusBarEl, "alert-circle");
                this.statusBarEl.addClass(this.base + "conflict");
                break;
            default:
                this.statusBarEl.ariaLabel = "Failed on initialization!";
                setIcon(this.statusBarEl, "alert-triangle");
                this.statusBarEl.addClass(this.base + "failed-init");
                break;
        }
    }

    private displayFromNow(timestamp: number): void {
        if (timestamp) {
            const moment = (window as any).moment;
            const fromNow = moment(timestamp).fromNow();
            this.statusBarEl.ariaLabel = `${this.plugin.offlineMode ? "Offline: " : ""}Last Git update: ${fromNow}`;
        } else {
            this.statusBarEl.ariaLabel = this.plugin.offlineMode ? "Git is offline" : "Git is ready";
        }
        if (this.plugin.offlineMode) {
            setIcon(this.statusBarEl, "globe");
        } else {
            setIcon(this.statusBarEl, "check");
        }
        this.statusBarEl.addClass(this.base + "idle");
    }
}