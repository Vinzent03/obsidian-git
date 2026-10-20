import { SimpleGit } from "../gitManager/simpleGit";
import type ObsidianGit from "../main";
import { ClaudeError, complete } from "./claude";
import {
    MOVE_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    buildBlockPrompt,
    buildMovePrompt,
    buildPrompt,
    hasMarkers,
    isValidResolution,
    parseConflicts,
    parseReply,
    resolveTrivial,
    reviewFlags,
    coverage,
    type AiReply,
    type Confidence,
} from "./resolve";

/** Larger files are resolved one conflict at a time instead of whole. */
const WHOLE_FILE_LIMIT = 60 * 1024;
/** Share of the original's lines a new file must contain to count as its moved copy. */
const MOVE_COVERAGE = 0.4;
const MAX_ROUNDS = 50;
const CONFIDENCE_ORDER: Confidence[] = ["low", "medium", "high"];

type Action =
    | { kind: "write"; path: string; text: string }
    | { kind: "remove"; path: string }
    | { kind: "keep"; path: string };

interface Resolution {
    path: string;
    summary: string;
    flags: string[];
    actions: Action[];
}

/** This file can't be resolved; the others still can. */
class Unresolvable extends Error {}

interface Context {
    plugin: ObsidianGit;
    apiKey: string;
}

async function ask(
    { plugin, apiKey }: Context,
    system: string,
    prompt: string,
    outputChars: number
): Promise<AiReply> {
    const reply = parseReply(
        await complete(
            apiKey,
            plugin.settings.aiConflictModel,
            system,
            prompt,
            Math.min(32000, Math.ceil(outputChars / 2) + 2000)
        )
    );
    if (!reply) throw new Unresolvable("unreadable AI reply");
    return reply;
}

const endNewline = (resolved: string, like: string) =>
    like.endsWith("\n") && !resolved.endsWith("\n")
        ? resolved + "\n"
        : resolved;

async function resolveMarkers(ctx: Context, path: string): Promise<Resolution> {
    const text = await ctx.plugin.app.vault.adapter.read(path);
    const parsed = parseConflicts(text);
    if (!parsed) throw new Unresolvable("no conflict markers to resolve");
    const done = (
        resolved: string,
        summary: string,
        flags: string[]
    ): Resolution => ({
        path,
        summary,
        flags,
        actions: [{ kind: "write", path, text: resolved }],
    });

    const trivial = resolveTrivial(parsed);
    if (trivial !== null) return done(trivial, "whitespace only", []);

    if (text.length <= WHOLE_FILE_LIMIT) {
        const reply = await ask(
            ctx,
            SYSTEM_PROMPT,
            buildPrompt(path, text),
            text.length
        );
        const resolved = endNewline(reply.resolved, text);
        if (!isValidResolution(parsed, resolved)) {
            throw new Unresolvable("AI result failed validation");
        }
        return done(
            resolved,
            reply.summary,
            reviewFlags(parsed, { ...reply, resolved })
        );
    }

    let out = parsed.segments[0]!;
    let blocksOut = "";
    let confidence: Confidence = "high";
    for (const [i, block] of parsed.blocks.entries()) {
        const reply = await ask(
            ctx,
            SYSTEM_PROMPT,
            buildBlockPrompt(
                path,
                parsed.segments[i]!,
                block,
                parsed.segments[i + 1]!
            ),
            block.ours.length + block.theirs.length
        );
        const resolved = endNewline(reply.resolved, block.ours + block.theirs);
        if (hasMarkers(resolved)) {
            throw new Unresolvable("AI result failed validation");
        }
        if (
            CONFIDENCE_ORDER.indexOf(reply.confidence) <
            CONFIDENCE_ORDER.indexOf(confidence)
        ) {
            confidence = reply.confidence;
        }
        blocksOut += resolved;
        out += resolved + parsed.segments[i + 1]!;
    }
    return done(
        out,
        `resolved ${parsed.blocks.length} sections one by one (large file)`,
        reviewFlags(parsed, { resolved: blocksOut, confidence })
    );
}

/** A file one side deleted or moved while the other side edited it. */
async function resolveDeleted(
    ctx: Context,
    path: string,
    added: { vaultPath: string }[]
): Promise<Resolution> {
    const { plugin } = ctx;
    const show = (stage: number) =>
        plugin.gitManager.show(`:${stage}`, path, true).catch(() => null);
    const [base, ours, theirs] = [await show(1), await show(2), await show(3)];
    if (base === null || (ours === null) === (theirs === null)) {
        throw new Unresolvable("unsupported kind of conflict");
    }
    const edited = ours ?? theirs!;
    if (edited === base) {
        return {
            path,
            summary: "accepted the deletion (the other side did not edit it)",
            flags: [],
            actions: [{ kind: "remove", path }],
        };
    }

    let best: { vaultPath: string; text: string; score: number } | undefined;
    for (const { vaultPath } of added) {
        const text = await plugin.app.vault.adapter.read(vaultPath);
        const score = coverage(base, text);
        if (score >= MOVE_COVERAGE && score > (best?.score ?? 0)) {
            best = { vaultPath, text, score };
        }
    }
    if (!best) {
        return {
            path,
            summary: "kept your edited file, which the other side deleted",
            flags: ["kept a file the other side deleted"],
            actions: [{ kind: "keep", path }],
        };
    }
    const reply = await ask(
        ctx,
        MOVE_SYSTEM_PROMPT,
        buildMovePrompt(path, best.vaultPath, base, edited, best.text),
        best.text.length + edited.length
    );
    if (!reply.resolved.trim() || hasMarkers(reply.resolved)) {
        throw new Unresolvable("AI result failed validation");
    }
    return {
        path,
        summary: `${reply.summary} (moved to ${best.vaultPath})`,
        flags: [
            `edits merged into the moved file ${best.vaultPath}`,
            ...(reply.confidence === "high"
                ? []
                : [`model confidence: ${reply.confidence}`]),
        ],
        actions: [
            {
                kind: "write",
                path: best.vaultPath,
                text: endNewline(reply.resolved, best.text),
            },
            { kind: "remove", path },
        ],
    };
}

async function apply(plugin: ObsidianGit, resolution: Resolution) {
    const { adapter } = plugin.app.vault;
    for (const action of resolution.actions) {
        if (action.kind === "write") {
            await adapter.write(action.path, action.text);
        } else if (action.kind === "remove") {
            if (await adapter.exists(action.path)) {
                await adapter.remove(action.path);
            }
        }
        await plugin.gitManager.stage(action.path, true);
    }
}

type Mode = "merge" | "rebase";

async function inProgress(plugin: ObsidianGit): Promise<Mode | null> {
    const { gitManager } = plugin;
    if (await gitManager.isMergeInProgress()) return "merge";
    if (gitManager instanceof SimpleGit) {
        try {
            await gitManager.rawCommand("rebase --show-current-patch");
            return "rebase";
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Resolves the conflicts of an in-progress merge or rebase with Claude, file by
 * file. Files that can't be resolved are left for the user. Returns the number
 * of files resolved once the merge or rebase is finished, otherwise null.
 */
export async function resolveConflictsWithAi(
    plugin: ObsidianGit
): Promise<number | null> {
    const { settings, gitManager } = plugin;
    if (!settings.aiConflictResolution) return null;

    const apiKey = settings.aiConflictApiKeySecret
        ? plugin.app.secretStorage.getSecret(settings.aiConflictApiKeySecret)
        : null;
    if (!apiKey) {
        plugin.displayError(
            "AI conflict resolution: no API key set (Settings → Git)."
        );
        return null;
    }
    const mode = await inProgress(plugin);
    if (!mode) return null;

    const ctx: Context = { plugin, apiKey };
    const resolved: Resolution[] = [];
    const failed: string[] = [];
    let finished = false;

    for (let round = 0; round < MAX_ROUNDS && !finished; round++) {
        const status = await gitManager.status();
        if (status.conflicted.length === 0) break;
        if (status.conflictedOutsideVault > 0) {
            failed.push("files outside the vault");
        }
        const added = status.staged.filter(
            (f) => f.index === "A" || f.index === "R"
        );

        let fatal = false;
        for (const file of status.conflicted) {
            const path = gitManager.getRelativeVaultPath(file);
            try {
                const exists = await plugin.app.vault.adapter.exists(path);
                const text = exists
                    ? await plugin.app.vault.adapter.read(path)
                    : "";
                const resolution =
                    exists && parseConflicts(text)
                        ? await resolveMarkers(ctx, path)
                        : await resolveDeleted(ctx, path, added);
                await apply(plugin, resolution);
                resolved.push(resolution);
            } catch (error) {
                if (error instanceof Unresolvable) {
                    failed.push(`${path} (${error.message})`);
                } else if (
                    error instanceof ClaudeError &&
                    error.kind === "other"
                ) {
                    plugin.log("AI conflict resolution failed:", error);
                    failed.push(`${path} (${error.message})`);
                } else {
                    fatal = true;
                    failed.push(path);
                    await reportFailure(plugin, error);
                    break;
                }
            }
        }
        if (fatal || failed.length > 0) break;

        if (mode === "merge") {
            await gitManager.commit({
                message: `Resolve merge conflicts with AI (${resolved.length} files)`,
            });
            finished = true;
        } else if (gitManager instanceof SimpleGit) {
            try {
                await gitManager.rawCommand(
                    "-c core.editor=true rebase --continue"
                );
            } catch (error) {
                plugin.log("rebase --continue:", error);
            }
            finished = (await inProgress(plugin)) === null;
        }
    }

    report(plugin, resolved, failed);
    return finished ? resolved.length : null;
}

function report(plugin: ObsidianGit, resolved: Resolution[], failed: string[]) {
    if (resolved.length === 0 && failed.length === 0) return;
    const lines = [
        ...resolved.map(
            (r) =>
                `• ${r.path}: ${r.summary}` +
                (r.flags.length ? `\n  ⚠️ review: ${r.flags.join("; ")}` : "")
        ),
        ...failed.map((f) => `✋ needs you: ${f}`),
    ];
    if (resolved.length > 0) {
        plugin.displayMessage(
            `AI resolved ${resolved.length} conflicted file${
                resolved.length === 1 ? "" : "s"
            }:\n${lines.join("\n")}`,
            resolved.some((r) => r.flags.length) || failed.length > 0
                ? 20 * 1000
                : 8 * 1000
        );
    } else {
        plugin.displayError(
            `AI conflict resolution could not resolve:\n${lines.join("\n")}`
        );
    }
}

async function reportFailure(
    plugin: ObsidianGit,
    error: unknown
): Promise<void> {
    if (!(error instanceof ClaudeError)) throw error;
    plugin.log("AI conflict resolution failed:", error);
    // Retrying on every sync would only repeat the failure or burn credit.
    if (error.kind === "auth" || error.kind === "credit") {
        plugin.settings.aiConflictResolution = false;
        await plugin.saveSettings();
        plugin.displayError(
            error.kind === "credit"
                ? "AI conflict resolution: out of Anthropic credit. Turned off; add credit and re-enable it."
                : "AI conflict resolution: API key rejected. Turned off; fix the key and re-enable it."
        );
    } else {
        plugin.displayError(
            `AI conflict resolution stopped (${error.kind}). Resolve the rest manually.`
        );
    }
}
