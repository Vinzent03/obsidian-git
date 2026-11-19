import { moment, Modal, Platform } from "obsidian";
import type ObsidianGit from "src/main";

export type CommitMessageDatePosition = "none" | "prefix" | "suffix";

export function buildCommitMessage(
    message: string,
    date: string,
    datePosition: CommitMessageDatePosition
): string {
    if (datePosition === "none" || message.trim() === "") return message;
    return datePosition === "prefix"
        ? `${date}: ${message}`
        : `${message}: ${date}`;
}

export function shouldSubmitOnEnter(
    event: Pick<
        KeyboardEvent,
        "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "isComposing"
    >,
    isMobile: boolean
): boolean {
    return (
        !isMobile &&
        event.key === "Enter" &&
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        !event.isComposing
    );
}

export class CustomMessageModal extends Modal {
    resolve:
        ((value: string | PromiseLike<string> | undefined) => void) | null =
        null;
    private textarea: HTMLTextAreaElement | null = null;

    constructor(private readonly plugin: ObsidianGit) {
        super(plugin.app);
    }

    openAndGetResult(): Promise<string | undefined> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText("Commit message");

        this.textarea = contentEl.createEl("textarea", {
            cls: "obsidian-git-commit-message-input",
            attr: {
                rows: "6",
                placeholder: "Type your commit message",
                "aria-label": "Commit message",
            },
        });
        this.textarea.addEventListener("keydown", (event) => {
            if (shouldSubmitOnEnter(event, Platform.isMobile)) {
                event.preventDefault();
                this.submit("none");
            }
        });
        this.textarea.focus();

        const buttons = contentEl.createDiv({ cls: "modal-button-container" });
        const commit = buttons.createEl("button", {
            cls: "mod-cta",
            text: "Commit",
            attr: Platform.isMobile
                ? {}
                : {
                      "aria-keyshortcuts": Platform.isMacOS
                          ? "Meta+Enter"
                          : "Control+Enter",
                  },
        });
        if (!Platform.isMobile) {
            commit.createEl("kbd", {
                text: Platform.isMacOS ? "⌘ ↵" : "Ctrl ↵",
                cls: "obsidian-git-commit-message-shortcut",
                attr: { "aria-hidden": "true" },
            });
        }
        commit.addEventListener("click", () => this.submit("none"));
        const prefix = buttons.createEl("button", {
            text: "Prefix date",
            attr: { "aria-label": "Commit with the date prefixed" },
        });
        prefix.addEventListener("click", () => this.submit("prefix"));
        const suffix = buttons.createEl("button", {
            text: "Suffix date",
            attr: { "aria-label": "Commit with the date suffixed" },
        });
        suffix.addEventListener("click", () => this.submit("suffix"));
        buttons
            .createEl("button", { text: "Cancel" })
            .addEventListener("click", () => this.close());
    }

    onClose() {
        const resolve = this.resolve;
        this.resolve = null;
        this.textarea = null;
        this.contentEl.empty();

        if (resolve) resolve(undefined);
    }

    private submit(datePosition: CommitMessageDatePosition): void {
        const message = buildCommitMessage(
            this.textarea?.value ?? "",
            moment().format(this.plugin.settings.commitDateFormat),
            datePosition
        );
        const resolve = this.resolve;
        this.resolve = null;
        this.close();
        resolve?.(message);
    }
}
