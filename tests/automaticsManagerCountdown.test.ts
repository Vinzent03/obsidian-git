import { afterEach, describe, expect, it, vi } from "vitest";
import AutomaticsManager from "../src/automaticsManager";
import { PromiseQueue } from "../src/promiseQueue";
import { createFakePlugin } from "./helpers/createFakePlugin";

function createManager(settings: Record<string, unknown> = {}) {
    const plugin = createFakePlugin();
    const commitAndSync = vi.fn(() => Promise.resolve());
    Object.assign(plugin, {
        gitReady: true,
        settings: {
            autoSaveInterval: 2,
            autoBackupAfterFileChange: false,
            setLastSaveToLastCommit: false,
            differentIntervalCommitAndPush: false,
            autoPushInterval: 0,
            autoPullInterval: 0,
            ...settings,
        },
        localStorage: {
            getPausedAutomatics: () => false,
            getLastAutoBackup: () => undefined,
            setLastAutoBackup: vi.fn(),
            getLastAutoPull: () => undefined,
            getLastAutoPush: () => undefined,
        },
        promiseQueue: new PromiseQueue(),
        gitActions: { commitAndSync },
    });
    return {
        manager: new AutomaticsManager(plugin),
        commitAndSync,
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe("AutomaticsManager auto commit countdown", () => {
    it("tracks the remaining time and clears it on unload", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        const { manager, commitAndSync } = createManager();

        await manager.init();
        expect(manager.getAutoCommitCountdownMilliseconds()).toBe(120_000);

        vi.advanceTimersByTime(30_000);
        expect(manager.getAutoCommitCountdownMilliseconds()).toBe(90_000);

        manager.unload();
        expect(manager.getAutoCommitCountdownMilliseconds()).toBeUndefined();

        vi.advanceTimersByTime(10 * 60_000);
        expect(commitAndSync).not.toHaveBeenCalled();
    });

    it("restarts the countdown when the timers are reinitialized", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        const { manager } = createManager();

        await manager.init();
        vi.advanceTimersByTime(30_000);
        expect(manager.getAutoCommitCountdownMilliseconds()).toBe(90_000);

        manager.unload();
        await manager.init();
        expect(manager.getAutoCommitCountdownMilliseconds()).toBe(120_000);

        manager.unload();
    });

    it("does not report a countdown for debounced auto commits", async () => {
        vi.useFakeTimers();
        const { manager } = createManager({ autoBackupAfterFileChange: true });

        await manager.init();
        expect(manager.getAutoCommitCountdownMilliseconds()).toBeUndefined();

        manager.unload();
    });

    it("reschedules the countdown after an auto commit finishes", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        const { manager, commitAndSync } = createManager();

        await manager.init();
        vi.advanceTimersByTime(120_000);
        expect(manager.getAutoCommitCountdownMilliseconds()).toBeUndefined();

        for (let i = 0; i < 10; i++) {
            await Promise.resolve();
        }

        expect(commitAndSync).toHaveBeenCalledTimes(1);
        expect(manager.getAutoCommitCountdownMilliseconds()).toBe(120_000);

        manager.unload();
    });
});
