import { FuzzySuggestModal } from "obsidian";
import type ObsidianGit from "src/main";
import type { FileStatusResult } from "src/types";

export class ChangedFilesModal extends FuzzySuggestModal<FileStatusResult> {
    plugin: ObsidianGit;
    changedFiles: FileStatusResult[];

    constructor(plugin: ObsidianGit, changedFiles: FileStatusResult[]) {
        super(plugin.app);
        this.plugin = plugin;
        this.changedFiles = changedFiles;
        this.setPlaceholder(
            "Not supported files will be opened by default app!"
        );
    }

    getItems(): FileStatusResult[] {
        return this.changedFiles;
    }

    getItemText(item: FileStatusResult): string {
        if (item.index == "U" && item.working_dir == "U") {
            return `Untracked | ${item.vault_path}`;
        }

        let working_dir = "";
        let index = "";

        if (item.working_dir != " ")
            working_dir = `Working Dir: ${item.working_dir} `;
        if (item.index != " ") index = `Index: ${item.index}`;

        return `${working_dir}${index} | ${item.vault_path}`;
    }

    onChooseItem(item: FileStatusResult, _: MouseEvent | KeyboardEvent): void {
        if (
            this.plugin.app.metadataCache.getFirstLinkpathDest(
                item.vault_path,
                ""
            ) == null
        ) {
            (this.app as any).openWithDefaultApp(item.vault_path);
        } else {
            this.plugin.app.workspace.openLinkText(item.vault_path, "/");
        }
    }
}
