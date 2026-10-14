import { randomBytes, timingSafeEqual } from "node:crypto";
import {
    createServer,
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from "node:http";
import { Notice } from "obsidian";
import type ObsidianGit from "../main";
import { GeneralModal } from "../ui/modals/generalModal";

const MAX_REQUEST_SIZE = 16 * 1024;

/** Bridges Git's external askpass program to a modal in this Obsidian instance. */
export class AskpassServer {
    private readonly token = randomBytes(32).toString("hex");
    private server: Server | undefined;
    private responses = new Set<ServerResponse>();
    private promptQueue: Promise<void> = Promise.resolve();
    private activeModal: GeneralModal | undefined;
    private stopped = false;

    constructor(private readonly plugin: ObsidianGit) {}

    async start(): Promise<{ port: number; token: string }> {
        if (this.stopped || this.server) {
            throw new Error("Askpass server cannot be started again");
        }

        const server = createServer((request, response) => {
            void this.handleRequest(request, response).catch((error) => {
                this.plugin.displayError(error);
                this.respond(response, 500);
            });
        });
        server.requestTimeout = 10_000;
        this.server = server;

        try {
            await new Promise<void>((resolve, reject) => {
                server.once("error", reject);
                server.listen(0, "127.0.0.1", () => {
                    server.off("error", reject);
                    resolve();
                });
            });
        } catch (error) {
            this.stop();
            throw error;
        }

        const address = server.address();
        if (this.stopped || !address || typeof address === "string") {
            if (server.listening) server.close();
            this.stop();
            throw new Error("Askpass server stopped during startup");
        }
        server.on("error", (error) => {
            if (this.stopped) return;
            this.plugin.displayError(error);
            this.stop();
        });
        return { port: address.port, token: this.token };
    }

    stop(): void {
        if (this.stopped) return;
        this.stopped = true;
        this.activeModal?.close();
        for (const response of this.responses) {
            this.respond(response, 503);
        }
        if (this.server?.listening) this.server.close();
    }

    private async handleRequest(
        request: IncomingMessage,
        response: ServerResponse
    ): Promise<void> {
        this.responses.add(response);
        response.once("close", () => this.responses.delete(response));

        if (
            this.stopped ||
            request.method !== "POST" ||
            request.url !== "/askpass" ||
            request.headers.origin
        ) {
            this.respond(response, 403);
            return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
            const bytes = chunk as Buffer;
            size += bytes.length;
            if (size > MAX_REQUEST_SIZE) {
                this.respond(response, 413);
                return;
            }
            chunks.push(bytes);
        }

        const body = Buffer.concat(chunks).toString("utf8");
        const separator = body.indexOf("\n");
        const suppliedToken = body.slice(0, separator);
        if (
            separator < 0 ||
            !/^[0-9a-f]{64}$/.test(suppliedToken) ||
            !timingSafeEqual(
                Buffer.from(suppliedToken),
                Buffer.from(this.token)
            )
        ) {
            this.respond(response, 403);
            return;
        }

        const prompt = body.slice(separator + 1);
        const previousPrompt = this.promptQueue;
        let finishPrompt!: () => void;
        this.promptQueue = new Promise<void>((resolve) => {
            finishPrompt = resolve;
        });
        try {
            await previousPrompt;
            if (!this.stopped && !response.destroyed) {
                await this.showPrompt(prompt, response);
            }
        } finally {
            finishPrompt();
        }
    }

    private async showPrompt(
        prompt: string,
        response: ServerResponse
    ): Promise<void> {
        const notice = prompt.length > 60 ? new Notice(prompt, 999_999) : null;
        // Git does not pass the input type to askpass. Only its English
        // username prompt can be identified reliably enough to show text.
        const modal = new GeneralModal(this.plugin, {
            allowEmpty: true,
            obscure: !prompt.includes("Username for"),
            placeholder:
                prompt.length > 60
                    ? "Enter a response to the message."
                    : prompt,
        });
        this.activeModal = modal;
        const closeModal = () => {
            if (!response.writableEnded) modal.close();
        };
        response.once("close", closeModal);
        try {
            const answer = await modal.openAndGetResult();
            if (this.stopped || response.destroyed) return;
            if (answer === undefined) {
                this.respond(response, 409);
            } else {
                this.respond(response, 200, `${answer}\n`);
            }
        } finally {
            response.off("close", closeModal);
            notice?.hide();
            if (this.activeModal === modal) this.activeModal = undefined;
        }
    }

    private respond(response: ServerResponse, status: number, body = ""): void {
        if (response.destroyed || response.writableEnded) return;
        response.writeHead(status, {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
        });
        response.end(body);
    }
}
