import type ObsidianGit from "./main";

export class PromiseQueue {
    tasks: (() => Promise<unknown>)[] = [];

    constructor(private readonly plugin: ObsidianGit) {}

    addTask(task: () => Promise<unknown>) {
        this.tasks.push(task);
        if (this.tasks.length === 1) {
            this.handleTask();
        }
    }

    handleTask() {
        if (this.tasks.length > 0) {
            this.tasks[0]()
                .catch((e) => this.plugin.displayError(e))
                .finally(() => {
                    this.tasks.shift();
                    this.handleTask();
                });
        }
    }

    clear() {
        this.tasks = [];
    }
}
