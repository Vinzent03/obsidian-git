import { App, SuggestModal } from "obsidian";

export class GeneralModal extends SuggestModal<string> {
    resolve: ((value: string | PromiseLike<string>) => void) | null = null;


    constructor(app: App, private options: string[], placeholder: string, private allowEmpty = false, private onlySelection: boolean = false) {
        super(app);
        this.setPlaceholder(placeholder);
    }

    open(): Promise<string> {
        super.open();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.resolve) this.resolve((this.allowEmpty && value === " ") ? "" : value);
        super.selectSuggestion(value, evt);
    }

    onClose() {
        if (this.resolve) this.resolve(undefined);
    }

    getSuggestions(query: string): string[] {
        if (this.onlySelection) {
            return this.options;
        } else if (this.allowEmpty) {
            return [(query.length > 0) ? query : " ", ...this.options];
        } else {
            return [query.length > 0 ? query : "...", ...this.options];

        }
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.innerText = value;
    }

    onChooseSuggestion(item: string, _: MouseEvent | KeyboardEvent) { }

}