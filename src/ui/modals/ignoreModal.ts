import type { App } from "obsidian";
import { Modal } from "obsidian";

export class IgnoreModal extends Modal {
    resolve:
        | ((value: string | PromiseLike<string> | undefined) => void)
        | null = null;
    constructor(
        app: App,
        private content: string
    ) {
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

        const text = div.createEl("textarea", {
            text: this.content,
            cls: ["obsidian-git-textarea"],
            attr: { rows: 10, cols: 30, wrap: "off" },
        });

        div.createEl("button", {
            cls: ["mod-cta", "obsidian-git-center-button"],
            text: "Save",
        }).addEventListener("click", async () => {
            // `this.resolve` asserts non-null here because the function is assigned when the `this.open()` is called
            // and is not null at the time the save button is clicked.
            this.resolve!(text.value);
            this.close();
        });
    }
    onClose() {
        const { contentEl } = this;
        // `this.resolve` asserts non-null here because the function is assigned when the `this.open()` is called
        // and is not null at the time the modal is closed.
        this.resolve!(undefined);
        contentEl.empty();
    }
}
