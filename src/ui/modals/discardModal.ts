import { App, Modal } from 'obsidian';

export class DiscardModal extends Modal {
    constructor(app: App, private readonly deletion: boolean, private readonly filename: string) {
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
        contentEl.createEl("h4").setText(`Do you really want to ${this.deletion ? "delete" : "discard the changes of"} "${this.filename}"`);
        const div = contentEl.createDiv();
        div.addClass("obsidian-git-center");

        // div.setAttr("margin-left", "auto");
        // div.setAttr("margin-right", "auto");
        div
            .createEl("button", { text: "Cancel" })
            .addEventListener("click", () => {
                if (this.resolve) this.resolve(false);
                return this.close();
            });

        div
            .createEl("button",
                {
                    cls: "mod-cta",
                    text: "Confirm"
                })
            .addEventListener("click", async () => {
                if (this.resolve) this.resolve(true);
                this.close();
            });

    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
