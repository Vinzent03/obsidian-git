import ObsidianGit from "./main";

export class LocalStorageSettings {
    private prefix: string;
    constructor(private readonly plugin: ObsidianGit) {
        this.prefix = this.plugin.manifest.id;
    }

    getPassword(): string {
        return localStorage.getItem(this.prefix + ":password");
    }

    setPassword(value: string): void {
        return localStorage.setItem(this.prefix + ":password", value);
    }

    getHostname(): string {
        return localStorage.getItem(this.prefix + ":hostname");
    }

    setHostname(value: string): void {
        return localStorage.setItem(this.prefix + ":hostname", value);
    }

    getConflict(): string {
        return localStorage.getItem(this.prefix + ":conflict");
    }

    setConflict(value: string): void {
        return localStorage.setItem(this.prefix + ":conflict", value);
    }

    getLastAutoPull(): string {
        return localStorage.getItem(this.prefix + ":lastAutoPull");
    }

    setLastAutoPull(value: string): void {
        return localStorage.setItem(this.prefix + ":lastAutoPull", value);
    }

    getLastAutoBackup(): string {
        return localStorage.getItem(this.prefix + ":lastAutoBackup");
    }

    setLastAutoBackup(value: string): void {
        return localStorage.setItem(this.prefix + ":lastAutoBackup", value);
    }

    getLastAutoPush(): string {
        return localStorage.getItem(this.prefix + ":lastAutoPush");
    }

    setLastAutoPush(value: string): void {
        return localStorage.setItem(this.prefix + ":lastAutoPush", value);
    }

    getGitPath(): string {
        return localStorage.getItem(this.prefix + ":gitPath");
    }

    setGitPath(value: string): void {
        return localStorage.setItem(this.prefix + ":gitPath", value);
    }

    getPluginDisabled(): boolean {
        return localStorage.getItem(this.prefix + ":pluginDisabled") == "true";
    }

    setPluginDisabled(value: boolean): void {
        return localStorage.setItem(this.prefix + ":pluginDisabled", `${value}`);
    }
}