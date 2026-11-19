import { describe, expect, it, vi } from "vitest";
import { PromiseQueue } from "../src/promiseQueue";

describe("PromiseQueue", () => {
    it("logs escaped rejections and continues with the next task", async () => {
        const error = new Error("unexpected rejection");
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const nextTask = vi.fn().mockResolvedValue(undefined);
        const completed = new Promise<void>((resolve) => {
            const queue = new PromiseQueue();
            queue.addTask(() => Promise.reject(error));
            queue.addTask(nextTask, () => resolve());
        });

        await completed;

        expect(consoleError).toHaveBeenCalledWith(
            "Unhandled PromiseQueue task rejection",
            error
        );
        expect(nextTask).toHaveBeenCalledOnce();
    });

    it("resolves whenIdle immediately when nothing is queued", async () => {
        await expect(new PromiseQueue().whenIdle()).resolves.toBeUndefined();
    });

    it("resolves whenIdle after the running and the waiting tasks", async () => {
        const queue = new PromiseQueue();
        const order: string[] = [];
        let finishFirst!: () => void;
        queue.addTask(
            () =>
                new Promise<void>((resolve) => {
                    finishFirst = resolve;
                })
        );
        queue.addTask(() => {
            order.push("second");
            return Promise.resolve();
        });

        const idle = queue.whenIdle().then(() => order.push("idle"));
        await Promise.resolve();
        expect(order).toEqual([]);

        finishFirst();
        await idle;
        expect(order).toEqual(["second", "idle"]);
    });
});
