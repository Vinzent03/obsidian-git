import { TFile } from "obsidian";
import { CONFLICT_OUTPUT_FILE } from "./constants";
import type ObsidianGit from "./main";
import { splitRemoteBranch } from "./utils";

export default class Tools {
    constructor(private readonly plugin: ObsidianGit) {}

    async hasTooBigFiles(files: { vault_path: string }[]): Promise<boolean> {
        const branchInfo = await this.plugin.gitManager.branchInfo();
        const remote = branchInfo.tracking
            ? splitRemoteBranch(branchInfo.tracking)[0]
            : null;

        if (remote) {
            const remoteUrl = await this.plugin.gitManager.getRemoteUrl(remote);

            //Check for files >100mb on GitHub remote
            if (remoteUrl?.includes("github.com")) {
                const tooBigFiles = files.filter((f) => {
                    const file = this.plugin.app.vault.getAbstractFileByPath(
                        f.vault_path
                    );
                    if (file instanceof TFile) {
                        return file.stat.size >= 100000000;
                    }
                    return false;
                });
                if (tooBigFiles.length > 0) {
                    this.plugin.displayError(
                        `Did not commit, because following files are too big: ${tooBigFiles.map(
                            (e) => e.vault_path
                        )}. Please remove them.`
                    );

                    return true;
                }
            }
        }
        return false;
    }
    async writeAndOpenFile(text?: string) {
        if (text !== undefined) {
            await this.plugin.app.vault.adapter.write(
                CONFLICT_OUTPUT_FILE,
                text
            );
        }
        let fileIsAlreadyOpened = false;
        this.plugin.app.workspace.iterateAllLeaves((leaf) => {
            if (
                leaf.getDisplayText() != "" &&
                CONFLICT_OUTPUT_FILE.startsWith(leaf.getDisplayText())
            ) {
                fileIsAlreadyOpened = true;
            }
        });
        if (!fileIsAlreadyOpened) {
            this.plugin.app.workspace.openLinkText(
                CONFLICT_OUTPUT_FILE,
                "/",
                true
            );
        }
    }
}
