export class PromiseQueue {
    tasks: (() => Promise<unknown>)[] = [];

    addTask(task: () => Promise<unknown>) {
        this.tasks.push(task);
        if (this.tasks.length === 1) {
            this.handleTask();
        }
    }

    handleTask() {
        if (this.tasks.length > 0) {
            this.tasks[0]()
                .catch(console.error)
                .finally(() => {
                    this.tasks.shift();
                    this.handleTask();
                });
        }
    }
}
