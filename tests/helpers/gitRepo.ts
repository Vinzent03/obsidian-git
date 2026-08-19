import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { git } from "./gitCli";

export type TestRepo = {
    dir: string;
    remotePath: string;
    repoPath: string;
    raw(args: string[]): Promise<string>;
    head(): Promise<string>;
    headMessage(): Promise<string>;
    statusPorcelain(): Promise<string>;
    cachedDiffNames(): Promise<string>;
    unpushedCount(tracking?: string): Promise<number>;
    mergeCommitCount(range?: string): Promise<number>;
    show(ref: string): Promise<string>;
    write(filePath: string, content: string): void;
    writeAndCommit(
        filePath: string,
        content: string,
        message: string
    ): Promise<void>;
    appendAndCommit(
        filePath: string,
        content: string,
        message: string
    ): Promise<void>;
    cleanup(): void;
};

export function createTempDirectory(prefix = "obsidian-git-test-"): string {
    return mkdtempSync(path.join(tmpdir(), prefix));
}

export function cleanupTempDirectory(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
}

function write(repoPath: string, filePath: string, content: string): void {
    writeFileSync(path.join(repoPath, filePath), content);
}

async function writeAndCommit(
    repoPath: string,
    filePath: string,
    content: string,
    message: string
): Promise<void> {
    write(repoPath, filePath, content);
    await git(repoPath, ["add", filePath]);
    await git(repoPath, ["commit", "-m", message]);
}

async function appendAndCommit(
    repoPath: string,
    filePath: string,
    content: string,
    message: string
): Promise<void> {
    writeFileSync(path.join(repoPath, filePath), content, { flag: "a" });
    await git(repoPath, ["add", filePath]);
    await git(repoPath, ["commit", "-m", message]);
}

export async function createRepoWithOrigin(): Promise<TestRepo> {
    const dir = createTempDirectory("obsidian-git-cli-test-");
    const remotePath = path.join(dir, "remote.git");
    const repoPath = path.join(dir, "worktree");

    await git(dir, ["init", "--bare", "--initial-branch=main", remotePath]);
    await git(dir, ["init", "--initial-branch=main", repoPath]);
    await git(repoPath, ["config", "user.email", "test@example.com"]);
    await git(repoPath, ["config", "user.name", "Test User"]);
    await git(repoPath, ["remote", "add", "origin", remotePath]);
    await writeAndCommit(repoPath, "note.md", "base\n", "base");
    await git(repoPath, ["push", "--quiet", "-u", "origin", "main"]);

    return {
        dir,
        remotePath,
        repoPath,
        raw: (rawArgs) => git(repoPath, rawArgs),
        head: () => git(repoPath, ["rev-parse", "HEAD"]),
        headMessage: () => git(repoPath, ["log", "-1", "--pretty=%B"]),
        statusPorcelain: () => git(repoPath, ["status", "--porcelain"]),
        cachedDiffNames: () =>
            git(repoPath, ["diff", "--cached", "--name-only"]),
        unpushedCount: async (tracking = "origin/main") =>
            Number(
                await git(repoPath, [
                    "rev-list",
                    "--count",
                    `${tracking}..HEAD`,
                ])
            ),
        mergeCommitCount: async (range = "origin/main..HEAD") =>
            Number(
                await git(repoPath, ["rev-list", "--merges", "--count", range])
            ),
        show: (ref) => git(repoPath, ["show", ref]),
        write: (filePath, content) => write(repoPath, filePath, content),
        writeAndCommit: (filePath, content, message) =>
            writeAndCommit(repoPath, filePath, content, message),
        appendAndCommit: (filePath, content, message) =>
            appendAndCommit(repoPath, filePath, content, message),
        cleanup: () => cleanupTempDirectory(dir),
    };
}
