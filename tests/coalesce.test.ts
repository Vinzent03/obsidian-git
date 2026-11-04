import { describe, expect, it } from "vitest";
import { coalesce } from "../src/coalesce";

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("coalesce", () => {
    it("coalesces calls during a run into a single follow-up run", async () => {
        const runs = [deferred(), deferred()];
        let calls = 0;
        const run = coalesce(() => runs[calls++]!.promise);

        const first = run();
        const second = run();
        const third = run();

        expect(calls).toBe(1);
        expect(third).toBe(second);

        runs[0]!.resolve();
        await first;
        await Promise.resolve();
        expect(calls).toBe(2);

        runs[1]!.resolve();
        await second;
        expect(calls).toBe(2);
    });

    it("starts a new run once the previous runs have finished", async () => {
        let calls = 0;
        const run = coalesce(() => {
            calls++;
            return Promise.resolve();
        });

        await run();
        await run();

        expect(calls).toBe(2);
    });

    it("runs the follow-up even if the active run fails", async () => {
        const runs = [deferred(), deferred()];
        let calls = 0;
        const run = coalesce(() => runs[calls++]!.promise);

        const first = run();
        const second = run();

        runs[0]!.reject(new Error("failed"));
        await expect(first).rejects.toThrow("failed");
        runs[1]!.resolve();
        await second;

        expect(calls).toBe(2);
    });
});
