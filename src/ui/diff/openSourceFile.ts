import { TFile, type App } from "obsidian";
import { fileOpenableInObsidian } from "src/utils";

export function getOpenableSourcePath(
    app: App,
    vaultPath: string
): string | undefined {
    return fileOpenableInObsidian(vaultPath, app) ? vaultPath : undefined;
}

export async function openVaultFileAtLine(
    app: App,
    vaultPath: string,
    line: number
): Promise<void> {
    const file = app.vault.getAbstractFileByPath(vaultPath);
    if (!(file instanceof TFile)) return;

    const leaf = app.workspace.getLeaf("tab");
    await leaf.openFile(file, {
        eState: { line: Math.max(0, Math.floor(line) - 1) },
    });
}
