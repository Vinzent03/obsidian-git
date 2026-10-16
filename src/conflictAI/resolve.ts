export interface ConflictBlock {
    ours: string;
    theirs: string;
}

/** `segments` are the texts around the blocks: `segments.length === blocks.length + 1`. */
export interface ParsedConflicts {
    segments: string[];
    blocks: ConflictBlock[];
}

export type Confidence = "high" | "medium" | "low";

export interface AiReply {
    resolved: string;
    confidence: Confidence;
    summary: string;
}

const START = /^<{7}( |$)/;
const BASE = /^\|{7}( |$)/;
const MIDDLE = /^={7}\s*$/;
const END = /^>{7}( |$)/;
const MAX_BLOCKS_UNFLAGGED = 5;

/** Splits a file with conflict markers into plain text and conflict blocks. */
export function parseConflicts(text: string): ParsedConflicts | null {
    const segments = [""];
    const blocks: ConflictBlock[] = [];
    let state: "text" | "ours" | "base" | "theirs" = "text";
    let ours = "";
    let theirs = "";
    for (const line of text.split(/(?<=\n)/)) {
        if (state === "text") {
            if (START.test(line)) {
                state = "ours";
                ours = "";
                theirs = "";
            } else {
                segments[segments.length - 1] += line;
            }
        } else if (BASE.test(line) && state === "ours") {
            state = "base";
        } else if (MIDDLE.test(line) && state !== "theirs") {
            state = "theirs";
        } else if (END.test(line) && state === "theirs") {
            blocks.push({ ours, theirs });
            segments.push("");
            state = "text";
        } else if (state === "ours") {
            ours += line;
        } else if (state === "theirs") {
            theirs += line;
        }
    }
    return state === "text" && blocks.length > 0 ? { segments, blocks } : null;
}

function markerCount(text: string): number {
    return text
        .split("\n")
        .filter((l) => START.test(l) || MIDDLE.test(l) || END.test(l)).length;
}

/**
 * The text outside the conflict blocks must survive untouched and in order,
 * and no new conflict markers may appear.
 */
export function isValidResolution(
    parsed: ParsedConflicts,
    resolved: string
): boolean {
    if (markerCount(resolved) > markerCount(parsed.segments.join(""))) {
        return false;
    }
    const { segments } = parsed;
    const first = segments[0]!;
    const last = segments[segments.length - 1]!;
    if (!resolved.startsWith(first)) return false;
    let pos = first.length;
    for (const segment of segments.slice(1, -1)) {
        if (segment === "") continue;
        const at = resolved.indexOf(segment, pos);
        if (at < 0) return false;
        pos = at + segment.length;
    }
    return resolved.length - last.length >= pos && resolved.endsWith(last);
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/** Both sides differ only in whitespace, so no model is needed. */
export function resolveTrivial(parsed: ParsedConflicts): string | null {
    if (parsed.blocks.some((b) => normalize(b.ours) !== normalize(b.theirs))) {
        return null;
    }
    return parsed.segments.reduce(
        (out, segment, i) =>
            out + (parsed.blocks[i - 1]?.theirs ?? "") + segment
    );
}

const TOKENS: Record<string, RegExp> = {
    "numbers or dates": /\d[\d.,:/-]*/g,
    URLs: /https?:\/\/\S+/g,
    wikilinks: /\[\[[^\]]+\]\]/g,
    "code blocks": /^```.*$/gm,
    "table rows": /^\|.*\|\s*$/gm,
    headings: /^#{1,6} .*$/gm,
};

function differs(a: string, b: string, re: RegExp): boolean {
    const x = new Set(a.match(re) ?? []);
    const y = new Set(b.match(re) ?? []);
    return [...x].some((t) => !y.has(t)) || [...y].some((t) => !x.has(t));
}

const lineSet = (s: string) =>
    new Set(
        s
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
    );

/** Reasons the user should review a resolution; empty means a routine merge. */
export function reviewFlags(
    parsed: ParsedConflicts,
    reply: Pick<AiReply, "resolved" | "confidence">
): string[] {
    const flags: string[] = [];
    const { blocks, segments } = parsed;
    if (blocks.length > MAX_BLOCKS_UNFLAGGED) {
        flags.push(`${blocks.length} conflicting sections`);
    }
    if (
        segments[0]!.startsWith("---") &&
        !/\n---[ \t]*\n/.test(segments[0]!.slice(3))
    ) {
        flags.push("conflict in the note's properties (frontmatter)");
    }
    for (const [kind, re] of Object.entries(TOKENS)) {
        if (
            blocks.some(
                (b) =>
                    normalize(b.ours) !== normalize(b.theirs) &&
                    b.ours.trim() &&
                    b.theirs.trim() &&
                    differs(b.ours, b.theirs, re)
            )
        ) {
            flags.push(`both sides changed ${kind}`);
        }
    }
    const input = lineSet(blocks.map((b) => b.ours + b.theirs).join(""));
    const output = lineSet(reply.resolved);
    const dropped = [...input].filter((l) => !output.has(l)).length;
    if (dropped >= 5 && dropped > input.size / 2) {
        flags.push(`dropped ${dropped} of ${input.size} conflicting lines`);
    }
    if (reply.confidence !== "high") {
        flags.push(`model confidence: ${reply.confidence}`);
    }
    return flags;
}

export const SYSTEM_PROMPT = `You resolve git merge conflicts in a user's Obsidian notes vault.
Rules:
- Keep the intent of both sides. When the edits do not contradict, keep both.
- When they contradict, prefer the side that looks newer or more complete.
- Never invent content. Never change text outside the conflict markers.
- Remove every conflict marker.
Reply in exactly this format and nothing else:
<summary>one short sentence on what you decided</summary>
<confidence>high, medium or low</confidence>
<resolved>
the complete resolved file
</resolved>
Put the file between <resolved> and </resolved> on their own lines. Use "high" only when the resolution is routine and cannot lose meaningful content.`;

export function buildPrompt(path: string, text: string): string {
    return `File: ${path}\n\n${text}`;
}

export function parseReply(reply: string): AiReply | null {
    const resolved = /<resolved>\n([\s\S]*)\n<\/resolved>/.exec(reply)?.[1];
    if (resolved === undefined) return null;
    const confidence = /<confidence>\s*(\w+)/.exec(reply)?.[1];
    return {
        resolved,
        confidence:
            confidence === "high" || confidence === "medium"
                ? confidence
                : "low",
        summary:
            /<summary>([\s\S]*?)<\/summary>/.exec(reply)?.[1]?.trim() ?? "",
    };
}
