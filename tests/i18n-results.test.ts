import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitActions } from "src/gitActions";
import { t } from "src/i18n";
import type ObsidianGit from "src/main";
import type { CommitResult, PullResult, PushResult } from "src/types";

const language = vi.hoisted(() => ({ value: "en" }));
vi.mock("obsidian", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getLanguage: () => language.value,
}));

function createReporter() {
    const displayMessage = vi.fn<(message: string) => void>();
    const plugin = { displayMessage } as unknown as ObsidianGit;
    const actions = new GitActions(plugin) as unknown as {
        reportCommitResult(result: CommitResult): void;
        reportPushResult(result: PushResult): void;
        reportPullResult(result: PullResult): void;
        reportDeleteRepositoryResult(result: {
            status: "deleted" | "not-found" | "cancelled";
        }): void;
    };
    return { actions, displayMessage };
}

describe("localized Git operation results", () => {
    beforeEach(() => {
        language.value = "en";
    });

    it.each([0, 1, 2])(
        "preserves English file grammar for %i files",
        (count) => {
            const { actions, displayMessage } = createReporter();
            const files = count === 1 ? "file" : "files";
            actions.reportCommitResult({ status: "committed", files: count });
            expect(displayMessage).toHaveBeenLastCalledWith(
                `Committed ${count} ${files}`
            );
            actions.reportPushResult({ status: "pushed", files: count });
            expect(displayMessage).toHaveBeenLastCalledWith(
                `Pushed ${count} ${files} to remote`
            );
        }
    );

    it.each([0, 1, 2])("interpolates Chinese counts for %i files", (count) => {
        language.value = "zh-CN";
        const { actions, displayMessage } = createReporter();
        actions.reportCommitResult({ status: "committed", files: count });
        expect(displayMessage).toHaveBeenLastCalledWith(
            `已提交 ${count} 个文件`
        );
        actions.reportPushResult({ status: "pushed", files: count });
        expect(displayMessage).toHaveBeenLastCalledWith(
            `已向远程推送 ${count} 个文件`
        );
        expect(
            t("{{count}} conflict(s) left").replace("{{count}}", String(count))
        ).toBe(`剩余 ${count} 个冲突`);
    });

    it("keeps the no-change prefix compatible with translated notices", () => {
        language.value = "zh";
        const { actions, displayMessage } = createReporter();
        actions.reportCommitResult({
            status: "nothing-to-commit",
            reason: "no-changes",
        });
        expect(displayMessage).toHaveBeenLastCalledWith("无更改可提交");
        expect(
            displayMessage.mock.lastCall?.[0].startsWith(t("No changes"))
        ).toBe(true);
        actions.reportPushResult({ status: "pushed", files: null });
        expect(displayMessage).toHaveBeenLastCalledWith("已推送到远程");
        actions.reportPushResult({ status: "up-to-date" });
        expect(displayMessage).toHaveBeenLastCalledWith("没有可推送的提交");
    });

    it.each(["en", "zh"])(
        "retains inside/outside counts in %s pull results",
        (locale) => {
            language.value = locale;
            const { actions, displayMessage } = createReporter();
            actions.reportPullResult({
                status: "updated",
                files: [
                    {
                        path: "note.md",
                        vaultPath: "note.md",
                        index: " ",
                        workingDir: "M",
                    },
                ],
                outsideVault: 2,
            });
            expect(displayMessage).toHaveBeenLastCalledWith(
                locale === "en"
                    ? "Pulled 3 files from remote (1 in the vault, 2 outside)"
                    : "已从远程拉取 3 个文件（库内 1 个，库外 2 个）"
            );
        }
    );

    it("localizes repository deletion messages and confirmation labels", () => {
        language.value = "zh-CN";
        const { actions, displayMessage } = createReporter();
        actions.reportDeleteRepositoryResult({ status: "deleted" });
        expect(displayMessage).toHaveBeenLastCalledWith(
            "已成功删除仓库。正在重新加载插件..."
        );
        actions.reportDeleteRepositoryResult({ status: "not-found" });
        expect(displayMessage).toHaveBeenLastCalledWith("未找到仓库");
        expect(t("Reload")).toBe("重新加载");
        expect(t("YES")).toBe("是");
        expect(t("NO")).toBe("否");
        expect(t("Vault Root")).toBe("库根目录");
        expect(t("Abort clone")).toBe("中止克隆");
        expect(t("Auto commit interval (minutes)")).toBe(
            "自动提交间隔（分钟）"
        );
        expect(t("Auto commit-and-sync interval (minutes)")).toBe(
            "自动提交并同步间隔（分钟）"
        );
        expect(
            t(
                "Limit status, staging, unstaging, discarding, and submodule updates to the vault where possible. Configured auto commit globs take precedence for automatic staging. Repository history and remote actions remain repository-wide."
            )
        ).not.toContain("Limit status");
        expect(t("Pull on startup")).toBe("启动时拉取");
        expect(t("Stage all changes when nothing is staged")).toBe(
            "未暂存任何内容时暂存所有更改"
        );
    });
});
