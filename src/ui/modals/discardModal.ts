import { App, Modal } from "obsidian";
import { t } from "src/lang/helpers";
import { plural } from "src/utils";

export type DiscardResult = false | "delete" | "discard";

export class DiscardModal extends Modal {
    path: string;
    deleteCount: number;
    discardCount: number;
    constructor({
        app,
        path,
        filesToDeleteCount,
        filesToDiscardCount,
    }: {
        app: App;
        path: string;
        filesToDeleteCount: number;
        filesToDiscardCount: number;
    }) {
        super(app);
        this.path = path;
        this.deleteCount = filesToDeleteCount;
        this.discardCount = filesToDiscardCount;
    }
    resolve: ((value: DiscardResult) => void) | null = null;

    /**
     * @returns the result of the modal, whcih can be:
     *   - `false` if the user canceled the modal
     *   - `"delete"` if the user chose to delete all files. In case there are also tracked files, they will be discarded as well.
     *   - `"discard"` if the user chose to discard all tracked files. Untracked files will not be deleted.
     */
    openAndGetResult(): Promise<DiscardResult> {
        this.open();
        return new Promise<DiscardResult>((resolve) => {
            this.resolve = resolve;
        });
    }

    onOpen() {
        const sum = this.deleteCount + this.discardCount;
        const { contentEl, titleEl } = this;
        let titlePart = "";
        if (this.path != "") {
            if (sum > 1) {
                titlePart = t("files in \"%1\"", this.path);
            } else {
                titlePart = `"${this.path}"`;
            }
        }
        titleEl.setText(
            `${this.discardCount == 0 ? t("Delete") : t("Discard")} ${titlePart}`
        );
        if (this.deleteCount > 0) {
            contentEl
                .createEl("p")
                .setText(
                    t(
                        "Are you sure you want to DELETE the %1? They are deleted according to your Obsidian trash settting.",
                        plural(this.deleteCount, "untracked file")
                    )
                );
        }
        if (this.discardCount > 0) {
            contentEl
                .createEl("p")
                .setText(
                    t(
                        "Are you sure you want to discard ALL changes in %1?",
                        plural(this.discardCount, "tracked file")
                    )
                );
        }
        const div = contentEl.createDiv({ cls: "modal-button-container" });

        if (this.deleteCount > 0) {
            const discardAndDelete = div.createEl("button", {
                cls: "mod-warning",
                text: t(
                    `${this.discardCount > 0 ? "Discard" : "Delete"} all %1`,
                    plural(sum, "file")
                ),
            });
            discardAndDelete.addEventListener("click", () => {
                if (this.resolve) this.resolve("delete");
                this.close();
            });
            discardAndDelete.addEventListener("keypress", () => {
                if (this.resolve) this.resolve("delete");
                this.close();
            });
        }

        if (this.discardCount > 0) {
            const discard = div.createEl("button", {
                cls: "mod-warning",
                text: t("Discard all %1", plural(this.discardCount, "tracked file")),
            });
            discard.addEventListener("click", () => {
                if (this.resolve) this.resolve("discard");
                this.close();
            });
            discard.addEventListener("keypress", () => {
                if (this.resolve) this.resolve("discard");
                this.close();
            });
        }

        const close = div.createEl("button", {
            text: t("Cancel"),
        });
        close.addEventListener("click", () => {
            if (this.resolve) this.resolve(false);
            return this.close();
        });
        close.addEventListener("keypress", () => {
            if (this.resolve) this.resolve(false);
            return this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
