import {Plugin, Notice, PluginSettingTab, Setting} from "obsidian";
import simpleGit, {CheckRepoActions, SimpleGit} from "simple-git";

export default class ObsidianGit extends Plugin {
    private git: SimpleGit;
    settings: ObsidianGitSettings;

    async onInit() {
        const adapter: any = this.app.vault.adapter;
        const git = simpleGit(adapter.basePath);
        let isValidRepo = git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
        if (!isValidRepo) {
            new Notice("Valid git repository not found.");
            return
        }

        this.git = git;
        this.settings = await this.loadData() || new ObsidianGitSettings()

        this.addSettingTab(new ObsidianGitSettingsTab(this.app, this));

        this.addCommand({
            id: 'pull',
            name: 'Pull from remote repository',
            callback: async () => {
                new Notice("Pulling changes from remote repository..");
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

        this.addCommand({
            id: 'push',
            name: 'Commit *all* changes and push to remote repository',
            callback: async () => {
                new Notice("Pushing changes to remote repository..");
                await this.git
                    .add('./*')
                    .commit(this.settings.commitMessage)
                    .push("origin","master", null, (err: Error) => {
                        let message: string;

                        if (!err) {
                            message = "Pushed changes to remote repository.";
                        } else {
                            message = err.message;
                        }

                        new Notice(message);
                    }
                );
            }
        })
    }
}


class ObsidianGitSettings {
    commitMessage: string = 'vault backup';
}


class ObsidianGitSettingsTab extends PluginSettingTab {

    display(): void {
        let {containerEl} = this;
        const plugin: any = (this as any).plugin

        containerEl.empty();
        containerEl.createEl('h2', {text: "Git Backup settings"});

        new Setting(containerEl)
            .setName('Commit message')
            .setDesc('Specify a custom commit message')
            .addText(text => text.setPlaceholder('vault backup')
                .setValue(plugin.settings.commitMessage ? plugin.settings.commitMessage : '')
                .onChange((value) => {
                    plugin.settings.commitMessage = value;
                    plugin.saveData(plugin.settings);
                }
            )
        );
    }
}
