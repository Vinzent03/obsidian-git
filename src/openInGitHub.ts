import { shell } from "electron";
import { Editor, Notice, TFile } from "obsidian";
import { GitManager } from "./gitManager";

export async function openLineInGitHub(editor: Editor, file: TFile, manager: GitManager) {
    const { isGitHub, branch, repo, user } = await getData(manager);
    if (isGitHub) {
        const from = editor.getCursor("from").line + 1;
        const to = editor.getCursor("to").line + 1;
        if (from === to) {
            await shell.openExternal(`https://github.com/${user}/${repo}/blob/${branch}/${file.path}?plain=1#L${from}`);
        } else {
            await shell.openExternal(`https://github.com/${user}/${repo}/blob/${branch}/${file.path}?plain=1#L${from}-L${to}`);
        }
    } else {
        new Notice('It seems like you are not using GitHub');
    }
}

export async function openHistoryInGitHub(file: TFile, manager: GitManager) {
    const { isGitHub, branch, repo, user } = await getData(manager);

    if (isGitHub) {
        await shell.openExternal(`https://github.com/${user}/${repo}/commits/${branch}/${file.path}`);
    } else {
        new Notice('It seems like you are not using GitHub');
    }
};

async function getData(manager: GitManager): Promise<{ isGitHub: boolean, user: string, repo: string; branch: string; }> {
    const branchInfo = await manager.branchInfo();
    const remoteBranch = branchInfo.tracking;
    const branch = branchInfo.current;

    const remote = remoteBranch.substring(0, remoteBranch.indexOf("/"));
    const remoteUrl = await manager.getConfig(`remote.${remote}.url`) as string;
    const [isGitHub, httpsUser, httpsRepo, sshUser, sshRepo] = remoteUrl.match(/(?:^https:\/\/github\.com\/(.*)\/(.*)\.git$)|(?:^git@github\.com:(.*)\/(.*)\.git$)/);
    return {
        isGitHub: !!isGitHub,
        repo: httpsRepo || sshRepo,
        user: httpsUser || sshUser,
        branch: branch,
    };
}