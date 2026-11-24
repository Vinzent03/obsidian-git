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

/** Git treats parentheses literally. Preserve existing escape sequences. */
function escapeGlobParentheses(glob: string): string {
    return glob.replace(/\\.|[()]/g, (token) =>
        token.length === 1 ? `\\${token}` : token
    );
}

/**
 * Rewrite backslash escapes in a Git glob without changing what it matches.
 *
 * Git for Windows treats every backslash in a pathspec as a directory
 * separator, so an escape such as `\(` fails there with "Invalid path". An
 * escaped wildcard becomes a one-character bracket expression (`\*` -> `[*]`)
 * and any other escaped character becomes itself. Bracket expressions with
 * escapes are reordered so they need none. An escaped backslash is kept; a
 * Windows path cannot contain one anyway.
 */
export function replaceGlobEscapes(glob: string): string {
    let result = "";
    for (let i = 0; i < glob.length; i++) {
        const char = glob[i]!;
        if (char === "\\" && i + 1 < glob.length) {
            const next = glob[++i]!;
            if (next === "\\") result += "\\\\";
            else if ("*?[".includes(next)) result += `[${next}]`;
            else result += next;
        } else if (char === "[") {
            const bracket = replaceBracketEscapes(glob, i);
            result += bracket?.text ?? char;
            i = bracket?.end ?? i;
        } else {
            result += char;
        }
    }
    return result;
}

/**
 * Parse the bracket expression starting at `start` as Git's wildmatch does,
 * and rewrite it without escapes where possible. Returns undefined for an
 * unterminated expression, which Git never matches.
 */
function replaceBracketEscapes(
    glob: string,
    start: number
): { text: string; end: number } | undefined {
    let i = start + 1;
    let negation = "";
    if (glob[i] === "!" || glob[i] === "^") negation = glob[i++]!;

    const literals = new Set<string>();
    const others: string[] = []; // ranges and character classes
    let hasEscape = false;
    let representable = true;
    const readChar = (): string | undefined => {
        if (glob[i] === "\\") {
            hasEscape = true;
            i++;
        }
        return glob[i++];
    };

    // A "]" right after "[" or "[!" is a member, not the end.
    for (let first = true; i < glob.length; first = false) {
        if (glob[i] === "]" && !first) {
            const original = { text: glob.slice(start, i + 1), end: i };
            if (!hasEscape || !representable) return original;
            const body = bracketBody(literals, others);
            if (body === undefined) return original;
            if (!negation && body.length === 1 && !"*?[".includes(body)) {
                return { text: body, end: i };
            }
            return { text: `[${negation}${body}]`, end: i };
        }
        if (glob[i] === "[" && glob[i + 1] === ":") {
            const classEnd = glob.indexOf(":]", i + 2);
            if (classEnd !== -1) {
                others.push(glob.slice(i, classEnd + 2));
                i = classEnd + 2;
                continue;
            }
        }
        const low = readChar();
        if (low === undefined) return undefined;
        if (glob[i] === "-" && i + 1 < glob.length && glob[i + 1] !== "]") {
            i++;
            const high = readChar();
            if (high === undefined) return undefined;
            // A range end of "]" or "\" cannot be written without an escape.
            if ("]\\".includes(low) || "]\\".includes(high)) {
                representable = false;
            }
            others.push(`${low}-${high}`);
        } else {
            literals.add(low);
        }
    }
    return undefined;
}

/**
 * Order the members of a bracket expression so that none needs an escape:
 * "]" first, "!" and "^" after other members, "-" last. Returns undefined if
 * that is impossible.
 */
function bracketBody(
    literals: Set<string>,
    others: string[]
): string | undefined {
    const plain = [...literals].filter((c) => !"]-!^\\".includes(c));
    const body =
        (literals.has("]") ? "]" : "") +
        others.join("") +
        plain.join("") +
        (literals.has("\\") ? "\\\\" : "") +
        (literals.has("!") ? "!" : "") +
        (literals.has("^") ? "^" : "");
    // "[:" would start a character class such as "[:alpha:]".
    if (plain.join("").includes("[:")) return undefined;
    if (!literals.has("-")) {
        // A leading "!" or "^" would negate the expression.
        if (body.length > 1 && (body[0] === "!" || body[0] === "^")) {
            return undefined;
        }
        return body;
    }
    // A leading "-" is literal too, and keeps "!" or "^" from leading.
    return body[0] === "!" || body[0] === "^" ? `-${body}` : `${body}-`;
}

/** Match Git's ordinary glob syntax for the mobile backend. */
export function createAutoCommitGlobMatcher(
    globs: string[]
): (repoPath: string) => boolean {
    const matchers = globs.map((glob) => ({
        // Ancestor paths have no trailing slash; keep directory-only matching
        // separate so a pattern like "note.md/" never selects a regular file.
        matches: picomatch(
            escapeGlobParentheses(glob.replace(/\/+$/, "") || glob),
            {
                dot: true,
                nobrace: true,
                noext: true,
                nonegate: true,
                posix: true,
            }
        ),
        directoryOnly: glob.endsWith("/"),
        // A literal directory pathspec selects its descendants. A wildcard
        // matching a directory does not acquire that recursive behavior.
        literalDirectory:
            !glob.includes("*") && !glob.includes("?") && !glob.includes("["),
    }));
    return (repoPath) => {
        // Git pathspecs also select the descendants of a matching directory.
        const segments = repoPath.split("/");
        return matchers.some(({ matches, directoryOnly, literalDirectory }) => {
            if (!directoryOnly && matches(repoPath)) return true;
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
