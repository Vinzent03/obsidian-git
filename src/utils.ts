import * as cssColorConverter from "css-color-converter";
import deepEqual from "deep-equal";
import type { App, RGB, WorkspaceLeaf } from "obsidian";
import { Keymap, Menu, moment, TFile } from "obsidian";
import { BINARY_EXTENSIONS } from "./constants";

export const worthWalking = (filepath: string, root?: string) => {
    if (filepath === "." || root == null || root.length === 0 || root === ".") {
        return true;
    }
    if (root.length >= filepath.length) {
        return root.startsWith(filepath);
    } else {
        return filepath.startsWith(root);
    }
};

export function getNewLeaf(
    app: App,
    event?: MouseEvent
): WorkspaceLeaf | undefined {
    let leaf: WorkspaceLeaf | undefined;
    if (event) {
        if (event.button === 0 || event.button === 1) {
            const type = Keymap.isModEvent(event);
            leaf = app.workspace.getLeaf(type);
        }
    } else {
        leaf = app.workspace.getLeaf(false);
    }
    return leaf;
}

export function mayTriggerFileMenu(
    app: App,
    event: MouseEvent,
    filePath: string,
    view: WorkspaceLeaf,
    source: string
) {
    if (event.button == 2) {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file != null) {
            const fileMenu = new Menu();
            app.workspace.trigger("file-menu", fileMenu, file, source, view);
            fileMenu.showAtPosition({ x: event.pageX, y: event.pageY });
        } else {
            const fileMenu = new Menu();
            app.workspace.trigger(
                "obsidian-git:menu",
                fileMenu,
                filePath,
                source,
                view
            );
            fileMenu.showAtPosition({ x: event.pageX, y: event.pageY });
        }
    }
}

/**
 * Creates a type-error, if this function is in a possible branch.
 *
 * Use this to ensure exhaustive switch cases.
 *
 * During runtime, an error will be thrown, if executed.
 */
export function impossibleBranch(x: never): never {
    /* eslint-disable-next-line @typescript-eslint/restrict-plus-operands */
    throw new Error("Impossible branch: " + x);
}

export function rgbToString(rgb: RGB): string {
    return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
}

export function convertToRgb(str: string): RGB | undefined {
    const color = cssColorConverter.fromString(str)?.toRgbaArray();
    if (color === undefined) {
        return undefined;
    }
    const [r, g, b] = color;
    return { r, g, b };
}

export function momentToEpochSeconds(instant: moment.Moment): number {
    return instant.diff(moment.unix(0), "seconds");
}

export function median(array: number[]): number | undefined {
    if (array.length === 0) return undefined;
    return array.slice().sort()[Math.floor(array.length / 2)];
}

export function strictDeepEqual<T>(a: T, b: T): boolean {
    return deepEqual(a, b, { strict: true });
}

export function arrayProxyWithNewLength<T>(array: T[], length: number): T[] {
    return new Proxy(array, {
        get(target, prop) {
            if (prop === "length") {
                return Math.min(length, target.length);
            }
            return target[prop as keyof T[]];
        },
    });
}

export function resizeToLength(
    original: string,
    desiredLength: number,
    fillChar: string
): string {
    if (original.length <= desiredLength) {
        const prefix = new Array(desiredLength - original.length)
            .fill(fillChar)
            .join("");
        return prefix + original;
    } else {
        return original.substring(original.length - desiredLength);
    }
}

export function prefixOfLengthAsWhitespace(
    toBeRenderedText: string,
    whitespacePrefixLength: number
): string {
    if (whitespacePrefixLength <= 0) return toBeRenderedText;

    const whitespacePrefix = new Array(whitespacePrefixLength)
        .fill(" ")
        .join("");
    const originalSuffix = toBeRenderedText.substring(
        whitespacePrefixLength,
        toBeRenderedText.length
    );
    return whitespacePrefix + originalSuffix;
}

export function between(l: number, x: number, r: number) {
    return l <= x && x <= r;
}
export function splitRemoteBranch(
    remoteBranch: string
): readonly [string, string | undefined] {
    const [remote, ...branch] = remoteBranch.split("/");
    return [remote, branch.length === 0 ? undefined : branch.join("/")];
}

export function getDisplayPath(path: string): string {
    if (path.endsWith("/")) return path;
    return path.split("/").last()!.replace(/\.md$/, "");
}

export function formatMinutes(minutes: number): string {
    if (minutes === 1) return "1 minute";
    return `${minutes} minutes`;
}

export function getExtensionFromPath(path: string): string {
    const dotIndex = path.lastIndexOf(".");
    return path.substring(dotIndex + 1);
}

/**
 * Decides if a file is binary based on its extension.
 */
export function fileIsBinary(path: string): boolean {
    // This is the case for the most files so we can save some time
    if (path.endsWith(".md")) return false;

    const ext = getExtensionFromPath(path);

    return BINARY_EXTENSIONS.includes(ext);
}

export function formatRemoteUrl(url: string): string {
    if (
        url.startsWith("https://github.com/") ||
        url.startsWith("https://gitlab.com/")
    ) {
        if (!url.endsWith(".git")) {
            url = url + ".git";
        }
    }
    return url;
}

export function fileOpenableInObsidian(
    relativeVaultPath: string,
    app: App
): boolean {
    const file = app.vault.getAbstractFileByPath(relativeVaultPath);
    if (!(file instanceof TFile)) {
        return false;
    }
    try {
        // Internal Obsidian API function
        // If a view type is registired for the file extension, it can be opened in Obsidian.
        // Just checking if Obsidian tracks the file is not enough,
        // because it can also track files, it can only open externally.
        return !!app.viewRegistry.getTypeByExtension(file.extension);
    } catch {
        // If the function doesn't exist anymore, it will throw an error. In that case, just skip the check.
        return true;
    }
}

export function convertPathToAbsoluteGitignoreRule({
    isFolder,
    gitRelativePath,
}: {
    isFolder?: boolean;
    gitRelativePath: string;
}): string {
    // Add a leading slash to set the rule as absolute from root, so it only excludes that exact path
    let composedPath = "/";

    composedPath += gitRelativePath;

    // Add an explicit folder rule, so that the same path doesn't also apply for files with that same name
    if (isFolder) {
        composedPath += "/";
    }

    // Escape special characters, so that git treats them as literal characters.
    const escaped = composedPath.replace(/([\\!#*?[\]])/g, String.raw`\$1`);

    // Then escape each trailing whitespace character individually, because git trims trailing whitespace from the end of the rule.
    // Files normally end with a file extension, not whitespace, but a file with trailing whitespace can appear if Obsidian's "Detect all file extensions" setting is turned on.
    return escaped.replace(/\s(?=\s*$)/g, String.raw`\ `);
}
