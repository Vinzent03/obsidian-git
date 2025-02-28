import type ObsidianGit from "./main";

export class PromiseQueue {
    private tasks: {
        task: () => Promise<unknown>;
        onFinished: () => void;
    }[] = [];

    constructor(private readonly plugin: ObsidianGit) {}

    /**
     * Add a task to the queue.
     *
     * @param task The task to add.
     * @param onFinished A callback that is called when the task is finished. Both on success and on error.
     */
    addTask(task: () => Promise<unknown>, onFinished?: () => void): void {
        this.tasks.push({ task, onFinished: onFinished ?? (() => {}) });
        if (this.tasks.length === 1) {
            this.handleTask();
        }
    }

    private handleTask(): void {
        if (this.tasks.length > 0) {
            const item = this.tasks[0];
            item.task()
                .catch((e) => this.plugin.displayError(e))
                .finally(() => {
                    item.onFinished();
                    this.tasks.shift();
                    this.handleTask();
                });
        }
    }

    clear(): void {
        this.tasks = [];
    }
}
