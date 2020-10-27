import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import simpleGit, { CheckRepoActions, SimpleGit } from "simple-git";

export default class ObsidianGit extends Plugin {
  public git: SimpleGit;
  settings: ObsidianGitSettings;

  private intervalID: NodeJS.Timeout;

  async onload() {
    const adapter: any = this.app.vault.adapter;
    const git = simpleGit(adapter.basePath);
    let isValidRepo = git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
    if (!isValidRepo) {
      new Notice("Valid git repository not found.");
      return;
    }

    this.git = git;
    this.settings = (await this.loadData()) || new ObsidianGitSettings();

    if (this.settings.autoSaveInterval > 0) {
      this.enableAutosave();
    }

    this.addSettingTab(new ObsidianGitSettingsTab(this.app, this));

    this.addCommand({
      id: "pull",
      name: "Pull from remote repository",
      callback: async () => {
        new Notice("Pulling changes from remote repository..");
        let filesAffected = await this.pullForUpdates();
        if (filesAffected > 0) {
          new Notice(`Pulled new changes. ${filesAffected} files affected.`);
        } else {
          new Notice("Everything is up-to-date.");
        }
      },
    });

    this.addCommand({
      id: "push",
      name: "Commit *all* changes and push to remote repository",
      callback: async () => {
        if (await this.isRepoClean()) {
          new Notice("No updates detected. Nothing to push.");
        } else {
          new Notice("Pushing changes to remote repository..");
          await this.addCommitAndPush();
        }
      },
    });
  }

  async isRepoClean(): Promise<boolean> {
    let status = await this.git.status();
    return status.isClean();
  }

  async pullForUpdates(): Promise<number> {
    const pullResult = await this.git.pull("origin");
    return pullResult.files.length;
  }

  async addCommitAndPush(message: string = "Pushed!") {
    await this.git
      .add("./*")
      .commit(this.settings.commitMessage)
      .push("origin", "master", null, (err: Error) => {
        new Notice(err ? err.message : message);
      });
  }

  enableAutosave() {
    let minutes = this.settings.autoSaveInterval;
    this.intervalID = setInterval(async () => {
      // console.log("repo clean?", await this.isRepoClean());
      !(await this.isRepoClean()) &&
        (await this.addCommitAndPush("Autosave: pushed changes!"));
    }, minutes * 60000);
  }

  disableAutosave(): boolean {
    if (this.intervalID) {
      clearInterval(this.intervalID);
      return true;
    }

    return false;
  }
}

class ObsidianGitSettings {
  commitMessage: string = "vault backup";
  autoSaveInterval: number = 0;
}

class ObsidianGitSettingsTab extends PluginSettingTab {
  display(): void {
    let { containerEl } = this;
    const plugin: any = (this as any).plugin;

    containerEl.empty();
    containerEl.createEl("h2", { text: "Git Backup settings" });

    new Setting(containerEl)
      .setName("Commit message")
      .setDesc("Specify a custom commit message")
      .addText((text) =>
        text
          .setPlaceholder("vault backup")
          .setValue(
            plugin.settings.commitMessage ? plugin.settings.commitMessage : ""
          )
          .onChange((value) => {
            plugin.settings.commitMessage = value;
            plugin.saveData(plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("Autosave")
      .setDesc(
        "Commit and push changes every X minutes. To disable autosave, specify negative value or zero (default)"
      )
      .addText((text) =>
        text
          .setValue(String(plugin.settings.autoSaveInterval))
          .onChange((value) => {
            if (!isNaN(Number(value))) {
              plugin.settings.autoSaveInterval = Number(value);
              plugin.saveData(plugin.settings);

              if (plugin.settings.autoSaveInterval > 0) {
                plugin.disableAutosave(); // call clearInterval() before setting up a new one
                plugin.enableAutosave();
                new Notice(
                  `Autosave enabled! Every ${plugin.settings.autoSaveInterval} minutes.`
                );
              } else if (
                plugin.settings.autoSaveInterval <= 0 &&
                plugin.intervalID
              ) {
                plugin.disableAutosave() && new Notice("Autosave disabled!");
              }
            } else {
              new Notice("Please specify a valid number.");
            }
          })
      );
  }
}
