import { App } from "obsidian";
import ObsidianGit from "./main";
import { FileStatusResult, Status } from "./types";


export abstract class GitManager {
    plugin: ObsidianGit;
    app: App;
    constructor(plugin: ObsidianGit) {
        this.plugin = plugin;
        this.app = plugin.app;
    }

    abstract status(): Promise<Status>;

    abstract commit(message?: string): Promise<void>;

    async formatCommitMessage(): Promise<string> {
        let template = this.plugin.settings.commitMessage;

        if (template.includes("{{numFiles}}")) {
            let status = await this.status();
            let numFiles = status.changed.length;
            template = template.replace("{{numFiles}}", String(numFiles));
        }

        if (template.includes("{{files}}")) {
            let status = await this.status();

            let changeset: { [key: string]: string[]; } = {};
            status.changed.forEach((value: FileStatusResult) => {
                if (value.index in changeset) {
                    changeset[value.index].push(value.path);
                } else {
                    changeset[value.index] = [value.path];
                }
            });

            let chunks = [];
            for (let [action, files] of Object.entries(changeset)) {
                chunks.push(action + " " + files.join(" "));
            }

            let files = chunks.join(", ");

            template = template.replace("{{files}}", files);
        }

        let moment = (window as any).moment;
        template = template.replace(
            "{{date}}",
            moment().format(this.plugin.settings.commitDateFormat)
        );
        if (this.plugin.settings.listChangedFilesInMessageBody) {
            template = template + "\n\n" + "Affected files:" + "\n" + (await this.status()).staged.join("\n");
        }
        return template;
    }
}
