import { debounce } from "obsidian";
import type ObsidianGit from "./main";

export default class AutomaticsManager {
    private timeoutIDCommitAndSync?: number;
    private timeoutIDPush?: number;
    private timeoutIDPull?: number;

    constructor(private readonly plugin: ObsidianGit) {}

    private saveLastAuto(date: Date, mode: "backup" | "pull" | "push") {
        if (mode === "backup") {
            this.plugin.localStorage.setLastAutoBackup(date.toString());
        } else if (mode === "pull") {
            this.plugin.localStorage.setLastAutoPull(date.toString());
        } else if (mode === "push") {
            this.plugin.localStorage.setLastAutoPush(date.toString());
        }
    }

    private loadLastAuto(): { backup: Date; pull: Date; push: Date } {
        return {
            backup: new Date(
                this.plugin.localStorage.getLastAutoBackup() ?? ""
            ),
            pull: new Date(this.plugin.localStorage.getLastAutoPull() ?? ""),
            push: new Date(this.plugin.localStorage.getLastAutoPush() ?? ""),
        };
    }

    async init() {
        await this.setUpAutoCommitAndSync();
        const lastAutos = this.loadLastAuto();

        if (
            this.plugin.settings.differentIntervalCommitAndPush &&
            this.plugin.settings.autoPushInterval > 0
        ) {
            const now = new Date();

            const diff =
                this.plugin.settings.autoPushInterval -
                Math.round(
                    (now.getTime() - lastAutos.push.getTime()) / 1000 / 60
                );
            this.startAutoPush(diff <= 0 ? 0 : diff);
        }
        if (this.plugin.settings.autoPullInterval > 0) {
            const now = new Date();

            const diff =
                this.plugin.settings.autoPullInterval -
                Math.round(
                    (now.getTime() - lastAutos.pull.getTime()) / 1000 / 60
                );
            this.startAutoPull(diff <= 0 ? 0 : diff);
        }
    }

    unload() {
        this.clearAutoPull();
        this.clearAutoPush();
        this.clearAutoCommitAndSync();
    }

    /**
     * Clears all timers and sets all timers to their current settings.
     *
     * This does not calculate any differences to last autos or commits.
     * Should only be used when settings are changed.
     */
    reload(...type: ("commit" | "push" | "pull")[]) {
        if (type.contains("commit")) {
            this.clearAutoCommitAndSync();
            if (this.plugin.settings.autoSaveInterval > 0) {
                this.startAutoCommitAndSync(
                    this.plugin.settings.autoSaveInterval
                );
            }
        }
        if (type.contains("push")) {
            this.clearAutoPush();
            if (
                this.plugin.settings.differentIntervalCommitAndPush &&
                this.plugin.settings.autoPushInterval > 0
            ) {
                this.startAutoPush(this.plugin.settings.autoPushInterval);
            }
        }
        if (type.contains("pull")) {
            this.clearAutoPull();
            if (this.plugin.settings.autoPullInterval > 0) {
                this.startAutoPull(this.plugin.settings.autoPullInterval);
            }
        }
    }

    async setUpAutoCommitAndSync() {
        if (this.plugin.settings.setLastSaveToLastCommit) {
            this.clearAutoCommitAndSync();
            const lastCommitDate =
                await this.plugin.gitManager.getLastCommitTime();
            if (lastCommitDate) {
                this.plugin.localStorage.setLastAutoBackup(
                    lastCommitDate.toString()
                );
            }
        }

        if (!this.timeoutIDCommitAndSync && !this.plugin.autoCommitDebouncer) {
            const lastAutos = this.loadLastAuto();

            if (this.plugin.settings.autoSaveInterval > 0) {
                const now = new Date();

                const diff =
                    this.plugin.settings.autoSaveInterval -
                    Math.round(
                        (now.getTime() - lastAutos.backup.getTime()) / 1000 / 60
                    );
                this.startAutoCommitAndSync(diff <= 0 ? 0 : diff);
            }
        }
    }

    private startAutoCommitAndSync(minutes?: number) {
        let time = (minutes ?? this.plugin.settings.autoSaveInterval) * 60000;
        if (this.plugin.settings.autoBackupAfterFileChange) {
            if (minutes === 0) {
                this.doAutoCommitAndSync();
            } else {
                this.plugin.autoCommitDebouncer = debounce(
                    () => this.doAutoCommitAndSync(),
                    time,
                    true
                );
            }
        } else {
            // max timeout in js
            if (time > 2147483647) time = 2147483647;
            this.timeoutIDCommitAndSync = window.setTimeout(
                () => this.doAutoCommitAndSync(),
                time
            );
        }
    }

    // this.plugin is used for both auto commit-and-sync and commit only
    private doAutoCommitAndSync(): void {
        this.plugin.promiseQueue.addTask(
            () => {
                if (this.plugin.settings.differentIntervalCommitAndPush) {
                    return this.plugin.commit({ fromAuto: true });
                } else {
                    return this.plugin.commitAndSync(true);
                }
            },
            () => {
                this.saveLastAuto(new Date(), "backup");
                this.startAutoCommitAndSync();
            }
        );
    }

    private startAutoPull(minutes?: number) {
        let time = (minutes ?? this.plugin.settings.autoPullInterval) * 60000;
        // max timeout in js
        if (time > 2147483647) time = 2147483647;

        this.timeoutIDPull = window.setTimeout(() => this.doAutoPull(), time);
    }

    private doAutoPull(): void {
        this.plugin.promiseQueue.addTask(
            () => this.plugin.pullChangesFromRemote(),
            () => {
                this.saveLastAuto(new Date(), "pull");
                this.startAutoPull();
            }
        );
    }

    private startAutoPush(minutes?: number) {
        let time = (minutes ?? this.plugin.settings.autoPushInterval) * 60000;
        // max timeout in js
        if (time > 2147483647) time = 2147483647;

        this.timeoutIDPush = window.setTimeout(() => this.doAutoPush(), time);
    }

    private doAutoPush(): void {
        this.plugin.promiseQueue.addTask(
            () => this.plugin.push(),
            () => {
                this.saveLastAuto(new Date(), "push");
                this.startAutoPush();
            }
        );
    }

    private clearAutoCommitAndSync(): boolean {
        let wasActive = false;
        if (this.timeoutIDCommitAndSync) {
            window.clearTimeout(this.timeoutIDCommitAndSync);
            this.timeoutIDCommitAndSync = undefined;
            wasActive = true;
        }
        if (this.plugin.autoCommitDebouncer) {
            this.plugin.autoCommitDebouncer?.cancel();
            this.plugin.autoCommitDebouncer = undefined;
            wasActive = true;
        }
        return wasActive;
    }

    private clearAutoPull(): boolean {
        if (this.timeoutIDPull) {
            window.clearTimeout(this.timeoutIDPull);
            this.timeoutIDPull = undefined;
            return true;
        }
        return false;
    }

    private clearAutoPush(): boolean {
        if (this.timeoutIDPush) {
            window.clearTimeout(this.timeoutIDPush);
            this.timeoutIDPush = undefined;
            return true;
        }
        return false;
    }
}
