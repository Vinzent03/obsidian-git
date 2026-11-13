import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, platform } from "../../helpers/fakeObsidianModal";
import {
    buildCommitMessage,
    CustomMessageModal,
    shouldSubmitOnEnter,
} from "src/ui/modals/customMessageModal";

vi.mock("obsidian", async () => {
    const { FakeModal, platform: mockPlatform } =
        await import("../../helpers/fakeObsidianModal");
    return {
        moment: () => ({
            format: () => "2026-11-13 09:30:00",
        }),
        Modal: FakeModal,
        Platform: mockPlatform,
    };
});

function createPlugin() {
    return {
        app: {},
        settings: { commitDateFormat: "YYYY-MM-DD HH:mm:ss" },
    } as unknown as ConstructorParameters<typeof CustomMessageModal>[0];
}

function openModal() {
    const modal = new CustomMessageModal(createPlugin());
    const result = modal.openAndGetResult();
    const content = (modal as unknown as { contentEl: FakeElement }).contentEl;
    const textarea = content.find("textarea");
    if (!textarea) throw new Error("textarea not found");
    return { content, modal, result, textarea };
}

function findButton(content: FakeElement, text: string): FakeElement {
    const button = content.findByText("button", text);
    if (!button) throw new Error(`button "${text}" not found`);
    return button;
}

function enterKey(
    options: Partial<Pick<KeyboardEvent, "shiftKey" | "isComposing">> = {}
) {
    return {
        key: "Enter",
        shiftKey: false,
        isComposing: false,
        ...options,
        preventDefault: vi.fn(),
    };
}

async function isPending(promise: Promise<unknown>): Promise<boolean> {
    let settled = false;
    void promise.then(
        () => {
            settled = true;
        },
        () => {
            settled = true;
        }
    );
    await Promise.resolve();
    await Promise.resolve();
    return !settled;
}

beforeEach(() => {
    platform.isMobile = false;
});

describe("buildCommitMessage", () => {
    it("keeps a multiline message unchanged without a date", () => {
        const message = "Subject\n\nBody line one\nBody line two";
        expect(buildCommitMessage(message, "2026-11-13 09:30:00", "none")).toBe(
            message
        );
    });

    it("adds the date before or after the message", () => {
        const message = "Subject\n\nBody";
        expect(
            buildCommitMessage(message, "2026-11-13 09:30:00", "prefix")
        ).toBe("2026-11-13 09:30:00: Subject\n\nBody");
        expect(
            buildCommitMessage(message, "2026-11-13 09:30:00", "suffix")
        ).toBe("Subject\n\nBody: 2026-11-13 09:30:00");
    });

    it("does not add a date to an empty message", () => {
        expect(buildCommitMessage("  ", "2026-11-13 09:30:00", "prefix")).toBe(
            "  "
        );
    });
});

describe("shouldSubmitOnEnter", () => {
    it("submits on Enter without Shift on desktop", () => {
        expect(shouldSubmitOnEnter(enterKey(), false)).toBe(true);
    });

    it("does not submit on Shift+Enter", () => {
        expect(shouldSubmitOnEnter(enterKey({ shiftKey: true }), false)).toBe(
            false
        );
    });

    it("does not submit while the input method is composing", () => {
        expect(
            shouldSubmitOnEnter(enterKey({ isComposing: true }), false)
        ).toBe(false);
    });

    it("does not submit on Enter on mobile", () => {
        expect(shouldSubmitOnEnter(enterKey(), true)).toBe(false);
    });
});

describe("CustomMessageModal", () => {
    it("returns a multiline message when Enter is pressed on desktop", async () => {
        const { result, textarea } = openModal();
        const message = "Subject\n\nBody line one\nBody line two";
        textarea.value = message;
        const event = enterKey();

        textarea.dispatch("keydown", event);

        expect(event.preventDefault).toHaveBeenCalledOnce();
        await expect(result).resolves.toBe(message);
    });

    it("keeps the modal open for Shift+Enter", async () => {
        const { modal, result, textarea } = openModal();
        textarea.value = "Subject";
        const event = enterKey({ shiftKey: true });

        textarea.dispatch("keydown", event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        await expect(isPending(result)).resolves.toBe(true);
        modal.close();
        await expect(result).resolves.toBeUndefined();
    });

    it("keeps Enter as a newline on mobile and commits with the button", async () => {
        platform.isMobile = true;
        const { content, result, textarea } = openModal();
        const message = "Subject\n\nBody";
        textarea.value = message;
        const event = enterKey();

        textarea.dispatch("keydown", event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        await expect(isPending(result)).resolves.toBe(true);

        findButton(content, "Commit").dispatch("click", {});
        await expect(result).resolves.toBe(message);
    });

    it("does not submit while an input method is composing", async () => {
        const { modal, result, textarea } = openModal();
        textarea.value = "Subject";
        const event = enterKey({ isComposing: true });

        textarea.dispatch("keydown", event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        await expect(isPending(result)).resolves.toBe(true);
        modal.close();
        await expect(result).resolves.toBeUndefined();
    });

    it("commits with the date prefixed or suffixed", async () => {
        const prefixed = openModal();
        prefixed.textarea.value = "Subject\n\nBody";
        findButton(prefixed.content, "Prefix date").dispatch("click", {});
        await expect(prefixed.result).resolves.toBe(
            "2026-11-13 09:30:00: Subject\n\nBody"
        );

        const suffixed = openModal();
        suffixed.textarea.value = "Subject\n\nBody";
        findButton(suffixed.content, "Suffix date").dispatch("click", {});
        await expect(suffixed.result).resolves.toBe(
            "Subject\n\nBody: 2026-11-13 09:30:00"
        );
    });

    it("resolves undefined when the modal is closed", async () => {
        const { content, result } = openModal();

        findButton(content, "Cancel").dispatch("click", {});

        await expect(result).resolves.toBeUndefined();
    });
});
