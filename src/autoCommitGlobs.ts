import picomatch from "picomatch";
import type { FileStatusResult } from "./types";

export type AutoCommitGlobMode = "exclude" | "include";

export interface AutoCommitGlobSelection {
    mode: AutoCommitGlobMode;
    globs: string[];
}

export interface AutoCommitSelectedFiles {
    files: FileStatusResult[];
    selection: AutoCommitGlobSelection;
}

/** One repository-relative Git glob per line. */
export function parseAutoCommitGlobs(setting: string): string[] {
    return setting
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/** Match Git's ordinary glob syntax for the mobile backend. */
export function createAutoCommitGlobMatcher(
    globs: string[]
): (repoPath: string) => boolean {
    const matchers = globs.map((glob) => ({
        matches: picomatch(glob, {
            dot: true,
            nobrace: true,
            noext: true,
            nonegate: true,
            posix: true,
        }),
        // A literal directory pathspec selects its descendants. A wildcard
        // matching a directory does not acquire that recursive behavior.
        literalDirectory:
            !glob.includes("*") && !glob.includes("?") && !glob.includes("["),
    }));
    return (repoPath) => {
        // Git pathspecs also select the descendants of a matching directory.
        const segments = repoPath.split("/");
        return matchers.some(({ matches, literalDirectory }) => {
            if (matches(repoPath)) return true;
            if (!literalDirectory) return false;
            for (let i = 1; i < segments.length; i++) {
                if (matches(segments.slice(0, i).join("/"))) return true;
            }
            return false;
        });
    };
}

export function createAutoCommitPathSelector(
    selection: AutoCommitGlobSelection
): (repoPath: string) => boolean {
    if (selection.mode === "include" && selection.globs.length === 0) {
        return () => false;
    }
    const matches = createAutoCommitGlobMatcher(selection.globs);
    return (repoPath) =>
        selection.mode === "include" ? matches(repoPath) : !matches(repoPath);
}
