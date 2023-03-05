import { Modal, TFile } from "obsidian";
import { GitManager } from "../../gitManager";
// @tsconfig/svelte is required to resolve this error.
// Ignore temporarily.
// @ts-ignore
import FileHistoryComponent from "./fileHistory/fileHistory.svelte";

export class FileHistoryModal extends Modal {
    constructor(private gitManager: GitManager, private file: TFile) {
        super(app);
    }

    onOpen() {
        this.modalEl.style.width = "800px";

        new FileHistoryComponent({
            target: this.contentEl,
            props: {
                gitManager: this.gitManager,
                file: this.file,
            },
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}
