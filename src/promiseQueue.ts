export class PromiseQueue {
    private tasks: {
        task: () => Promise<unknown>;
        onFinished: (res: unknown) => void;
    }[] = [];
    private currentTask: Promise<unknown> | null = null;
    private idleWaiters: (() => void)[] = [];

    /**
     * Add a task to the queue.
     *
     * @param task The task to add.
     * @param onFinished A callback that is called when the task is finished. Both on success and on error.
     */
    addTask<T>(
        task: () => Promise<T>,
        onFinished?: (res: T | undefined) => void
    ): void {
        this.tasks.push({
            task,
            onFinished: (res: unknown) => {
                if (onFinished) {
                    onFinished(res as T | undefined);
                }
            },
        });
        this.kickstart();
    }

    /**
     * Resolves once no task is running or waiting. Awaiting it inside a task
     * never resolves, since that task keeps the queue busy.
     */
    whenIdle(): Promise<void> {
        if (this.currentTask === null && this.tasks.length === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => this.idleWaiters.push(resolve));
    }

    private kickstart(): void {
        if (this.currentTask !== null) {
            return;
        }
        if (this.tasks.length === 0) {
            const waiters = this.idleWaiters;
            this.idleWaiters = [];
            waiters.forEach((resolve) => resolve());
            return;
        }
        const item = this.tasks.shift()!;
        this.currentTask = Promise.resolve()
            .then(() => item.task())
            .then(
                (res) => {
                    try {
                        item.onFinished(res);
                    } catch (e) {
                        console.error(e);
                    }
                },
                (e) => {
                    console.error("Unhandled PromiseQueue task rejection", e);
                    try {
                        item.onFinished(undefined);
                    } catch (err) {
                        console.error(err);
                    }
                }
            )
            .finally(() => {
                this.currentTask = null;
                this.kickstart();
            });
    }

    clear(): void {
        this.tasks = [];
    }
}
