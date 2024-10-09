import type { App } from "obsidian";
import { Modal } from "obsidian";

export class DiscardModal extends Modal {
    constructor(
        app: App,
        private readonly deletion: boolean,
        private readonly filename: string
    ) {
        super(app);
    }
    resolve: ((value: boolean | PromiseLike<boolean>) => void) | null = null;
    myOpen() {
        this.open();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }
    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(`${this.deletion ? "Delete" : "Discard"} this file?`);
        contentEl
            .createEl("p")
            .setText(
                `Do you really want to ${
                    this.deletion ? "delete" : "discard the changes of"
                } "${this.filename}"`
            );
        const div = contentEl.createDiv({ cls: "modal-button-container" });

        const discard = div.createEl("button", {
            cls: "mod-warning",
            text: this.deletion ? "Delete" : "Discard",
        });
        discard.addEventListener("click", () => {
            if (this.resolve) this.resolve(true);
            this.close();
        });
        discard.addEventListener("keypress", () => {
            if (this.resolve) this.resolve(true);
            this.close();
        });

        const close = div.createEl("button", {
            text: "Cancel",
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
