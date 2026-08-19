import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Runs `git` in `cwd` and returns trimmed stdout. Throws on a non-zero exit
 * so tests can use native git as an oracle without a Node git library.
 */
export async function git(cwd: string, args: string[]): Promise<string> {
    try {
        const { stdout } = await execFileAsync("git", args, {
            cwd,
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
        });
        return stdout.trim();
    } catch (error) {
        const failed = error as {
            stderr?: string;
            stdout?: string;
            message?: string;
        };
        const detail =
            failed.stderr?.trim() ||
            failed.stdout?.trim() ||
            failed.message ||
            `git ${args.join(" ")} failed`;
        throw new Error(detail);
    }
}

export async function gitIsRepo(cwd: string): Promise<boolean> {
    try {
        return (
            (await git(cwd, ["rev-parse", "--is-inside-work-tree"])) === "true"
        );
    } catch {
        return false;
    }
}

export async function gitIsClean(cwd: string): Promise<boolean> {
    return (await git(cwd, ["status", "--porcelain"])) === "";
}

export async function gitUntracked(cwd: string): Promise<string[]> {
    const output = await git(cwd, ["status", "--porcelain", "-uall"]);
    return output
        .split("\n")
        .filter((line) => line.startsWith("?? "))
        .map((line) => line.slice(3));
}

export async function gitStaged(cwd: string): Promise<string[]> {
    const output = await git(cwd, ["diff", "--cached", "--name-only"]);
    return output === "" ? [] : output.split("\n");
}

export async function gitCommitCount(
    cwd: string,
    rev = "HEAD"
): Promise<number> {
    return Number(await git(cwd, ["rev-list", "--count", rev]));
}

export async function gitTags(cwd: string): Promise<string[]> {
    const output = await git(cwd, ["tag"]);
    return output === "" ? [] : output.split("\n");
}
