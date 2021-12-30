import { Editor, Notice, TFile } from "obsidian";
import { GitManager } from "./gitManager";
import { shell } from "electron";

export async function openLineInGitHub(editor: Editor, file: TFile, manager: GitManager) {
    const remoteUrl = await manager.getConfig('remote.origin.url') as string;
    const branch = (await manager.branchInfo()).current;
    const [isGitHub, user, repo] = remoteUrl.match(/(?:^https:\/\/github\.com\/(.*)\/(.*)\.git$)|(?:^git@github\.com:(.*)\/(.*)\.git$)/);
    if (!!isGitHub) {
        const from = editor.getCursor("from").line + 1;
        const to = editor.getCursor("to").line + 1;
        if(from === to) {
            await shell.openExternal(`https://github.com/${user}/${repo}/blob/${branch}/${file.path}?plain=1#L${from}`);
        } else {
            await shell.openExternal(`https://github.com/${user}/${repo}/blob/${branch}/${file.path}?plain=1#L${from}-L${to}`);
        }
    } else {
        new Notice('It seems like you are not using GitHub');
    }
}

export async function openHistoryInGitHub(file: TFile, manager: GitManager) {
    const remoteUrl = await manager.getConfig('remote.origin.url') as string;
    const branch = (await manager.branchInfo()).current;
    const [isGitHub, user, repo] = remoteUrl.match(/(?:^https:\/\/github\.com\/(.*)\/(.*)\.git$)|(?:^git@github\.com:(.*)\/(.*)\.git$)/);
    if (!!isGitHub) {
            await shell.openExternal(`https://github.com/${user}/${repo}/commits/${branch}/${file.path}`);
    } else {
        new Notice('It seems like you are not using GitHub');
    }
};