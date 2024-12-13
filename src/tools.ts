import { TFile } from "obsidian";
import { CONFLICT_OUTPUT_FILE } from "./constants";
import type ObsidianGit from "./main";
import { splitRemoteBranch } from "./utils";
import { SimpleGit } from "./gitManager/simpleGit";

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
                const tooBigFiles = [];

                for (const f of files) {
                    const file = this.plugin.app.vault.getAbstractFileByPath(
                        f.vault_path
                    );
                    if (file instanceof TFile) {
                        const isFileTrackedByLfs =
                            this.plugin.gitManager instanceof SimpleGit
                                ? await this.plugin.gitManager.isFileTrackedByLFS(
                                      f.vault_path
                                  )
                                : false;
                        if (
                            file.stat.size >= 100000000 &&
                            !isFileTrackedByLfs
                        ) {
                            tooBigFiles.push(f);
                        }
                    }
                }

                if (tooBigFiles.length > 0) {
                    this.plugin.displayError(
                        `Did not commit, because following files are too big: ${tooBigFiles
                            .map((e) => e.vault_path)
                            .join("\n")}. Please remove them.`
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
            await this.plugin.app.workspace.openLinkText(
                CONFLICT_OUTPUT_FILE,
                "/",
                true
            );
        }
    }
}
