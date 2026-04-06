import { moment } from "obsidian";
import en from "./locale/en";
import zhCn from "./locale/zh-cn";
import { pluginRef } from "src/pluginGlobalRef";

const localeMap: { [k: string]: Partial<typeof en> } = {
    en,
    "zh-cn": zhCn,
};

export function t(str: keyof typeof en | string, ...vars: string[]): string {
    const language = pluginRef.plugin?.settings?.language || "auto";
    const locale = language === "auto" ? (moment.locale() === "zh-cn" ? "zh-cn" : "en") : language;
    
    let target = (localeMap[locale] as any)?.[str] || (en as any)[str] || str;

    if (vars.length > 0) {
        vars.forEach((v, i) => {
            target = target.replace(`%${i + 1}`, v);
        });
    }

    return target;
}
