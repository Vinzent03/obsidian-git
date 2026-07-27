import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import simpleGit, { type SimpleGit } from "simple-git";

export type TestRepo = {
    dir: string;
    remotePath: string;
    repoPath: string;
    git: SimpleGit;
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

async function gitRaw(git: SimpleGit, args: string[]): Promise<string> {
    return (await git.raw(args)).trim();
}

function write(repoPath: string, filePath: string, content: string): void {
    writeFileSync(path.join(repoPath, filePath), content);
}

async function writeAndCommit(
    git: SimpleGit,
    repoPath: string,
    filePath: string,
    content: string,
    message: string
): Promise<void> {
    write(repoPath, filePath, content);
    await git.add(filePath);
    await git.commit(message);
}

async function appendAndCommit(
    git: SimpleGit,
    repoPath: string,
    filePath: string,
    content: string,
    message: string
): Promise<void> {
    writeFileSync(path.join(repoPath, filePath), content, { flag: "a" });
    await git.add(filePath);
    await git.commit(message);
}

function createTestRepoFixture(args: {
    dir: string;
    remotePath: string;
    repoPath: string;
    git: SimpleGit;
}): TestRepo {
    const { dir, remotePath, repoPath, git } = args;
    return {
        dir,
        remotePath,
        repoPath,
        git,
        raw: (rawArgs) => gitRaw(git, rawArgs),
        head: () => gitRaw(git, ["rev-parse", "HEAD"]),
        headMessage: () => gitRaw(git, ["log", "-1", "--pretty=%B"]),
        statusPorcelain: () => gitRaw(git, ["status", "--porcelain"]),
        cachedDiffNames: () => gitRaw(git, ["diff", "--cached", "--name-only"]),
        unpushedCount: async (tracking = "origin/main") =>
            Number(
                await gitRaw(git, ["rev-list", "--count", `${tracking}..HEAD`])
            ),
        mergeCommitCount: async (range = "origin/main..HEAD") =>
            Number(
                await gitRaw(git, ["rev-list", "--merges", "--count", range])
            ),
        show: (ref) => gitRaw(git, ["show", ref]),
        write: (filePath, content) => write(repoPath, filePath, content),
        writeAndCommit: (filePath, content, message) =>
            writeAndCommit(git, repoPath, filePath, content, message),
        appendAndCommit: (filePath, content, message) =>
            appendAndCommit(git, repoPath, filePath, content, message),
        cleanup: () => cleanupTempDirectory(dir),
    };
}

export async function createRepoWithOrigin(): Promise<TestRepo> {
    const dir = createTempDirectory("obsidian-git-simple-git-test-");
    const remotePath = path.join(dir, "remote.git");
    const repoPath = path.join(dir, "worktree");

    await simpleGit(dir).raw([
        "init",
        "--bare",
        "--initial-branch=main",
        remotePath,
    ]);
    await simpleGit(dir).raw(["init", "--initial-branch=main", repoPath]);

    const git = simpleGit({
        baseDir: repoPath,
        config: ["core.quotepath=off"],
    });
    await git.addConfig("user.email", "test@example.com");
    await git.addConfig("user.name", "Test User");
    await git.addRemote("origin", remotePath);
    await writeAndCommit(git, repoPath, "note.md", "base\n", "base");
    await git.push(["--quiet", "-u", "origin", "main"]);

    return createTestRepoFixture({ dir, remotePath, repoPath, git });
}
