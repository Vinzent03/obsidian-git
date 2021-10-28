import { App, SuggestModal } from "obsidian";

export class GeneralModal extends SuggestModal<string> {
    list: string[];
    resolve: ((value: string | PromiseLike<string>) => void) | null = null;


    constructor(app: App, remotes: string[], placeholder: string) {
        super(app);
        this.list = remotes;
        this.setPlaceholder(placeholder);
    }

    open(): Promise<string> {
        super.open();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.resolve) this.resolve(value);
        super.selectSuggestion(value, evt);
    }

    onClose() {
        if (this.resolve) this.resolve(undefined);
    }

    getSuggestions(query: string): string[] {
        return [query.length > 0 ? query : "...", ...this.list];
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.innerText = value;
    }

    onChooseSuggestion(item: string, _: MouseEvent | KeyboardEvent) { }

}