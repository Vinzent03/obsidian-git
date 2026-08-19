type MomentLike = {
    diff(other: MomentLike, unit: string): number;
    format(format: string): string;
};

type DurationLike = {
    isValid(): boolean;
    asDays(): number;
};

type MomentFactory = {
    (): MomentLike;
    unix(seconds: number): MomentLike;
    duration(value: string): DurationLike;
};

function createMoment(): MomentLike {
    return {
        diff: () => 0,
        format: () => "",
    };
}

export const moment: MomentFactory = Object.assign(createMoment, {
    unix: () => createMoment(),
    duration: () => ({
        isValid: () => true,
        asDays: () => 1,
    }),
});

export const Platform = {
    isDesktop: true,
    isDesktopApp: true,
    isMobile: false,
    isMobileApp: false,
    isMacOS: false,
    isWin: false,
    isIosApp: false,
};

export class Notice {
    constructor(
        public message?: string | DocumentFragment,
        public timeout?: number
    ) {}

    hide(): void {}

    setMessage(message: string | DocumentFragment): this {
        this.message = message;
        return this;
    }
}

export class TAbstractFile {
    path = "";
    name = "";
}

export class TFile extends TAbstractFile {
    basename = "";
    extension = "";
    stat = { ctime: 0, mtime: 0, size: 0 };

    constructor(path = "") {
        super();
        this.setPath(path);
    }

    setPath(path: string): void {
        this.path = path;
        this.name = path.split("/").last() ?? path;
        const dotIndex = this.name.lastIndexOf(".");
        this.basename =
            dotIndex >= 0 ? this.name.substring(0, dotIndex) : this.name;
        this.extension = dotIndex >= 0 ? this.name.substring(dotIndex + 1) : "";
    }
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[] = [];

    constructor(path = "") {
        super();
        this.path = path;
        this.name = path.split("/").last() ?? path;
    }

    isRoot(): boolean {
        return this.path === "" || this.path === "/";
    }
}

export class Plugin {
    constructor(
        public app: App,
        public manifest: Record<string, unknown>
    ) {}
}

export class Menu {
    showAtPosition(): void {}
}

export class ItemView {}
export class MarkdownView {}
export class WorkspaceLeaf {}
export class PluginSettingTab {}
export class Modal {}
export class SuggestModal<_T> {}
export class FuzzySuggestModal<_T> {}
export class Scope {
    register(): void {}
}

export type EventRef = object;
export type RGB = { r: number; g: number; b: number };
export type EditorPosition = { line: number; ch: number };
export type Editor = {
    getCursor(position?: "from" | "to" | "head" | "anchor"): EditorPosition;
};
export type HoverParent = unknown;
export type HoverPopover = unknown;
export type ViewStateResult = unknown;
export type MenuItem = unknown;
export type TextComponent = unknown;
export type DataAdapter = unknown;
export type FileSystemAdapter = unknown;
export type Vault = {
    getAbstractFileByPath(path: string): TAbstractFile | null;
};
export type App = {
    vault: Vault;
    workspace: {
        getLeaf(openState?: boolean | string): WorkspaceLeaf;
        trigger(name: string, ...data: unknown[]): void;
    };
    viewRegistry: {
        getTypeByExtension(extension: string): unknown;
    };
};

export function normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function setIcon(): void {}
export function setTooltip(): void {}

export type Debouncer<T extends unknown[], V> = {
    (...args: T): Debouncer<T, V>;
    cancel(): Debouncer<T, V>;
    run(): V | void;
};

export function debounce<T extends unknown[], V>(
    callback: (...args: T) => V
): Debouncer<T, V> {
    let pendingArguments: T | undefined;
    const debouncer = ((...args: T) => {
        pendingArguments = args;
        return debouncer;
    }) as Debouncer<T, V>;
    debouncer.cancel = () => {
        pendingArguments = undefined;
        return debouncer;
    };
    debouncer.run = () => {
        if (!pendingArguments) return;
        const args = pendingArguments;
        pendingArguments = undefined;
        return callback(...args);
    };
    return debouncer;
}

export type RequestUrlParam = {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer;
    throw?: boolean;
};

export type RequestUrlResponse = {
    status: number;
    headers: Record<string, string>;
    arrayBuffer: ArrayBuffer;
    text: string;
};

/**
 * Performs a real HTTP request via fetch, mirroring Obsidian's `requestUrl`
 * semantics closely enough for the wasm-git HTTP bridge: no redirects hidden,
 * `throw: false` reports HTTP errors through `status`, and the body is
 * available as an `arrayBuffer` property.
 */
export async function requestUrl(
    request: RequestUrlParam | string
): Promise<RequestUrlResponse> {
    const param = typeof request === "string" ? { url: request } : request;
    let response: Response;
    try {
        response = await fetch(param.url, {
            method: param.method ?? "GET",
            headers: param.headers,
            body:
                param.body instanceof ArrayBuffer
                    ? new Uint8Array(param.body)
                    : param.body,
        });
    } catch (error) {
        throw new Error(
            `net::ERR_CONNECTION_REFUSED ${error instanceof Error ? error.message : String(error)}`
        );
    }
    if ((param.throw ?? true) && response.status >= 400) {
        throw new Error(`Request failed, status ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
        headers[name] = value;
    });
    return {
        status: response.status,
        headers,
        arrayBuffer,
        text: new TextDecoder().decode(arrayBuffer),
    };
}
