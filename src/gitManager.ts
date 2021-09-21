import { App } from "obsidian";
import ObsidianGit from "./main";
import { BranchInfo, FileStatusResult, Status } from "./types";


export abstract class GitManager {
    readonly plugin: ObsidianGit;
    readonly app: App;
    constructor(plugin: ObsidianGit) {
        this.plugin = plugin;
        this.app = plugin.app;
    }

    abstract status(): Promise<Status>;

    abstract commitAll(message?: string): Promise<number>;

    abstract pull(): Promise<number>;

    abstract push(): Promise<number>;

    abstract canPush(): Promise<boolean>;

    abstract checkRequirements(): Promise<"valid" | "missing-repo" | "missing-git">;

    abstract branchInfo(): Promise<BranchInfo>;

    abstract checkout(branch: string): Promise<void>;

    abstract init(): Promise<void>;

    abstract clone(url: string, dir: string): Promise<void>;

    abstract setConfig(path: string, value: any): Promise<void>;

    abstract getConfig(path: string): Promise<any>;

    abstract fetch(remote?: string): Promise<void>;

    abstract setRemote(name: string, url: string): Promise<void>;

    abstract getRemotes(): Promise<string[]>;

    abstract getRemoteBranches(remote: string): Promise<string[]>;

    abstract removeRemote(remoteName: string): Promise<void>;

    abstract updateUpstreamBranch(remoteBranch: string): Promise<void>;

    abstract updateGitPath(gitPath: string): void;

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
