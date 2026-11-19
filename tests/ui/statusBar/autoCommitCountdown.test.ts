import { afterEach, describe, expect, it, vi } from "vitest";
import type ObsidianGit from "../../../src/main";
import {
    AutoCommitCountdownBar,
    formatAutoCommitCountdown,
} from "../../../src/ui/statusBar/autoCommitCountdown";

class FakeStatusBarElement {
    text = "";
    ariaLabel = "";
    addClass = vi.fn();
    setAttribute = vi.fn();
    setText = vi.fn((text: string) => {
        this.text = text;
    });
    empty = vi.fn(() => {
        this.text = "";
    });
    remove = vi.fn();
}

function createPlugin(getRemaining: () => number | undefined) {
    const getAutoCommitCountdownMilliseconds = vi.fn(getRemaining);
    const plugin = {
        automaticsManager: { getAutoCommitCountdownMilliseconds },
    } as unknown as ObsidianGit;
    return { plugin, getAutoCommitCountdownMilliseconds };
}

afterEach(() => {
    vi.useRealTimers();
});

describe("formatAutoCommitCountdown", () => {
    it("formats remaining milliseconds as mm:ss", () => {
        expect(formatAutoCommitCountdown(0)).toBe("00:00");
        expect(formatAutoCommitCountdown(999)).toBe("00:01");
        expect(formatAutoCommitCountdown(60_000)).toBe("01:00");
        expect(formatAutoCommitCountdown(3_599_000)).toBe("59:59");
        expect(formatAutoCommitCountdown(3_600_000)).toBe("60:00");
    });

    it("clamps negative values to zero", () => {
        expect(formatAutoCommitCountdown(-1)).toBe("00:00");
    });
});

describe("AutoCommitCountdownBar", () => {
    it("updates once per second, avoids duplicate DOM writes, and clears its interval", () => {
        vi.useFakeTimers();
        const element = new FakeStatusBarElement();
        let remaining = 65_000;
        const { plugin, getAutoCommitCountdownMilliseconds } = createPlugin(
            () => remaining
        );

        const bar = new AutoCommitCountdownBar(
            element as unknown as HTMLElement,
            plugin
        );

        expect(element.text).toBe("Auto-commit: 01:05");
        expect(getAutoCommitCountdownMilliseconds).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(getAutoCommitCountdownMilliseconds).toHaveBeenCalledTimes(2);
        expect(element.setText).toHaveBeenCalledTimes(1);

        remaining = 64_000;
        vi.advanceTimersByTime(1000);
        expect(element.text).toBe("Auto-commit: 01:04");
        expect(element.setText).toHaveBeenCalledTimes(2);

        bar.remove();
        expect(element.remove).toHaveBeenCalledTimes(1);

        const callsAfterRemove =
            getAutoCommitCountdownMilliseconds.mock.calls.length;
        vi.advanceTimersByTime(5000);
        expect(getAutoCommitCountdownMilliseconds).toHaveBeenCalledTimes(
            callsAfterRemove
        );
    });

    it("clears the display when no auto commit is scheduled", () => {
        vi.useFakeTimers();
        const element = new FakeStatusBarElement();
        let remaining: number | undefined;
        const { plugin } = createPlugin(() => remaining);

        const bar = new AutoCommitCountdownBar(
            element as unknown as HTMLElement,
            plugin
        );
        expect(element.empty).toHaveBeenCalledTimes(1);

        remaining = 5000;
        vi.advanceTimersByTime(1000);
        expect(element.text).toBe("Auto-commit: 00:05");

        remaining = undefined;
        vi.advanceTimersByTime(1000);
        expect(element.text).toBe("");
        expect(element.empty).toHaveBeenCalledTimes(2);

        bar.remove();
    });
});
