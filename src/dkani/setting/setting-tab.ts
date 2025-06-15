import { Notice, moment, type RGB } from "obsidian";
import { colord } from "colord";
import type ObsidianGit from "src/main";
import type { ObsidianGitSettings } from "src/types";
import { DEFAULT_SETTINGS } from "src/constants";
import { createSettingsConfig } from "./setting-config";
import { ConversionHelper } from "./setting-conversion-helper";
import type { LineAuthorSettings } from "src/lineAuthor/model";
import { IsomorphicGit } from "src/gitManager/isomorphicGit";
import { Renderer } from "@dkani/obsidian-settings-ui";

export class ObsidianNewGitSettingsTab extends ConversionHelper {
    renderer: Renderer<ObsidianGitSettings>;

    constructor(plugin: ObsidianGit) {
        super(plugin.app, plugin);
        this.renderer = new Renderer(
            plugin,
            plugin.settings,
            DEFAULT_SETTINGS,
            this
        );
    }
    setGitPath(value: string) {
        this.plugin.gitManager.updateGitPath(value);
        this.plugin.localStorage.setGitPath(value);
    }
    async setBasePath(value: string) {
        this.plugin.settings.basePath = value;
        await this.plugin.saveSettings();
        this.plugin.gitManager
            .updateBasePath(value || "")
            .catch((e) => this.plugin.displayError(e));
    }
    setPluginDisabled(value: boolean) {
        this.plugin.localStorage.setPluginDisabled(value);
        if (value) {
            this.plugin.unloadPlugin();
        } else {
            this.plugin
                .init({ fromReload: true })
                .catch((e) => this.plugin.displayError(e));
        }
        new Notice(
            "Obsidian must be restarted for the changes to take affect."
        );
    }
    isAutoPushEnabled(): boolean {
        return (
            this.plugin.settings.autoPushInterval > 0 ||
            (!this.plugin.settings.differentIntervalCommitAndPush &&
                this.plugin.settings.autoSaveInterval > 0)
        );
    }

    autoSaveIntervalReplacements = () => {
        const text = this.plugin.settings.differentIntervalCommitAndPush
            ? "`commit`"
            : "`commit` & `push`";
        return [
            { name: "action", text: text },
            {
                name: "interval",
                text: String(this.plugin.settings.autoSaveInterval),
            },
        ];
    };
    async onClickPreviewCommitMessage(): Promise<void> {
        const commitMessagePreview =
            await this.plugin.gitManager.formatCommitMessage(
                this.plugin.settings.commitMessage
            );
        new Notice(`${commitMessagePreview}`);
        // new Notice(`Preview using template: ${this.plugin.settings.commitMessage}`);
    }
    setLineAuthor(value: boolean): void {
        if (value === true) {
            // this.plugin.settings.lineAuthor = { ...DEFAULT_SETTINGS_LineAuthorSettings };
            this.plugin.lineAuthoringFeature.activateFeature();
            console.log("lineAuthor", this.plugin.settings.lineAuthor);
        } else {
            // this.plugin.settings.lineAuthor = undefined;
            this.plugin.lineAuthoringFeature.deactivateFeature();
            console.log("lineAuthor", this.plugin.settings.lineAuthor);
        }
    }
    // private previewCustomDateTimeDescriptionHtml(dateTimeFormatCustomString: string) {
    customLineAuthorDatetimeFormatPreview = () => {
        const formattedDateTime = moment().format(
            this.plugin.settings.lineAuthor!.dateTimeFormatCustomString
        );
        return [{ name: "format", text: `${formattedDateTime}` }];
    };
    customLineAuthorDatetimeFormat(): boolean | undefined {
        return (
            this.plugin.settings.lineAuthor?.dateTimeFormatOptions === "custom"
        );
    }
    coloringMaxAgeReplacements = () => {
        return [
            {
                name: "age",
                text: String(this.plugin.settings.lineAuthor!.coloringMaxAge),
            },
        ];
    };
    validateColoringMaxAge(coloringMaxAge: string) {
        console.log("validateColoringMaxAge", coloringMaxAge);
        const duration = this.parseDuration(coloringMaxAge);
        const durationString =
            duration !== undefined ? `${duration.asDays()} days` : "invalid!";
        if (duration !== undefined) {
            return { valid: true }; //, data: duration.asDays() + 'd' }
        } else {
            return { valid: false };
        }
    }
    private parseDuration(durationString: string): moment.Duration | undefined {
        // https://momentjs.com/docs/#/durations/creating/
        const duration = moment.duration("P" + durationString.toUpperCase());
        return duration.isValid() && duration.asDays() && duration.asDays() >= 1
            ? duration
            : undefined;
    }
    previewColor(key: keyof LineAuthorSettings) {
        const rgb = this.plugin.settings.lineAuthor![key] as RGB;
        const color = colord(rgb);
        const colorString = color.toRgbString();
        return `<label class='line-author-settings-preview' style='background-color: ${colorString}'>abcdef Author Name 2025-05-04</label>`;
    }

    validateColorNewestCommits(value: any): {
        valid: boolean;
        data?: any;
        invalid?: string;
        preview?: string;
    } {
        const color = colord(value); //?.toRgbaArray();
        if (!color.isValid) {
            return { valid: false }; // data: duration.asDays() + 'd' };
        } else {
            const colorString = color.toRgbString();
            const previewColor = `<div class='line-author-settings-preview' style='background-color: ${colorString}'>abcdef Author Name 2025-05-04</div>`;
            return { valid: true, preview: previewColor };
        }
    }
    updateColors(): void {
        document.body.style.setProperty(
            "--obs-git-gutter-text",
            this.plugin.settings.lineAuthor!.textColorCss
        ); //#f4f1f1
    }

    async getGitReadyUsername() {
        return (await this.plugin.gitManager.getConfig("user.name")) ?? "";
    }
    async setGitReadyUsername(value: string) {
        await this.plugin.gitManager.setConfig(
            "user.name",
            value === "" ? undefined : value
        );
    }
    async getGitReadyEmail() {
        return (await this.plugin.gitManager.getConfig("user.email")) ?? "";
    }
    async setGitReadyEmail(value: string) {
        await this.plugin.gitManager.setConfig(
            "user.email",
            value === "" ? undefined : value
        );
    }
    isIsomorphicGit() {
        return this.plugin.gitManager instanceof IsomorphicGit;
    }
    setIsomorphicGitUsername(value: string) {
        this.plugin.localStorage.setUsername(value);
    }
    getIsomorphicGitUsername() {
        return this.plugin.localStorage.getUsername() ?? "";
    }
    setIsomorphicGitPassword(value: string): any {
        this.plugin.localStorage.setPassword(value);
    }
    getIsomorphicGitPassword() {
        return this.plugin.localStorage.getPassword() ?? "";
    }

    async display(): Promise<void> {
        this.containerEl = await this.renderer.display(
            this.containerEl,
            createSettingsConfig(this)
        );
    }
}
