import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, type Plugin } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads `.wasm` imports as raw bytes (default export), mirroring the esbuild
 * `binary` loader used for the production bundle.
 */
function wasmBinaryLoader(): Plugin {
    return {
        name: "wasm-binary-loader",
        enforce: "pre",
        load(id: string) {
            if (!id.endsWith(".wasm")) return null;
            return (
                `import { readFileSync } from "node:fs";\n` +
                `export default readFileSync(${JSON.stringify(id)});`
            );
        },
    };
}

export default defineConfig({
    plugins: [wasmBinaryLoader()],
    resolve: {
        alias: {
            obsidian: path.resolve(dirname, "tests/stubs/obsidian.ts"),
            src: path.resolve(dirname, "src"),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
        server: {
            deps: {
                // Process wasm-git through the Vite pipeline so the
                // wasm-binary-loader plugin applies to its `.wasm` file.
                inline: [/wasm-git/],
            },
        },
        testTimeout: 30000,
        hookTimeout: 30000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            reportsDirectory: "coverage",
        },
    },
});
