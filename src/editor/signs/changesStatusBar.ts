import type ObsidianGit from "src/main";
import type { Hunk } from "./hunks";
import { MarkdownView, TFile } from "obsidian";

export class ChangesStatusBar {
    /**
     * Store the current view instead of always obtaining it from the workspace
     * to support focusing sidebar views like the source control view and still
     * showing the correct status bar for the active editor.
     */
    view?: MarkdownView;
    constructor(
        private statusBarEl: HTMLElement,
        private readonly plugin: ObsidianGit
    ) {
        statusBarEl.addClass("git-changes-status-bar");
        if (plugin.settings.hunks.statusBar === "colored") {
            statusBarEl.addClass("git-changes-status-bar-colored");
        }

        statusBarEl.setAttr("aria-label", "Git diff of the current editor");
        this.statusBarEl.setAttribute("data-tooltip-position", "top");
        this.view =
            plugin.app.workspace.getActiveViewOfType(MarkdownView) ?? undefined;
        plugin.app.workspace.on("active-leaf-change", (leaf) => {
            if (
                !leaf ||
                (leaf.getRoot() == plugin.app.workspace.rootSplit &&
                    !(leaf.view instanceof MarkdownView))
            ) {
                this.statusBarEl.empty();
            } else {
                if (leaf.view instanceof MarkdownView) {
                    this.view = leaf.view;
                }
            }
        });
    }

    display(hunks: Hunk[], file: TFile | null): void {
        if (!this.view || this.view.file?.path !== file?.path) {
            return;
        }

        let added: number = 0,
            changed: number = 0,
            deleted: number = 0;
        for (const hunk of hunks) {
            added += Math.max(0, hunk.added.count - hunk.removed.count);
            changed += Math.min(hunk.added.count, hunk.removed.count);
            deleted += Math.max(0, hunk.removed.count - hunk.added.count);
        }
        this.statusBarEl.empty();
        if (added > 0) {
            this.statusBarEl.createSpan({
                text: `+${added} `,
                cls: "git-add",
            });
        }
        if (changed > 0) {
            this.statusBarEl.createSpan({
                text: `~${changed} `,
                cls: "git-change",
            });
        }
        if (deleted > 0) {
            this.statusBarEl.createSpan({
                text: `-${deleted}`,
                cls: "git-delete",
            });
        }
    }

    remove() {
        this.statusBarEl.remove();
    }
}
