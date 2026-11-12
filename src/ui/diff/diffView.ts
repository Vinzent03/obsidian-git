import { html } from "diff2html";
import type { EventRef, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { ItemView, Menu, Platform } from "obsidian";
import { DIFF_VIEW_CONFIG } from "src/constants";
import { SimpleGit } from "src/gitManager/simpleGit";
import type ObsidianGit from "src/main";
import type { DiffViewState } from "src/types";
import {
    getOpenableSourcePath,
    openVaultFileAtLine,
} from "src/ui/diff/openSourceFile";
import {
    parseDiffHunks,
    sourceLineForDiffSide,
    type DiffHunkRanges,
} from "src/ui/diff/sourceLine";

export default class DiffView extends ItemView {
    parser: DOMParser;
    gettingDiff = false;
    state!: DiffViewState;
    gitRefreshRef!: EventRef;
    gitViewRefreshRef!: EventRef;
    private selectedLine: { side: "a" | "b"; line: number } | undefined;
    private selectedRow: HTMLElement | undefined;
    private diffHunks: DiffHunkRanges[] = [];
    private newLineCount: number | undefined;

    constructor(
        leaf: WorkspaceLeaf,
        private plugin: ObsidianGit
    ) {
        super(leaf);
        this.parser = new DOMParser();
        this.navigation = true;
        this.contentEl.addClass("git-diff");
        this.gitRefreshRef = this.app.workspace.on(
            "obsidian-git:status-changed",
            () => {
                this.refresh().catch(console.error);
            }
        );
    }

    getViewType(): string {
        return DIFF_VIEW_CONFIG.type;
    }

    getDisplayText(): string {
        if (this.state?.bFile != null) {
            let fileName = this.state.bFile.split("/").last();
            if (fileName?.endsWith(".md")) fileName = fileName.slice(0, -3);

            return `Diff: ${fileName}`;
        }
        return DIFF_VIEW_CONFIG.name;
    }

    getIcon(): string {
        return DIFF_VIEW_CONFIG.icon;
    }

    async setState(state: DiffViewState, _: ViewStateResult): Promise<void> {
        this.state = state;

        if (Platform.isMobile) {
            //Update view title on mobile only to show the file name of the diff
            this.leaf.view.titleEl.textContent = this.getDisplayText();
        }

        await this.refresh();
    }

    getState(): Record<string, unknown> {
        return this.state;
    }

    onClose(): Promise<void> {
        this.app.workspace.offref(this.gitRefreshRef);
        this.app.workspace.offref(this.gitViewRefreshRef);
        return super.onClose();
    }

    async onOpen(): Promise<void> {
        await this.refresh();
        return super.onOpen();
    }

    async refresh(): Promise<void> {
        if (this.state?.bFile && !this.gettingDiff && this.plugin.gitManager) {
            this.gettingDiff = true;
            try {
                let diff = await this.plugin.gitManager.getDiffString(
                    this.state.bFile,
                    this.state.aRef == "HEAD",
                    this.state.bRef
                );
                this.contentEl.empty();
                this.selectedLine = undefined;
                this.selectedRow?.removeClass("is-selected");
                this.selectedRow = undefined;
                this.diffHunks = [];
                this.newLineCount = undefined;

                const vaultPath = this.plugin.gitManager.getRelativeVaultPath(
                    this.state.bFile
                );
                if (!diff) {
                    if (
                        this.plugin.gitManager instanceof SimpleGit &&
                        (await this.plugin.gitManager.isTracked(
                            this.state.bFile
                        ))
                    ) {
                        // File is tracked but no changes
                        diff = [
                            `--- ${this.state.aFile}`,
                            `+++ ${this.state.bFile}`,
                            "",
                        ].join("\n");
                    } else if (await this.app.vault.adapter.exists(vaultPath)) {
                        const content =
                            await this.app.vault.adapter.read(vaultPath);
                        const header = `--- /dev/null
+++ ${this.state.bFile}
@@ -0,0 +1,${content.split("\n").length} @@`;

                        diff = [
                            ...header.split("\n"),
                            ...content.split("\n").map((line) => `+${line}`),
                        ].join("\n");
                    }
                }

                if (diff) {
                    const diffEl = this.parser
                        .parseFromString(html(diff), "text/html")
                        .querySelector(".d2h-file-diff") as HTMLElement;
                    this.diffHunks = parseDiffHunks(diff);
                    this.registerDiffEvents(diffEl);
                    this.contentEl.append(diffEl);
                } else {
                    const div = this.contentEl.createDiv({
                        cls: "obsidian-git-center",
                    });
                    div.createSpan({
                        text: "⚠️",
                        attr: { style: "font-size: 2em" },
                    });
                    div.createEl("br");
                    div.createSpan({
                        text: "File not found: " + this.state.bFile,
                    });
                }
            } finally {
                this.gettingDiff = false;
            }
        }
    }

    private registerDiffEvents(diffEl: HTMLElement): void {
        this.newLineCount = undefined;
        diffEl.querySelectorAll(".line-num2").forEach((element) => {
            const line = Number(element.textContent?.trim());
            if (Number.isInteger(line) && line > 0) {
                this.newLineCount = Math.max(this.newLineCount ?? 0, line);
            }
        });

        diffEl.addEventListener("click", (event) => {
            const row = this.diffRowFromEvent(event);
            if (!row) return;
            const line = this.lineFromRow(row);
            if (line) this.selectRow(row, line);
        });

        diffEl.addEventListener("contextmenu", (event) => {
            const row = this.diffRowFromEvent(event);
            if (!row) return;
            const line = this.lineFromRow(row);
            if (!line || !this.getSourceVaultPath()) return;

            event.preventDefault();
            this.selectRow(row, line);
            const menu = Menu.forEvent(event);
            menu.addItem((item) =>
                item
                    .setTitle("Open in editor at this line")
                    .setIcon("file-text")
                    .onClick(() => {
                        void this.openSourceFileAtLine(line.side, line.line);
                    })
            );
            menu.showAtMouseEvent(event);
        });
    }

    private diffRowFromEvent(event: MouseEvent): HTMLElement | undefined {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return undefined;
        return (target.closest("tr") as HTMLElement | null) ?? undefined;
    }

    private lineFromRow(
        row: Element
    ): { side: "a" | "b"; line: number } | undefined {
        const newNumber = this.readLineNumber(row, ".line-num2");
        if (newNumber != undefined) return { side: "b", line: newNumber };

        const oldNumber = this.readLineNumber(row, ".line-num1");
        if (oldNumber != undefined) return { side: "a", line: oldNumber };

        return undefined;
    }

    private readLineNumber(row: Element, selector: string): number | undefined {
        const text = row.querySelector(selector)?.textContent?.trim();
        if (!text) return undefined;

        const line = Number(text);
        return Number.isInteger(line) && line > 0 ? line : undefined;
    }

    private selectRow(
        row: HTMLElement,
        line: { side: "a" | "b"; line: number }
    ): void {
        this.selectedRow?.removeClass("is-selected");
        this.selectedRow = row;
        row.addClass("is-selected");
        this.selectedLine = line;
    }

    getSourceVaultPath(): string | undefined {
        if (this.state?.bFile == undefined || !this.plugin.gitManager) {
            return undefined;
        }
        return getOpenableSourcePath(
            this.app,
            this.plugin.gitManager.getRelativeVaultPath(this.state.bFile)
        );
    }

    canOpenSourceFileAtCurrentLine(): boolean {
        return (
            this.selectedLine != undefined &&
            this.getSourceVaultPath() != undefined
        );
    }

    async openSourceFileAtLine(side: "a" | "b", line: number): Promise<void> {
        const vaultPath = this.getSourceVaultPath();
        if (!vaultPath) return;

        const targetLine = sourceLineForDiffSide(
            side,
            line,
            this.diffHunks,
            this.newLineCount
        );
        try {
            await openVaultFileAtLine(this.app, vaultPath, targetLine);
        } catch (error) {
            this.plugin.displayError(error);
        }
    }

    async openSourceFileAtCurrentLine(): Promise<void> {
        if (!this.selectedLine) return;
        await this.openSourceFileAtLine(
            this.selectedLine.side,
            this.selectedLine.line
        );
    }
}
