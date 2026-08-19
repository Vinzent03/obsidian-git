import type { Blame, BlameCommit, MergeStrategy } from "../../types";

export interface ParsedStatus {
    /** Short name of the current branch, undefined when HEAD is unborn/detached. */
    branch?: string;
    ahead: number;
    behind: number;
    files: ParsedStatusFile[];
    conflicted: string[];
}

export interface ParsedStatusFile {
    index: string;
    workingDir: string;
    path: string;
    from?: string;
}

/**
 * Parses the output of `lg2 status -s -b [-uall]`, which follows the
 * `git status --short --branch` format plus two lg2 extras: an ahead/behind
 * summary line and one `conflict: a:<ancestor> o:<ours> t:<theirs>` line per
 * conflicted index entry.
 */
export function parseStatus(output: string): ParsedStatus {
    const result: ParsedStatus = {
        branch: undefined,
        ahead: 0,
        behind: 0,
        files: [],
        conflicted: [],
    };
    for (const line of output.split("\n")) {
        if (line.length === 0) continue;
        if (line.startsWith("## ")) {
            const branch = line.substring(3);
            result.branch = branch === "HEAD (no branch)" ? undefined : branch;
            continue;
        }
        const aheadBehind = parseAheadBehind(line);
        if (aheadBehind) {
            result.ahead = aheadBehind.ahead;
            result.behind = aheadBehind.behind;
            continue;
        }
        const conflict = line.match(/^conflict: a:(.*) o:(.*) t:(.*)$/);
        if (conflict) {
            const path =
                firstNonNull(conflict[2], conflict[3], conflict[1]) ?? "";
            if (path && !result.conflicted.includes(path)) {
                result.conflicted.push(path);
            }
            continue;
        }
        if (line.startsWith("# ")) continue;
        if (line.length < 4 || line[2] !== " ") continue;
        const index = line[0]!;
        const workingDir = line[1]!;
        let path = line.substring(3);
        let from: string | undefined;
        if (index === "R" || workingDir === "R") {
            // Rename entries print "old new" without quoting. Filenames with
            // spaces are ambiguous here; splitting at the last space is right
            // for the overwhelmingly common case.
            const separator = path.lastIndexOf(" ");
            if (separator > 0) {
                from = path.substring(0, separator);
                path = path.substring(separator + 1);
            }
        }
        result.files.push({ index, workingDir, path, from });
    }
    // Conflicted entries appear with blank status columns in the short
    // format; normalize them to the "UU" convention used by git.
    for (const path of result.conflicted) {
        const file = result.files.find((entry) => entry.path === path);
        if (file) {
            file.index = "U";
            file.workingDir = "U";
        } else {
            result.files.push({ index: "U", workingDir: "U", path });
        }
    }
    return result;
}

export function parseAheadBehind(
    line: string
): { ahead: number; behind: number } | undefined {
    const match = line.match(
        /^# Your branch is ahead by (\d+), behind by (\d+) commits?\.$/
    );
    if (!match) return undefined;
    return { ahead: parseInt(match[1]!), behind: parseInt(match[2]!) };
}

export interface ParsedNameStatusEntry {
    type: "M" | "A" | "D";
    path: string;
}

/** Parses `lg2 diff --name-status` output (`X<TAB>path` per line). */
export function parseNameStatus(output: string): ParsedNameStatusEntry[] {
    const entries: ParsedNameStatusEntry[] = [];
    for (const line of output.split("\n")) {
        const match = line.match(/^([A-Z])\t(.*)$/);
        if (!match) continue;
        const status = match[1]!;
        const type: "M" | "A" | "D" =
            status === "A" ? "A" : status === "D" ? "D" : "M";
        entries.push({ type, path: match[2]! });
    }
    return entries;
}

export interface ParsedLogEntry {
    hash: string;
    /** Short hashes of the parents, only present for merge commits. */
    merge?: string[];
    authorName: string;
    authorEmail: string;
    date: Date;
    message: string;
    body: string;
}

/**
 * Parses the default `lg2 log` output:
 *
 *     commit <sha>
 *     Merge: <short> <short>          (merge commits only)
 *     Author: Name <email>
 *     Date:   Wed Aug 19 17:01:39 2026 +0000
 *
 *         subject
 *
 *         body...
 */
export function parseLog(output: string): ParsedLogEntry[] {
    const entries: ParsedLogEntry[] = [];
    let current: ParsedLogEntry | undefined;
    let messageLines: string[] = [];

    const finish = () => {
        if (!current) return;
        const [subject = "", ...rest] = splitMessageParagraphs(messageLines);
        current.message = subject;
        current.body = rest.join("\n\n");
        entries.push(current);
        current = undefined;
        messageLines = [];
    };

    for (const line of output.split("\n")) {
        const commit = line.match(/^commit ([0-9a-f]{4,40})$/);
        if (commit) {
            finish();
            current = {
                hash: commit[1]!,
                authorName: "",
                authorEmail: "",
                date: new Date(0),
                message: "",
                body: "",
            };
            continue;
        }
        if (!current) continue;
        const merge = line.match(/^Merge: (.+)$/);
        if (merge) {
            current.merge = merge[1]!.split(" ");
            continue;
        }
        const author = line.match(/^Author: (.*) <(.*)>$/);
        if (author) {
            current.authorName = author[1]!;
            current.authorEmail = author[2]!;
            continue;
        }
        const date = line.match(/^Date: {3}(.*)$/);
        if (date) {
            current.date = parseGitDate(date[1]!) ?? current.date;
            continue;
        }
        if (line.startsWith("    ")) {
            messageLines.push(line.substring(4));
        } else if (line === "" && messageLines.length > 0) {
            messageLines.push("");
        }
    }
    finish();
    return entries;
}

function splitMessageParagraphs(lines: string[]): string[] {
    const trimmed = [...lines];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
        trimmed.pop();
    }
    return trimmed.join("\n").split("\n\n");
}

const MONTHS: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
};

/** Parses git's default date format, e.g. `Wed Aug 19 17:01:39 2026 +0000`. */
export function parseGitDate(text: string): Date | undefined {
    const match = text.match(
        /^\w{3} (\w{3}) (\d+) (\d+):(\d+):(\d+) (\d+) ([+-])(\d{2})(\d{2})$/
    );
    if (!match) return undefined;
    const month = MONTHS[match[1]!];
    if (month == undefined) return undefined;
    const utc = Date.UTC(
        parseInt(match[6]!),
        month,
        parseInt(match[2]!),
        parseInt(match[3]!),
        parseInt(match[4]!),
        parseInt(match[5]!)
    );
    const offsetMinutes =
        (match[7] === "-" ? -1 : 1) *
        (parseInt(match[8]!) * 60 + parseInt(match[9]!));
    return new Date(utc - offsetMinutes * 60_000);
}

export interface ParsedRef {
    oid: string;
    type: string;
    refName: string;
}

/** Parses `lg2 for-each-ref` output (`<oid> <type><TAB><refname>`). */
export function parseForEachRef(output: string): ParsedRef[] {
    const refs: ParsedRef[] = [];
    for (const line of output.split("\n")) {
        const match = line.match(/^([0-9a-f]{40}) (\S+)\t(.*)$/);
        if (match) {
            refs.push({ oid: match[1]!, type: match[2]!, refName: match[3]! });
        }
    }
    return refs;
}

/** Parses `lg2 ls-remote <remote>` output (`<oid><TAB><refname>`). */
export function parseLsRemote(
    output: string
): { oid: string; refName: string }[] {
    const refs: { oid: string; refName: string }[] = [];
    for (const line of output.split("\n")) {
        const match = line.match(/^([0-9a-f]{40})\t(.*)$/);
        if (match) {
            refs.push({ oid: match[1]!, refName: match[2]! });
        }
    }
    return refs;
}

/** Parses `lg2 remote show -v` output into `name -> url`. */
export function parseRemoteVerbose(output: string): Map<string, string> {
    const remotes = new Map<string, string>();
    for (const line of output.split("\n")) {
        const match = line.match(/^(\S+)\t(.*) \((?:fetch|push)\)$/);
        if (match && !remotes.has(match[1]!)) {
            remotes.set(match[1]!, match[2]!);
        }
    }
    return remotes;
}

export interface ParsedBlameLine {
    hash: string;
    name: string;
    email: string;
    /** 1-based line number in the final file. */
    line: number;
    content: string;
}

/**
 * Parses `lg2 blame <path>` output. Each line has the format
 * `<shorthash> ( Name <email>  <line>) <content>` with the signature padded
 * to a fixed width.
 */
export function parseBlame(output: string): ParsedBlameLine[] {
    const lines: ParsedBlameLine[] = [];
    for (const raw of output.split("\n")) {
        const match = raw.match(/^([0-9a-f]+) \( (.*?) <(.*?)> +(\d+)\) (.*)$/);
        if (!match) continue;
        lines.push({
            hash: match[1]!,
            name: match[2]!.trim(),
            email: match[3]!,
            line: parseInt(match[4]!),
            content: match[5]!,
        });
    }
    return lines;
}

export interface ParsedCommitObject {
    tree: string;
    parents: string[];
    author: { name: string; email: string; epochSeconds: number; tz: string };
    committer: {
        name: string;
        email: string;
        epochSeconds: number;
        tz: string;
    };
    message: string;
}

/** Parses raw commit object contents as printed by `lg2 cat-file -p`. */
export function parseCommitObject(
    output: string
): ParsedCommitObject | undefined {
    const [header, ...messageParts] = output.split("\n\n");
    if (header == undefined) return undefined;
    const result: ParsedCommitObject = {
        tree: "",
        parents: [],
        author: { name: "", email: "", epochSeconds: 0, tz: "+0000" },
        committer: { name: "", email: "", epochSeconds: 0, tz: "+0000" },
        message: messageParts.join("\n\n"),
    };
    for (const line of header.split("\n")) {
        const tree = line.match(/^tree ([0-9a-f]{40})$/);
        if (tree) {
            result.tree = tree[1]!;
            continue;
        }
        const parent = line.match(/^parent ([0-9a-f]{40})$/);
        if (parent) {
            result.parents.push(parent[1]!);
            continue;
        }
        const signature = line.match(
            /^(author|committer) (.*) <(.*)> (\d+) ([+-]\d{4})$/
        );
        if (signature) {
            const target =
                signature[1] === "author" ? result.author : result.committer;
            target.name = signature[2]!;
            target.email = signature[3]!;
            target.epochSeconds = parseInt(signature[4]!);
            target.tz = signature[5]!;
        }
    }
    if (result.tree === "") return undefined;
    return result;
}

/**
 * Extracts the section of a unified diff belonging to one file from a
 * whole-repository patch, since lg2's `diff` command does not accept a
 * pathspec.
 */
export function extractFileDiff(
    patch: string,
    path: string
): string | undefined {
    const lines = patch.split("\n");
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!line.startsWith("diff --git ")) continue;
        const isMatch =
            line === `diff --git a/${path} b/${path}` ||
            line.endsWith(` b/${path}`);
        if (start >= 0) {
            return lines.slice(start, i).join("\n") + "\n";
        }
        if (isMatch) start = i;
    }
    if (start >= 0) {
        const section = lines.slice(start).join("\n");
        return section.endsWith("\n") ? section : section + "\n";
    }
    return undefined;
}

/**
 * Resolves standard git conflict markers in a file by keeping either the
 * local ("ours") or incoming ("theirs") side, emulating the automatic merge
 * strategies that isomorphic-git provided through a custom merge driver.
 *
 * Returns undefined when the content has no complete marker block, so
 * callers can leave such files conflicted instead of corrupting them.
 */
export function resolveConflictMarkers(
    content: string,
    strategy: Exclude<MergeStrategy, "none">
): string | undefined {
    const lines = content.split("\n");
    const resolved: string[] = [];
    let region: "none" | "ours" | "base" | "theirs" = "none";
    let sawConflict = false;
    for (const line of lines) {
        if (region === "none" && line.startsWith("<<<<<<<")) {
            region = "ours";
            sawConflict = true;
            continue;
        }
        if (region === "ours" && line.startsWith("|||||||")) {
            region = "base";
            continue;
        }
        if ((region === "ours" || region === "base") && line === "=======") {
            region = "theirs";
            continue;
        }
        if (region === "theirs" && line.startsWith(">>>>>>>")) {
            region = "none";
            continue;
        }
        if (region === "none") {
            resolved.push(line);
        } else if (region === "ours" && strategy === "ours") {
            resolved.push(line);
        } else if (region === "theirs" && strategy === "theirs") {
            resolved.push(line);
        }
    }
    if (!sawConflict || region !== "none") return undefined;
    return resolved.join("\n");
}

/**
 * Removes one entry from git config file contents, since lg2's `config`
 * command can only get and set values. `path` uses the dotted notation, e.g.
 * `branch.main.merge` (section `branch "main"`, key `merge`).
 */
export function removeConfigKey(content: string, path: string): string {
    const segments = path.split(".");
    if (segments.length < 2) return content;
    const key = segments[segments.length - 1]!.toLowerCase();
    const section = segments[0]!.toLowerCase();
    const subsection = segments.slice(1, -1).join(".");

    const lines = content.split("\n");
    const result: string[] = [];
    let inTargetSection = false;
    for (const line of lines) {
        const header = line.match(/^\s*\[([^\s\]]+)(?:\s+"(.*)")?\]\s*$/);
        if (header) {
            inTargetSection =
                header[1]!.toLowerCase() === section &&
                (header[2] ?? "") === subsection;
            result.push(line);
            continue;
        }
        if (inTargetSection) {
            const entry = line.match(/^\s*([^\s=]+)\s*=/);
            if (entry && entry[1]!.toLowerCase() === key) {
                continue;
            }
        }
        result.push(line);
    }
    return result.join("\n");
}

/**
 * Splits a raw command line into arguments, honoring single and double
 * quotes, for the "Open raw command" palette entry.
 */
export function splitCommandLine(command: string): string[] {
    const args: string[] = [];
    let current = "";
    let quote: '"' | "'" | undefined;
    let hasToken = false;
    for (const char of command) {
        if (quote) {
            if (char === quote) {
                quote = undefined;
            } else {
                current += char;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            hasToken = true;
            continue;
        }
        if (char === " " || char === "\t") {
            if (hasToken || current.length > 0) {
                args.push(current);
                current = "";
                hasToken = false;
            }
            continue;
        }
        current += char;
    }
    if (hasToken || current.length > 0) {
        args.push(current);
    }
    return args;
}

/**
 * Turns lg2's non-porcelain blame lines plus commit objects into the
 * porcelain-shaped {@link Blame} used by line authoring.
 */
export function toPorcelainBlame(
    lines: ParsedBlameLine[],
    commits: Map<string, ParsedCommitObject>,
    fullHashes: Map<string, string>
): Blame {
    const blameCommits = new Map<string, BlameCommit>();
    const hashPerLine: string[] = [undefined as unknown as string];
    const originalFileLineNrPerLine: number[] = [
        undefined as unknown as number,
    ];
    const finalFileLineNrPerLine: number[] = [undefined as unknown as number];
    const groupSizePerStartingLine = new Map<number, number>();

    let previousHash: string | undefined;
    let groupStart = 1;
    let groupSize = 0;

    for (const line of lines) {
        const full = fullHashes.get(line.hash) ?? line.hash;
        if (!blameCommits.has(full)) {
            const object = commits.get(line.hash);
            blameCommits.set(full, {
                hash: full,
                isZeroCommit: /^0+$/.test(full),
                summary: object?.message.split("\n")[0] ?? "",
                author: {
                    name: object?.author.name ?? line.name,
                    email: object?.author.email ?? line.email,
                    epochSeconds: object?.author.epochSeconds ?? 0,
                    tz: object?.author.tz ?? "+0000",
                },
                committer: object
                    ? {
                          name: object.committer.name,
                          email: object.committer.email,
                          epochSeconds: object.committer.epochSeconds,
                          tz: object.committer.tz,
                      }
                    : undefined,
            });
        }
        hashPerLine.push(full);
        originalFileLineNrPerLine.push(line.line);
        finalFileLineNrPerLine.push(line.line);
        if (previousHash !== undefined && previousHash !== full) {
            groupSizePerStartingLine.set(groupStart, groupSize);
            groupStart = line.line;
            groupSize = 0;
        }
        groupSize += 1;
        previousHash = full;
    }
    if (previousHash !== undefined) {
        groupSizePerStartingLine.set(groupStart, groupSize);
    }
    return {
        commits: blameCommits,
        hashPerLine,
        originalFileLineNrPerLine,
        finalFileLineNrPerLine,
        groupSizePerStartingLine,
    };
}

/** Extracts the `+++ b/<path>` target from a unified diff. */
export function extractPatchPath(patch: string): string | undefined {
    const match = patch.match(/^\+\+\+ b\/(.+)$/m);
    return match?.[1];
}

/**
 * Applies a unified diff to `source`. The hunks produced by
 * {@link import("../../editor/signs/hunks").Hunks.createPatch} contain only
 * added/removed lines (no context), which this handles by splicing at the
 * 1-based old-file start.
 */
export function applyUnifiedPatch(source: string, patch: string): string {
    const endsWithNewline = source.endsWith("\n");
    const lines = source.split("\n");
    if (endsWithNewline && lines[lines.length - 1] === "") {
        lines.pop();
    }

    const patchLines = patch.split("\n");
    let offset = 0;
    let index = 0;
    while (index < patchLines.length) {
        const header = patchLines[index]!.match(
            /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
        );
        if (!header) {
            index += 1;
            continue;
        }
        const oldStart = parseInt(header[1]!);
        const oldCount = header[2] != undefined ? parseInt(header[2]) : 1;
        index += 1;
        const replacement: string[] = [];
        while (index < patchLines.length) {
            const line = patchLines[index]!;
            if (line.startsWith("@@")) break;
            if (
                line.startsWith("diff ") ||
                line.startsWith("index ") ||
                line.startsWith("---") ||
                line.startsWith("+++")
            ) {
                index += 1;
                continue;
            }
            if (line.startsWith("+")) {
                replacement.push(line.slice(1));
                index += 1;
                continue;
            }
            if (line.startsWith("-") || line.startsWith(" ")) {
                index += 1;
                continue;
            }
            if (line === "\\ No newline at end of file") {
                index += 1;
                continue;
            }
            break;
        }
        const startIdx = Math.max(0, oldStart - 1 + offset);
        lines.splice(startIdx, oldCount, ...replacement);
        offset += replacement.length - oldCount;
    }
    return lines.join("\n") + (endsWithNewline ? "\n" : "");
}

function firstNonNull(...values: (string | undefined)[]): string | undefined {
    for (const value of values) {
        if (value != undefined && value !== "NULL") return value;
    }
    return undefined;
}
