import { Editor, Notice, TFile } from "obsidian";
import { GitManager } from "./gitManager/gitManager";

export async function openLineInGitHub(
    editor: Editor,
    file: TFile,
    manager: GitManager
) {
    const data = await getData(manager);

    if (data.result === "failure") {
        new Notice(data.reason);
        return;
    }

    const { isGitHub, branch, repo, user } = data;
    if (isGitHub) {
        const path = manager.getRelativeRepoPath(file.path);
        const from = editor.getCursor("from").line + 1;
        const to = editor.getCursor("to").line + 1;
        if (from === to) {
            window.open(
                `https://github.com/${user}/${repo}/blob/${branch}/${path}?plain=1#L${from}`
            );
        } else {
            window.open(
                `https://github.com/${user}/${repo}/blob/${branch}/${path}?plain=1#L${from}-L${to}`
            );
        }
    } else {
        new Notice("It seems like you are not using GitHub");
    }
}

export async function openHistoryInGitHub(file: TFile, manager: GitManager) {
    const data = await getData(manager);

    if (data.result === "failure") {
        new Notice(data.reason);
        return;
    }

    const { isGitHub, branch, repo, user } = data;
    const path = manager.getRelativeRepoPath(file.path);

    if (isGitHub) {
        window.open(
            `https://github.com/${user}/${repo}/commits/${branch}/${path}`
        );
    } else {
        new Notice("It seems like you are not using GitHub");
    }
}

async function getData(manager: GitManager): Promise<
    | {
          result: "success";
          isGitHub: boolean;
          user: string;
          repo: string;
          branch: string;
      }
    | { result: "failure"; reason: string }
> {
    const branchInfo = await manager.branchInfo();
    const remoteBranch = branchInfo.tracking;
    const branch = branchInfo.current;

    if (remoteBranch == null) {
        return {
            result: "failure",
            reason: "Remote branch is not configured",
        };
    }

    if (branch == null) {
        return {
            result: "failure",
            reason: "Failed to get current branch name",
        };
    }

    const remote = remoteBranch.substring(0, remoteBranch.indexOf("/"));
    const remoteUrl = (await manager.getConfig(
        `remote.${remote}.url`
    )) as string;
    // TODO: This process always causes a runtime error if the remote url is not github.com, so it should be fixed.
    // However, this runtime error does not have a fatal negative impact, so we temporary ignore.
    // @ts-ignore
    const [isGitHub, httpsUser, httpsRepo, sshUser, sshRepo] = remoteUrl.match(
        /(?:^https:\/\/github\.com\/(.*)\/(.*)\.git$)|(?:^[a-zA-Z]+@github\.com:(.*)\/(.*)\.git$)/
    );
    return {
        result: "success",
        isGitHub: !!isGitHub,
        repo: httpsRepo || sshRepo,
        user: httpsUser || sshUser,
        branch: branch,
    };
}
