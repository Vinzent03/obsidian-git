import { Modal } from 'obsidian';
import ObsidianGit from 'src/main';

export class InitModal extends Modal {
    constructor(private plugin: ObsidianGit) {
        super(plugin.app);
    }

    onOpen() {
        let { contentEl, titleEl } = this;
        titleEl.setText("Valid git repository not found");
        const question = contentEl.createDiv();
        question.innerText = "Do you want to initialize a new git repository?";
        question.setAttr("style", "display: flex; justify-content: center; align-items: center;padding: 20px;");

        const center = contentEl.createDiv();
        center.setAttr("style", "display: flex; justify-content: center; align-items: center;");
        center
            .createEl("button", { text: "Cancel" })
            .addEventListener("click", () => this.close());

        center
            .createEl("button", {
                cls: "mod-cta",
                text: "Confirm"
            })
            .addEventListener("click", async () => {
                await this.plugin.gitManager.init();
                await this.plugin.init();
                this.close();
            });

    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}