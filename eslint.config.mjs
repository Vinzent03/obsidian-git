import svelteParser from "svelte-eslint-parser";
import tsParser from "@typescript-eslint/parser";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginSvelte from "eslint-plugin-svelte";

export default tseslint.config(
    {
        ignores: ["**/node_modules/", "**/main.js"],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...eslintPluginSvelte.configs["flat/prettier"],
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
    {
        files: ["**/*.svelte"],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                extraFileExtensions: [".svelte"],
                parser: tsParser,
            },
        },
        rules: {
            "no-undef": "off",
        },
    }
);
