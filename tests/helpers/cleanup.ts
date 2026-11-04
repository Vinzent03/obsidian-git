import { afterEach } from "vitest";

type Cleanable = {
    cleanup(): void;
};

const cleanupStack: Cleanable[] = [];

export function withCleanup<T extends Cleanable>(resource: T): T {
    cleanupStack.push(resource);
    return resource;
}

afterEach(() => {
    while (cleanupStack.length > 0) {
        cleanupStack.pop()?.cleanup();
    }
});
