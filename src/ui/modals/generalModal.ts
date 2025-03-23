import { SuggestModal } from "obsidian";
import type ObsidianGit from "src/main";

export interface OptionalGeneralModalConfig {
    options?: string[];
    placeholder?: string;
    allowEmpty?: boolean;
    onlySelection?: boolean;
    initialValue?: string;
    obscure?: boolean;
}
interface GeneralModalConfig {
    options: string[];
    placeholder: string;
    allowEmpty: boolean;
    onlySelection: boolean;
    initialValue?: string;
    obscure: boolean;
}

const generalModalConfigDefaults: GeneralModalConfig = {
    options: [],
    placeholder: "",
    allowEmpty: false,
    onlySelection: false,
    initialValue: undefined,
    obscure: false,
};

export class GeneralModal extends SuggestModal<string> {
    resolve: (
        value: string | undefined | PromiseLike<string | undefined>
    ) => void;
    config: GeneralModalConfig;

    constructor(plugin: ObsidianGit, config: OptionalGeneralModalConfig) {
        super(plugin.app);
        this.config = { ...generalModalConfigDefaults, ...config };
        this.setPlaceholder(this.config.placeholder);
        if (this.config.obscure) {
            this.inputEl.type = "password";
            const promptContainer = this.containerEl.querySelector(
                ".prompt-input-container"
            )!;
            promptContainer.addClass("git-obscure-prompt");
            promptContainer.setAttr("git-is-obscured", "true");
            const obscureSwitchButton = promptContainer?.createDiv({
                cls: "search-input-clear-button",
            });
            obscureSwitchButton.style.marginRight = "32px";
            obscureSwitchButton.id = "git-show-password";
            obscureSwitchButton.addEventListener("click", () => {
                const isObscured = promptContainer.getAttr("git-is-obscured");
                if (isObscured === "true") {
                    this.inputEl.type = "text";
                    promptContainer.setAttr("git-is-obscured", "false");
                } else {
                    this.inputEl.type = "password";
                    promptContainer.setAttr("git-is-obscured", "true");
                }
            });
        }
    }

    openAndGetResult(): Promise<string> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
            if (this.config.initialValue != undefined) {
                this.inputEl.value = this.config.initialValue;
                this.inputEl.dispatchEvent(new Event("input"));
            }
        });
    }

    onClose() {
        void new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
            if (this.resolve) this.resolve(undefined);
        });
    }

    getSuggestions(query: string): string[] {
        if (this.config.onlySelection) {
            return this.config.options;
        } else if (this.config.allowEmpty) {
            return [query.length > 0 ? query : " ", ...this.config.options];
        } else {
            return [query.length > 0 ? query : "...", ...this.config.options];
        }
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        if (this.config.obscure) {
            el.hide();
        } else {
            el.setText(value);
        }
    }

    onChooseSuggestion(value: string, _: MouseEvent | KeyboardEvent) {
        if (this.resolve) {
            let res;
            if (this.config.allowEmpty && value === " ") res = "";
            else if (value === "...") res = undefined;
            else res = value;
            this.resolve(res);
        }
    }
}
