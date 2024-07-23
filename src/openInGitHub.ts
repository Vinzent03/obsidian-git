import type { Editor, TFile } from "obsidian";
import { Notice } from "obsidian";
import type { GitManager } from "./gitManager/gitManager";
import { SimpleGit } from "./gitManager/simpleGit";

export async function openLineInGitHub(
    editor: Editor,
    file: TFile,
    manager: GitManager
) {
    const data = await getData(file, manager);

    if (data.result === "failure") {
        new Notice(data.reason);
        return;
    }

    const { isGitHub, branch, repo, user, filePath } = data;
    if (isGitHub) {
        const from = editor.getCursor("from").line + 1;
        const to = editor.getCursor("to").line + 1;
        if (from === to) {
            window.open(
                `https://github.com/${user}/${repo}/blob/${branch}/${filePath}?plain=1#L${from}`
            );
        } else {
            window.open(
                `https://github.com/${user}/${repo}/blob/${branch}/${filePath}?plain=1#L${from}-L${to}`
            );
        }
    } else {
        new Notice("It seems like you are not using GitHub");
    }
}

export async function openHistoryInGitHub(file: TFile, manager: GitManager) {
    const data = await getData(file, manager);

    if (data.result === "failure") {
        new Notice(data.reason);
        return;
    }

    const { isGitHub, branch, repo, user, filePath } = data;

    if (isGitHub) {
        window.open(
            `https://github.com/${user}/${repo}/commits/${branch}/${filePath}`
        );
    } else {
        new Notice("It seems like you are not using GitHub");
    }
}

async function getData(
    file: TFile,
    manager: GitManager
): Promise<
    | {
          result: "success";
          isGitHub: boolean;
          user: string;
          repo: string;
          branch: string;
          filePath: string;
      }
    | { result: "failure"; reason: string }
> {
    const branchInfo = await manager.branchInfo();
    let remoteBranch = branchInfo.tracking;
    let branch = branchInfo.current;
    let remoteUrl: string | undefined = undefined;
    let filePath = manager.getRelativeRepoPath(file.path);

    if (manager instanceof SimpleGit) {
        const submodule = await manager.getSubmoduleOfFile(
            manager.getRelativeRepoPath(file.path)
        );
        if (submodule) {
            filePath = submodule.relativeFilepath;
            const status = await manager.git
                .cwd({
                    path: submodule.submodule,
                    root: false,
                })
                .status();

            remoteBranch = status.tracking || undefined;
            branch = status.current || undefined;
            if (remoteBranch) {
                const remote = remoteBranch.substring(
                    0,
                    remoteBranch.indexOf("/")
                );

                const config = await manager.git
                    .cwd({
                        path: submodule.submodule,
                        root: false,
                    })
                    .getConfig(`remote.${remote}.url`, "local");

                if (config.value != null) {
                    remoteUrl = config.value;
                } else {
                    return {
                        result: "failure",
                        reason: "Failed to get remote url of submodule",
                    };
                }
            }
        }
    }

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

    if (remoteUrl == null) {
        const remote = remoteBranch.substring(0, remoteBranch.indexOf("/"));
        remoteUrl = await manager.getConfig(`remote.${remote}.url`);
        if (remoteUrl == null) {
            return {
                result: "failure",
                reason: "Failed to get remote url",
            };
        }
    }
    const res = remoteUrl.match(
        /(?:^https:\/\/github\.com\/(.+)\/(.+?)(?:\.git)?$)|(?:^[a-zA-Z]+@github\.com:(.+)\/(.+?)(?:\.git)?$)/
    );
    if (res == null) {
        return {
            result: "failure",
            reason: "Could not parse remote url",
        };
    } else {
        const [isGitHub, httpsUser, httpsRepo, sshUser, sshRepo] = res;
        return {
            result: "success",
            isGitHub: !!isGitHub,
            repo: httpsRepo || sshRepo,
            user: httpsUser || sshUser,
            branch: branch,
            filePath: filePath,
        };
    }
}
