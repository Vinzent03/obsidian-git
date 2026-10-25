const fallbackDocument = {
    body: {
        style: {
            setProperty: () => {},
        },
        append: () => {},
        appendChild: () => {},
        classList: {
            contains: () => false,
        },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({}),
    getElementById: () => null,
    querySelector: () => null,
} as unknown as Document;

declare global {
    interface Array<T> {
        first(): T | undefined;
        last(): T | undefined;
    }

    interface Math {
        clamp(value: number, min: number, max: number): number;
    }
}

if (!Array.prototype.first) {
    Object.defineProperty(Array.prototype, "first", {
        configurable: true,
        value: function first<T>(this: T[]): T | undefined {
            return this[0];
        },
    });
}

if (!Array.prototype.last) {
    Object.defineProperty(Array.prototype, "last", {
        configurable: true,
        value: function last<T>(this: T[]): T | undefined {
            return this[this.length - 1];
        },
    });
}

if (!Math.clamp) {
    Object.defineProperty(Math, "clamp", {
        configurable: true,
        value: (value: number, min: number, max: number): number =>
            Math.min(Math.max(value, min), max),
    });
}

Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { debug: "-simple-git" },
});

Object.defineProperty(globalThis, "activeWindow", {
    configurable: true,
    get: () => globalThis,
});

Object.defineProperty(globalThis, "window", {
    configurable: true,
    get: () => globalThis,
});

Object.defineProperty(globalThis, "activeDocument", {
    configurable: true,
    get: () =>
        "document" in globalThis ? globalThis.document : fallbackDocument,
});

export {};
