import { App, Modal } from 'obsidian';

export class IgnoreModal extends Modal {
    resolve: ((value: string | PromiseLike<string>) => void) | null = null;
    constructor(app: App, private content: string) {
        super(app);
    }
    open(): Promise<string> {
        super.open();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText("Edit .gitignore");
        const div = contentEl.createDiv();

        const text = div
            .createEl("textarea", {
                text: this.content,
                cls: ["obsidian-git-textarea"],
                attr: { rows: 10, cols: 30, wrap: "off" },
            });

        div.createEl("button",
            {
                cls: ["mod-cta", "obsidian-git-center-button"],
                text: "Save",
            })
            .addEventListener("click", async () => {
                this.resolve(text.value);
                this.close();
            });

    }
    onClose() {
        const { contentEl } = this;
        this.resolve(undefined);
        contentEl.empty();
    }
}
