import { SuggestModal } from "obsidian";
import type ObsidianGit from "src/main";

export class CustomMessageModal extends SuggestModal<string> {
    plugin: ObsidianGit;

    resolve:
        | ((value: string | PromiseLike<string> | undefined) => void)
        | null = null;
    constructor(
        plugin: ObsidianGit,
        private readonly fromAutoBackup: boolean
    ) {
        super(plugin.app);
        this.plugin = plugin;
        this.setPlaceholder(
            "Type your message and select optional the version with the added date."
        );
    }
    open(): Promise<string> {
        super.open();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    onClose() {
        if (this.resolve) this.resolve(undefined);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.resolve) this.resolve(value);
        super.selectSuggestion(value, evt);
    }

    getSuggestions(query: string): string[] {
        const date = (window as any)
            .moment()
            .format(this.plugin.settings.commitDateFormat);
        if (query == "") query = "...";
        return [query, `${date}: ${query}`, `${query}: ${date}`];
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.innerText = value;
    }

    onChooseSuggestion(item: string, _: MouseEvent | KeyboardEvent) {}
}
