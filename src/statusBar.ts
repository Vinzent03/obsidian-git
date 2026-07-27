import { setIcon, moment } from "obsidian";
import type ObsidianGit from "./main";
import { GitOperation, type GitProgress } from "./types";

interface StatusBarMessage {
    message: string;
    timeout: number;
}

export class StatusBar {
    private messages: StatusBarMessage[] = [];
    private currentMessage: StatusBarMessage | null = null;
    private lastCommitTimestamp?: Date;
    private unPushedCommits?: number;
    private progress?: GitProgress;
    public lastMessageTimestamp: number | null = null;
    private base = "obsidian-git-statusbar-";
    private iconEl!: HTMLElement;
    private conflictEl!: HTMLElement;
    private pausedEl!: HTMLElement;
    private textEl!: HTMLElement;

    constructor(
        private statusBarEl: HTMLElement,
        private readonly plugin: ObsidianGit
    ) {
        this.statusBarEl.setAttribute("data-tooltip-position", "top");

        plugin.registerEvent(
            plugin.app.workspace.on("obsidian-git:refreshed", () => {
                this.refreshCommitTimestamp().catch(console.error);
            })
        );
    }

    public displayMessage(message: string, timeout: number) {
        this.messages.push({
            message: `Git: ${message.slice(0, 100)}`,
            timeout: timeout,
        });
        this.display();
    }

    public displayProgress(progress: GitProgress) {
        this.progress = progress;
        this.display();
    }

    public clearProgress(display = true) {
        this.progress = undefined;
        if (display) this.display();
    }

    public display() {
        if (this.progress) {
            this.displayState();
        } else if (this.messages.length > 0 && !this.currentMessage) {
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

            this.conflictEl = this.statusBarEl.createDiv();
            this.conflictEl.setAttribute("data-tooltip-position", "top");
            this.conflictEl.style.float = "left";

            this.pausedEl = this.statusBarEl.createDiv();
            this.pausedEl.setAttribute("data-tooltip-position", "top");
            this.pausedEl.style.float = "left";

            this.iconEl = this.statusBarEl.createDiv();
            this.iconEl.style.float = "left";

            this.textEl = this.statusBarEl.createDiv();
            this.textEl.style.float = "right";
            this.textEl.style.marginLeft = "5px";
        }

        if (this.plugin.localStorage.getConflict()) {
            setIcon(this.conflictEl, "alert-circle");
            this.conflictEl.ariaLabel =
                "You have merge conflicts. Resolve them and commit afterwards.";
            this.conflictEl.style.marginRight = "5px";
            this.conflictEl.addClass(this.base + "conflict");
        } else {
            this.conflictEl.empty();
            this.conflictEl.style.marginRight = "";
        }

        if (this.plugin.localStorage.getPausedAutomatics()) {
            setIcon(this.pausedEl, "pause-circle");
            this.pausedEl.ariaLabel =
                "Automatic routines are currently paused.";
            this.pausedEl.style.marginRight = "5px";
            this.pausedEl.addClass(this.base + "paused");
        } else {
            this.pausedEl.empty();
            this.pausedEl.style.marginRight = "";
        }

        if (this.progress) {
            this.statusBarEl.ariaLabel = this.getProgressTooltip(
                "Git operation in progress..."
            );
            setIcon(this.iconEl, this.getProgressIcon());
            this.displayProgressText();
            this.statusBarEl.addClass(this.base + "progress");
            return;
        }

        switch (this.plugin.state.operation) {
            case GitOperation.idle:
                this.displayFromNow();
                break;
            case GitOperation.commit:
                this.statusBarEl.ariaLabel = "Committing changes...";
                setIcon(this.iconEl, "git-commit");
                this.textEl.empty();
                this.statusBarEl.addClass(this.base + "commit");
                break;
            case GitOperation.push:
                this.statusBarEl.ariaLabel =
                    this.getProgressTooltip("Pushing changes...");
                setIcon(this.iconEl, "upload");
                this.displayProgressText();
                this.statusBarEl.addClass(this.base + "push");
                break;
            case GitOperation.pull:
                this.statusBarEl.ariaLabel =
                    this.getProgressTooltip("Pulling changes...");
                setIcon(this.iconEl, "download");
                this.displayProgressText();
                this.statusBarEl.addClass(this.base + "pull");
                break;
            case GitOperation.fetch:
                this.statusBarEl.ariaLabel = this.getProgressTooltip(
                    "Fetching from remote..."
                );
                setIcon(this.iconEl, "download");
                this.displayProgressText();
                this.statusBarEl.addClass(this.base + "fetch");
                break;
            case GitOperation.checkout:
                this.statusBarEl.ariaLabel = this.getProgressTooltip(
                    "Checking out branch..."
                );
                setIcon(this.iconEl, "git-branch");
                this.displayProgressText();
                this.statusBarEl.addClass(this.base + "checkout");
                break;
            default:
                this.statusBarEl.ariaLabel = "Failed on initialization!";
                setIcon(this.iconEl, "alert-triangle");
                this.textEl.empty();
                this.statusBarEl.addClass(this.base + "failed-init");
                break;
        }
    }

    private displayProgressText(): void {
        if (this.progress) {
            this.textEl.setText(this.getCompactProgressText());
        } else {
            this.textEl.empty();
        }
    }

    private getProgressTooltip(fallback: string): string {
        if (!this.progress) return fallback;

        const stage = this.progress.stage ? `${this.progress.stage}: ` : "";
        if (this.progress.progress === undefined) {
            return this.progress.stage
                ? `${this.progress.action}: ${this.progress.stage}...`
                : `${this.progress.action}...`;
        }

        const count =
            this.progress.processed !== undefined &&
            this.progress.total !== undefined
                ? ` (${this.progress.processed}/${this.progress.total})`
                : "";
        return `${this.progress.action}: ${stage}${Math.round(this.progress.progress)}%${count}`;
    }

    private getCompactProgressText(): string {
        if (!this.progress) return "";

        if (this.progress.progress === undefined) {
            return `${this.progress.action}...`;
        }

        return `${this.progress.action} ${Math.round(this.progress.progress)}%`;
    }

    private getProgressIcon(): string {
        switch (this.progress?.action) {
            case "Fetching":
            case "Pulling":
                return "download";
            case "Pushing":
                return "upload";
            case "Checking out":
                return "git-branch";
            default:
                return "git-pull-request";
        }
    }

    private displayFromNow(): void {
        const timestamp = this.lastCommitTimestamp;
        const offlineMode = this.plugin.state.offlineMode;
        if (timestamp) {
            const fromNow = moment(timestamp).fromNow();
            this.statusBarEl.ariaLabel = `${
                offlineMode ? "Offline: " : ""
            }Last Commit: ${fromNow}`;

            if ((this.unPushedCommits ?? 0) > 0) {
                this.statusBarEl.ariaLabel += `\n(${this.unPushedCommits} unpushed commits)`;
            }
        } else {
            this.statusBarEl.ariaLabel = offlineMode
                ? "Git is offline"
                : "Git is ready";
        }

        if (offlineMode) {
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
        } else {
            this.textEl.empty();
        }
        this.statusBarEl.addClass(this.base + "idle");
    }

    private async refreshCommitTimestamp() {
        this.lastCommitTimestamp =
            await this.plugin.gitManager.getLastCommitTime();
        this.unPushedCommits =
            await this.plugin.gitManager.getUnpushedCommits();
    }

    public remove() {
        this.statusBarEl.remove();
    }
}
