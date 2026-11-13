import type ObsidianGit from "src/main";

const UPDATE_INTERVAL_MILLISECONDS = 1000;

export function formatAutoCommitCountdown(
    remainingMilliseconds: number
): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMilliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
}

export class AutoCommitCountdownBar {
    private intervalId?: number;
    private lastText?: string;

    constructor(
        private readonly statusBarEl: HTMLElement,
        private readonly plugin: ObsidianGit
    ) {
        this.statusBarEl.addClass("obsidian-git-auto-commit-countdown");
        this.statusBarEl.setAttribute("data-tooltip-position", "top");
        this.statusBarEl.ariaLabel = "Time until the next automatic commit";
        this.display();
        this.intervalId = window.setInterval(
            () => this.display(),
            UPDATE_INTERVAL_MILLISECONDS
        );
    }

    private display(): void {
        const remaining =
            this.plugin.automaticsManager.getAutoCommitCountdownMilliseconds();
        const text =
            remaining === undefined
                ? ""
                : `Auto-commit: ${formatAutoCommitCountdown(remaining)}`;
        if (text === this.lastText) return;
        this.lastText = text;
        if (text) {
            this.statusBarEl.setText(text);
        } else {
            this.statusBarEl.empty();
        }
    }

    remove(): void {
        if (this.intervalId !== undefined) {
            window.clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.statusBarEl.remove();
    }
}
