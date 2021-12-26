import { Editor, Notice, TFile } from "obsidian";
import { GitManager } from "./gitManager";
import { shell } from "electron";

export default async function openInGitHub(editor: Editor, file: TFile, manager: GitManager) {
    const remoteUrl = await manager.getConfig('remote.origin.url') as string;
    const branch = (await manager.branchInfo()).current;
    const [url, user, repo] = remoteUrl.match(/(?>^https:\/\/github\.com\/(.*)\/(.*)\.git$)|(?>^git@github\.com:(.*)\/(.*)\.git$)/);
    //If Github is used
    if (url) {
        await shell.openExternal(`https://github.com/${user}/${repo}/blob/${branch}/${file.path}`);
    } else {
        new Notice('It seems like you are not using GitHub');
    }
}
