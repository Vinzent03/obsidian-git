import { FuzzySuggestModal } from "obsidian";
import type ObsidianGit from "src/main";
import type { FileStatusResult } from "src/types";
import { t } from "../../locale";

export class ChangedFilesModal extends FuzzySuggestModal<FileStatusResult> {
    plugin: ObsidianGit;
    changedFiles: FileStatusResult[];

    constructor(plugin: ObsidianGit, changedFiles: FileStatusResult[]) {
        super(plugin.app);
        this.plugin = plugin;
        this.changedFiles = changedFiles;
        this.setPlaceholder(
            t("modal.changed_files_placeholder")
        );
    }

    getItems(): FileStatusResult[] {
        return this.changedFiles;
    }

    getItemText(item: FileStatusResult): string {
        if (item.index == "U" && item.workingDir == "U") {
            return `${t("modal.untracked")} | ${item.vaultPath}`;
        }

        let workingDir = "";
        let index = "";

        if (item.workingDir != " ")
            workingDir = `${t("modal.working_dir", { status: item.workingDir })} `;
        if (item.index != " ") index = `${t("modal.index", { status: item.index })}`;

        return `${workingDir}${index} | ${item.vaultPath}`;
    }

    onChooseItem(item: FileStatusResult, _: MouseEvent | KeyboardEvent): void {
        if (
            this.plugin.app.metadataCache.getFirstLinkpathDest(
                item.vaultPath,
                ""
            ) == null
        ) {
            this.app.openWithDefaultApp(item.vaultPath);
        } else {
            void this.plugin.app.workspace.openLinkText(item.vaultPath, "/");
        }
    }
}
