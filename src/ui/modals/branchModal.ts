import { FuzzySuggestModal } from "obsidian";

export class BranchModal extends FuzzySuggestModal<string> {
    resolve: (
        value: string | undefined | PromiseLike<string | undefined>
    ) => void;

    constructor(private readonly branches: string[]) {
        super(app);
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
