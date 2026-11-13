export type ElementOptions = {
    text?: string;
    cls?: string | string[];
    attr?: Record<string, string>;
};

export class FakeElement {
    readonly children: FakeElement[] = [];
    readonly listeners = new Map<string, ((event: unknown) => void)[]>();
    value = "";
    textContent = "";

    constructor(readonly tagName: string) {}

    createEl(tagName: string, options?: ElementOptions): FakeElement {
        const element = new FakeElement(tagName);
        if (options?.text) element.textContent = options.text;
        this.children.push(element);
        return element;
    }

    createDiv(options?: ElementOptions): FakeElement {
        return this.createEl("div", options);
    }

    empty(): void {
        this.children.length = 0;
    }

    setText(text: string): void {
        this.textContent = text;
    }

    addEventListener(type: string, listener: (event: unknown) => void): void {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type: string, event: unknown): void {
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
    }

    find(tagName: string): FakeElement | undefined {
        if (this.tagName === tagName) return this;
        for (const child of this.children) {
            const match = child.find(tagName);
            if (match) return match;
        }
        return undefined;
    }

    findByText(tagName: string, text: string): FakeElement | undefined {
        if (this.tagName === tagName && this.textContent === text) {
            return this;
        }
        for (const child of this.children) {
            const match = child.findByText(tagName, text);
            if (match) return match;
        }
        return undefined;
    }

    focus(): void {}
}

export class FakeModal {
    readonly contentEl = new FakeElement("div");
    readonly titleEl = new FakeElement("h2");
    onOpen?: () => void;
    onClose?: () => void;

    constructor(readonly app: unknown) {}

    open(): void {
        this.onOpen?.();
    }

    close(): void {
        this.onClose?.();
    }
}

export const platform = { isMobile: false };
