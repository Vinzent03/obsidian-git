import { Modal } from "obsidian";
import type ObsidianGit from "src/main";

export class MergeConflictModal extends Modal {
    constructor(private readonly plugin: ObsidianGit) {
        super(plugin.app);
    }

    onOpen(): void {
        const { contentEl, titleEl } = this;
        const conflicts = this.plugin.cachedStatus?.conflicted ?? [];

        titleEl.setText("Merge in progress");
        contentEl.addClass("obsidian-git-merge-help");
        contentEl.createEl("p", {
            text: "Git is combining the version in your vault with changes from another version. The merge must be committed before Obsidian Git can push or resume automatic commits.",
        });

        if (conflicts.length > 0) {
            contentEl.createEl("h3", { text: "Resolve the conflicts" });
            contentEl.createEl("p", {
                text: "Git could not combine some parts automatically. Open each conflicted file and review every highlighted conflict block.",
            });

            const steps = contentEl.createEl("ol");
            steps.createEl("li", {
                text: "Choose “Keep ours” for your local text, “Keep theirs” for the incoming text, “Keep both”, or edit the block manually.",
            });
            steps.createEl("li", {
                text: "When the file's conflict count reaches zero, select the plus icon next to it to mark it as resolved.",
            });
            steps.createEl("li", {
                text: "Repeat this for every file in the Conflicts section.",
            });
        } else {
            const resolved = contentEl.createDiv({
                cls: "obsidian-git-merge-help-resolved",
            });
            resolved.createEl("strong", {
                text: "All conflicts have been marked as resolved.",
            });
            resolved.createEl("div", {
                text: "The merge is still active until you commit the staged changes.",
            });
        }

        contentEl.createEl("h3", { text: "Finish the merge" });
        contentEl.createEl("p", {
            text: "After the Conflicts section is empty, enter a commit message and commit the staged changes. This finishes the merge. You can then push normally.",
        });

        const buttons = contentEl.createDiv({ cls: "modal-button-container" });
        const close = buttons.createEl("button", {
            cls: "mod-cta",
            text: "Got it",
        });
        close.addEventListener("click", () => this.close());
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
