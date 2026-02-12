import { moment, MarkdownView } from "obsidian";
import type ObsidianGit from "src/main";
import type { BlameCommit } from "src/types";
import { DATE_TIME_FORMAT_MINUTES } from "src/constants";
import type { LineAuthorDisplay } from "./model";
import { lineAuthorState } from "./model";
import { impossibleBranch } from "src/utils";

/**
 * Status bar component that displays line author information
 * for the current cursor line.
 */
export class LineAuthorStatusBar {
    private currentLine: number | null = null;
    private useRelativeTime: boolean = true; // Default to relative time

    constructor(
        private statusBarEl: HTMLElement,
        private readonly plugin: ObsidianGit
    ) {
        statusBarEl.addClass("git-line-author-status-bar");
        statusBarEl.addClass("mod-clickable");
        statusBarEl.setAttr(
            "aria-label",
            "Git blame info for current line (click to toggle time format)"
        );
        statusBarEl.setAttribute("data-tooltip-position", "top");

        // Click to toggle between relative and absolute time
        statusBarEl.addEventListener("click", () => {
            this.useRelativeTime = !this.useRelativeTime;
            this.currentLine = null; // Force refresh
            this.updateDisplay();
        });

        // Clear when switching to non-markdown views
        plugin.registerEvent(
            plugin.app.workspace.on("active-leaf-change", (leaf) => {
                if (
                    !leaf ||
                    (leaf.getRoot() === plugin.app.workspace.rootSplit &&
                        !(leaf.view instanceof MarkdownView))
                ) {
                    this.clear();
                } else {
                    this.updateDisplay();
                }
            })
        );

        // Update on cursor position changes via interval
        // CodeMirror doesn't have a direct cursor change event we can easily hook into
        // so we poll the cursor position periodically
        plugin.registerInterval(
            window.setInterval(() => this.updateDisplay(), 500)
        );
    }

    /**
     * Updates the status bar display with blame info for the current cursor line.
     */
    public updateDisplay(): void {
        const mdView =
            this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!mdView || !mdView.file) {
            this.clear();
            return;
        }

        const editor = mdView.editor;
        if (!editor) {
            this.clear();
            return;
        }

        const cursor = editor.getCursor();
        const lineNumber = cursor.line + 1; // Convert to 1-based line number

        // Only update if line changed
        if (lineNumber === this.currentLine) {
            return;
        }
        this.currentLine = lineNumber;

        // Get the CodeMirror EditorView to access the line author state
        // @ts-expect-error - accessing internal cm property
        const cmEditor = mdView.editor?.cm as
            | import("@codemirror/view").EditorView
            | undefined;
        if (!cmEditor) {
            this.clear();
            return;
        }

        const laState = cmEditor.state.field(lineAuthorState, false);
        if (!laState || laState.la === "untracked") {
            this.displayUntracked();
            return;
        }

        const blame = laState.la;
        const hash = blame.hashPerLine[lineNumber];
        if (!hash) {
            this.clear();
            return;
        }

        const commit = blame.commits.get(hash);
        if (!commit) {
            this.clear();
            return;
        }

        this.displayCommit(commit);
    }

    private displayCommit(commit: BlameCommit): void {
        const settings = this.plugin.settings.lineAuthor;

        if (commit.isZeroCommit) {
            this.displayUncommitted();
            return;
        }

        const parts: string[] = [];
        const displayOption = settings.statusBarDisplayOptions ?? "author+date";

        // Author name - show if display option includes author
        const showAuthor =
            displayOption === "author" || displayOption === "author+date";
        if (showAuthor && settings.authorDisplay !== "hide") {
            const authorName = this.formatAuthorName(
                commit,
                settings.authorDisplay
            );
            if (authorName) {
                parts.push(authorName);
            }
        }

        // Date/time - show if display option includes date
        const showDate =
            displayOption === "date" || displayOption === "author+date";
        if (showDate) {
            const dateStr = this.formatDateForStatusBar(commit);
            if (dateStr) {
                parts.push(dateStr);
            }
        }

        // Commit hash
        if (settings.showCommitHash) {
            parts.push(commit.hash.substring(0, 6));
        }

        this.statusBarEl.empty();
        if (parts.length > 0) {
            this.statusBarEl.createSpan({
                text: parts.join(" · "),
                cls: "git-line-author-info",
            });
        }

        // Set tooltip with full info
        const tooltipParts: string[] = [];
        if (commit.author?.name) {
            tooltipParts.push(`Author: ${commit.author.name}`);
        }
        if (commit.author?.epochSeconds) {
            const date = moment.unix(commit.author.epochSeconds);
            tooltipParts.push(`Date: ${date.format(DATE_TIME_FORMAT_MINUTES)}`);
        }
        if (commit.summary) {
            tooltipParts.push(`Message: ${commit.summary}`);
        }
        tooltipParts.push(`Commit: ${commit.hash.substring(0, 6)}`);

        this.statusBarEl.setAttr("aria-label", tooltipParts.join("\n"));
    }

    private formatAuthorName(
        commit: BlameCommit,
        authorDisplay: Exclude<LineAuthorDisplay, "hide">
    ): string {
        const name = commit?.author?.name ?? "";
        if (!name) return "";

        const words = name.split(" ").filter((word) => word.length >= 1);

        switch (authorDisplay) {
            case "initials":
                return words.map((word) => word[0].toUpperCase()).join("");
            case "first name":
                return words.first() ?? "";
            case "last name":
                return words.last() ?? "";
            case "full":
                return name;
            default:
                return impossibleBranch(authorDisplay);
        }
    }

    /**
     * Formats the date for status bar display.
     * Toggles between relative time ("5 days ago") and absolute time ("2024-01-15").
     */
    private formatDateForStatusBar(commit: BlameCommit): string {
        if (commit?.author?.epochSeconds === undefined) return "";

        const authoringDate = moment.unix(commit.author.epochSeconds);

        if (this.useRelativeTime) {
            // Relative time: "5 days ago"
            const diff = authoringDate.diff(moment());
            return moment.duration(diff).humanize(true);
        } else {
            // Absolute time: "YYYY-MM-DD"
            return authoringDate.format("YYYY-MM-DD");
        }
    }

    private displayUntracked(): void {
        this.statusBarEl.empty();
        this.statusBarEl.createSpan({
            text: "Untracked",
            cls: "git-line-author-untracked",
        });
        this.statusBarEl.setAttr("aria-label", "File is not tracked by git");
    }

    private displayUncommitted(): void {
        this.statusBarEl.empty();
        this.statusBarEl.createSpan({
            text: "Uncommitted",
            cls: "git-line-author-uncommitted",
        });
        this.statusBarEl.setAttr("aria-label", "Line has uncommitted changes");
    }

    private clear(): void {
        this.statusBarEl.empty();
        this.currentLine = null;
        this.statusBarEl.setAttr("aria-label", "");
    }

    public remove(): void {
        this.statusBarEl.remove();
    }
}
