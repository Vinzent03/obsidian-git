import type ObsidianGit from "../main";
import { ClaudeError, complete } from "./claude";
import {
    SYSTEM_PROMPT,
    buildPrompt,
    isValidResolution,
    parseConflicts,
    parseReply,
    resolveTrivial,
    reviewFlags,
} from "./resolve";

interface Resolution {
    path: string;
    text: string;
    summary: string;
    flags: string[];
}

class Unresolvable extends Error {}

async function resolveFile(
    plugin: ObsidianGit,
    apiKey: string,
    path: string
): Promise<Resolution> {
    const { settings } = plugin;
    const text = await plugin.app.vault.adapter.read(path);
    const parsed = parseConflicts(text);
    if (!parsed) throw new Unresolvable(`${path}: no conflict markers`);

    const trivial = resolveTrivial(parsed);
    if (trivial !== null) {
        return { path, text: trivial, summary: "whitespace only", flags: [] };
    }
    if (text.length > settings.aiConflictMaxFileKb * 1024) {
        throw new Unresolvable(`${path}: larger than the AI size limit`);
    }
    const reply = parseReply(
        await complete(
            apiKey,
            settings.aiConflictModel,
            SYSTEM_PROMPT,
            buildPrompt(path, text),
            Math.min(32000, Math.ceil(text.length / 2) + 2000)
        )
    );
    if (!reply) throw new Unresolvable(`${path}: unreadable AI reply`);
    let resolved = reply.resolved;
    if (text.endsWith("\n") && !resolved.endsWith("\n")) resolved += "\n";
    if (!isValidResolution(parsed, resolved)) {
        throw new Unresolvable(`${path}: AI result failed validation`);
    }
    return {
        path,
        text: resolved,
        summary: reply.summary,
        flags: reviewFlags(parsed, { ...reply, resolved }),
    };
}

/**
 * Resolves the conflicts of an in-progress merge with Claude, commits the
 * merge and returns the number of files resolved. All-or-nothing: on any
 * failure nothing is written and the conflict is left for the user.
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

    const status = await gitManager.status();
    if (
        status.conflicted.length === 0 ||
        status.conflictedOutsideVault > 0 ||
        !(await gitManager.isMergeInProgress())
    ) {
        return null;
    }

    const resolutions: Resolution[] = [];
    try {
        for (const file of status.conflicted) {
            resolutions.push(
                await resolveFile(
                    plugin,
                    apiKey,
                    gitManager.getRelativeVaultPath(file)
                )
            );
        }
    } catch (error) {
        await reportFailure(plugin, error);
        return null;
    }

    for (const r of resolutions) {
        await plugin.app.vault.adapter.write(r.path, r.text);
        await gitManager.stage(r.path, true);
    }
    await gitManager.commit({
        message: `Resolve ${resolutions.length} merge conflict${
            resolutions.length === 1 ? "" : "s"
        } with AI`,
    });

    const lines = resolutions.map(
        (r) =>
            `• ${r.path}: ${r.summary}` +
            (r.flags.length ? `\n  ⚠️ review: ${r.flags.join("; ")}` : "")
    );
    plugin.displayMessage(
        `AI resolved ${resolutions.length} conflict${
            resolutions.length === 1 ? "" : "s"
        }:\n${lines.join("\n")}`,
        resolutions.some((r) => r.flags.length) ? 20 * 1000 : 8 * 1000
    );
    return resolutions.length;
}

async function reportFailure(
    plugin: ObsidianGit,
    error: unknown
): Promise<void> {
    if (error instanceof ClaudeError) {
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
                `AI conflict resolution failed (${error.kind}). Resolve conflicts manually.`
            );
        }
    } else if (error instanceof Unresolvable) {
        plugin.displayError(
            `AI conflict resolution skipped, ${error.message}. Resolve conflicts manually.`
        );
    } else {
        throw error;
    }
}
