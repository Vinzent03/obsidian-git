import { getLanguage } from "obsidian";
import en from "./en";
import zh from "./zh";

const localeMap: Record<string, Record<string, string>> = {
    en,
    zh,
    "zh-cn": zh,
    "zh-tw": zh,
};

/** Current locale override. "auto" means follow Obsidian's language setting. */
let localeOverride: "auto" | "en" | "zh" = "auto";

/**
 * Set the locale override. Call this when the user changes the language setting.
 * Pass "auto" to follow Obsidian's language setting.
 */
export function setLocaleOverride(locale: "auto" | "en" | "zh"): void {
    localeOverride = locale;
}

/**
 * Get the resolved locale code currently in use.
 */
export function getResolvedLocale(): string {
    if (localeOverride !== "auto") {
        return localeOverride;
    }
    return getLanguage().toLowerCase().split("-")[0];
}

/**
 * Get the translation for a given key.
 * Supports simple interpolation with {{variable}} syntax.
 *
 * @example
 * t("settings.heading.automatic") // "Automatic" or "自动"
 * t("notice.cloned_into", { dir: "my-vault" }) // "Cloned new repo into "my-vault""
 */
export function t(key: string, params?: Record<string, string | number>): string {
    const lang = localeOverride !== "auto"
        ? localeOverride
        : getLanguage().toLowerCase();
    const normalizedLang = lang.toLowerCase();

    // Try exact match first, then base language, then fallback to English
    let str =
        localeMap[normalizedLang]?.[key] ??
        localeMap[normalizedLang.split("-")[0]]?.[key] ??
        en[key];

    if (str === undefined) {
        console.warn(`[obsidian-git] Missing translation key: ${key}`);
        return key;
    }

    // Simple interpolation: replace {{param}} with values
    if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            str = str.replace(
                new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"),
                String(paramValue)
            );
        }
    }

    return str;
}

/**
 * Pluralization helper that respects the current locale.
 * Chinese doesn't have plural forms, so it always returns the same form.
 *
 * @example
 * plural(1, "file") // "1 file" (en) / "1 个文件" (zh)
 * plural(5, "file", "files") // "5 files" (en) / "5 个文件" (zh)
 */
export function plural(
    count: number,
    singularKey: string,
    pluralKey?: string
): string {
    const lang = localeOverride !== "auto"
        ? localeOverride
        : getLanguage().toLowerCase();
    const isChinese = lang.startsWith("zh");

    if (isChinese) {
        const base = t(singularKey);
        return `${count} ${base}`;
    }

    if (count === 1) {
        return `${count} ${t(singularKey)}`;
    }
    return `${count} ${t(pluralKey ?? singularKey)}`;
}
