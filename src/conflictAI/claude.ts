import { requestUrl } from "obsidian";

export type ClaudeFailure = "auth" | "credit" | "rate" | "offline" | "other";

export class ClaudeError extends Error {
    constructor(
        readonly kind: ClaudeFailure,
        message: string
    ) {
        super(message);
        this.name = "ClaudeError";
    }
}

export const DEFAULT_MODEL = "claude-sonnet-5-5";

const RETRY_DELAYS_MS = [2000, 5000];

function classify(status: number, body: string): ClaudeFailure {
    if (status === 401 || status === 403) return "auth";
    if (status === 402 || /credit|quota|billing/i.test(body)) return "credit";
    if (status === 429) return "rate";
    return "other";
}

async function attempt(
    apiKey: string,
    model: string,
    system: string,
    prompt: string,
    maxTokens: number
): Promise<string> {
    let response;
    try {
        response = await requestUrl({
            url: "https://api.anthropic.com/v1/messages",
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                system,
                messages: [{ role: "user", content: prompt }],
            }),
            throw: false,
        });
    } catch (error) {
        throw new ClaudeError("offline", String(error));
    }
    if (response.status !== 200) {
        throw new ClaudeError(
            classify(response.status, response.text),
            `Anthropic API ${response.status}: ${response.text.slice(0, 200)}`
        );
    }
    const json = response.json as {
        stop_reason?: string;
        content?: { type: string; text?: string }[];
    };
    if (json.stop_reason === "max_tokens") {
        throw new ClaudeError("other", "Reply was cut off (file too large)");
    }
    return (json.content ?? []).map((c) => c.text ?? "").join("");
}

/** Calls the Claude Messages API, retrying only transient rate limits. */
export async function complete(
    apiKey: string,
    model: string,
    system: string,
    prompt: string,
    maxTokens: number
): Promise<string> {
    for (let i = 0; ; i++) {
        try {
            return await attempt(apiKey, model, system, prompt, maxTokens);
        } catch (error) {
            const delay = RETRY_DELAYS_MS[i];
            if (
                error instanceof ClaudeError &&
                error.kind === "rate" &&
                delay !== undefined
            ) {
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
}

/** Used by the settings "Test connection" button. */
export async function testConnection(
    apiKey: string,
    model: string
): Promise<void> {
    await complete(apiKey, model, "Reply with ok.", "ping", 8);
}
