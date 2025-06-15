import { App, PluginSettingTab } from "obsidian";
import type ObsidianGit from "src/main";
import type { ObsidianGitSettings } from "src/types";

export abstract class ConversionHelper extends PluginSettingTab {
    constructor(
        app: App,
        public plugin: ObsidianGit
    ) {
        super(app, plugin);
    }
    protected get settings() {
        return this.plugin.settings;
    }

    /**
     * Ensure, that certain last shown values are persisten in the settings.
     *
     * Necessary for the line author info gutter context menus.
     */
    public beforeSaveSettings() {
        const laSettings = this.settings.lineAuthor;
        if (laSettings.authorDisplay !== "hide") {
            laSettings.lastShownAuthorDisplay = laSettings.authorDisplay;
        }
        if (laSettings.dateTimeFormatOptions !== "hide") {
            laSettings.lastShownDateTimeFormatOptions = laSettings.dateTimeFormatOptions;
        }
    }
    public configureLineAuthorShowStatus(show: boolean) {
        this.settings.lineAuthor.show = show;
        void this.plugin.saveSettings();

        if (show) this.plugin.lineAuthoringFeature.activateFeature();
        else this.plugin.lineAuthoringFeature.deactivateFeature();
    }
    /**
     * Persists the setting {@link key} with value {@link value} and
     * refreshes the line author info views.
     */
    public async lineAuthorSettingHandler<K extends keyof ObsidianGitSettings["lineAuthor"]>(
        key: K,
        value: ObsidianGitSettings["lineAuthor"][K]
    ): Promise<void> {
        this.settings.lineAuthor[key] = value;
        await this.plugin.saveSettings();
        this.plugin.lineAuthoringFeature.refreshLineAuthorViews();
    }
}
