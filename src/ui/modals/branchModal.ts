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
    onChooseItem(item: string, _: MouseEvent | KeyboardEvent): void {
        this.resolve(item);
    }

    openAndGetReslt(): Promise<string> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onClose() {
        //onClose gets called before onChooseItem
        void new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
            if (this.resolve) this.resolve(undefined);
        });
    }
}
