import {Plugin, Notice} from "obsidian";
import simpleGit, {CheckRepoActions, SimpleGit} from "simple-git";

export default class ObsidianGit extends Plugin {
    private git: SimpleGit;

    onInit() {
        const adapter: any = this.app.vault.adapter;
        const git = simpleGit(adapter.basePath);
        let isValidRepo = git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
        if (!isValidRepo) {
            new Notice("Valid git repository not found.");
            return
        }

        this.git = git;
        console.log("obsidian-git: git repository is initialized!");

        this.addCommand({
            id: 'pull',
            name: 'Pull from remote repository',
            callback: async () => {
                const pullResult = await this.git.pull("origin");

                let filesAffected = pullResult.files.length;
                let message: string;
                if (!filesAffected) {
                     message = "Everything is up-to-date."
                } else {
                    message = `Pulled new changes. ${filesAffected} files affected.`
                }
                new Notice(message);
            }
        });
    }
}
