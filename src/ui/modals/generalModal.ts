import { SuggestModal } from "obsidian";

export interface OptionalGeneralModalConfig {
    options?: string[];
    placeholder?: string;
    allowEmpty?: boolean;
    onlySelection?: boolean;
    initialValue?: string;
}
interface GeneralModalConfig {
    options: string[];
    placeholder: string;
    allowEmpty: boolean;
    onlySelection: boolean;
    initialValue?: string;
}

const generalModalConfigDefaults: GeneralModalConfig = {
    options: [],
    placeholder: "",
    allowEmpty: false,
    onlySelection: false,
    initialValue: undefined,
};

export class GeneralModal extends SuggestModal<string> {
    resolve: ((value: string | undefined | PromiseLike<string | undefined>) => void);
    config: GeneralModalConfig;

    constructor(config: OptionalGeneralModalConfig) {
        super(app);
        this.config = { ...generalModalConfigDefaults, ...config };
        this.setPlaceholder(this.config.placeholder);
    }

    open(): Promise<string> {
        super.open();

        if (this.config.initialValue != undefined) {
            this.inputEl.value = this.config.initialValue;
            this.inputEl.dispatchEvent(new Event("input"));
        }

        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.resolve) {
            let res;
            if (this.config.allowEmpty && value === " ") res = "";
            else if (value === "...") res = undefined;
            else res = value;
            this.resolve(res);
        }
        super.selectSuggestion(value, evt);
    }

    onClose() {
        if (this.resolve) this.resolve(undefined);
    }

    getSuggestions(query: string): string[] {
        if (this.config.onlySelection) {
            return this.config.options;
        } else if (this.config.allowEmpty) {
            return [(query.length > 0) ? query : " ", ...this.config.options];
        } else {
            return [query.length > 0 ? query : "...", ...this.config.options];

        }
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    };

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
    }
}