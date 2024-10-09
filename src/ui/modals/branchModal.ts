import { FuzzySuggestModal } from "obsidian";
import type ObsidianGit from "src/main";

export class BranchModal extends FuzzySuggestModal<string> {
    resolve: (
        value: string | undefined | PromiseLike<string | undefined>
    ) => void;

    constructor(
        plugin: ObsidianGit,
        private readonly branches: string[]
    ) {
        super(plugin.app);
        this.setPlaceholder("Select branch to checkout");
    }

    getItems(): string[] {
        return this.branches;
    }
    getItemText(item: string): string {
        return item;
    }
    onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
        this.resolve(item);
    }

    open(): Promise<string> {
        super.open();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    async onClose() {
        //onClose gets called before onChooseItem
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (this.resolve) this.resolve(undefined);
    }
}
