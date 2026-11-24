import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            obsidian: path.resolve(dirname, "tests/stubs/obsidian.ts"),
            src: path.resolve(dirname, "src"),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        globalSetup: ["tests/globalSetup.ts"],
        setupFiles: ["tests/setup.ts"],
        // Spawning Git processes is much slower on Windows, so the default
        // 5s timeout is too short for tests that run many Git commands.
        testTimeout: process.platform === "win32" ? 30_000 : undefined,
        hookTimeout: process.platform === "win32" ? 30_000 : undefined,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            reportsDirectory: "coverage",
        },
    },
});
