import { existsSync, readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitActions } from "../src/gitActions";
import { withCleanup } from "./helpers/cleanup";
import { createSimpleGitTestContext } from "./helpers/simpleGit";

const { confirm } = vi.hoisted(() => ({
    confirm: vi.fn<() => Promise<string | undefined>>(),
}));

vi.mock("../src/ui/modals/generalModal", () => ({
    GeneralModal: class {
        openAndGetResult = confirm;
    },
}));

describe("GitActions.deleteRepository", () => {
    beforeEach(() => {
        confirm.mockReset().mockResolvedValue("YES");
    });

    async function createContext(basePath = "") {
        const context = withCleanup(
            await createSimpleGitTestContext({
                getVaultOptions: (repo) => {
                    repo.write("obsidian/vault/note.md", "vault note\n");
                    return {
                        vaultPath: path.join(repo.repoPath, "obsidian/vault"),
                        basePath,
                    };
                },
            })
        );
        const { plugin } = context;
        plugin.displayMessage = vi.fn();
        plugin.unloadPlugin = vi.fn();
        plugin.init = vi.fn<typeof plugin.init>().mockResolvedValue(undefined);
        return { ...context, actions: new GitActions(plugin) };
    }

    it.each(["", "../.."])(
        "deletes the detected parent repository with basePath %j",
        async (basePath) => {
            const { repo, plugin, actions } = await createContext(basePath);

            await expect(actions.deleteRepository()).resolves.toEqual({
                status: "success",
                value: { status: "deleted" },
            });

            expect(confirm).toHaveBeenCalledOnce();
            expect(existsSync(path.join(repo.repoPath, ".git"))).toBe(false);
            expect(
                readFileSync(
                    path.join(repo.repoPath, "obsidian/vault/note.md"),
                    "utf8"
                )
            ).toBe("vault note\n");
            expect(
                readFileSync(path.join(repo.repoPath, "note.md"), "utf8")
            ).toBe("base\n");
            expect(plugin.unloadPlugin).toHaveBeenCalledOnce();
            expect(plugin.init).toHaveBeenCalledWith({ fromReload: true });
        }
    );

    it("preserves the repository when confirmation is declined", async () => {
        const { repo, plugin, actions } = await createContext();
        confirm.mockResolvedValue("NO");

        await expect(actions.deleteRepository()).resolves.toEqual({
            status: "success",
            value: { status: "cancelled" },
        });

        expect(confirm).toHaveBeenCalledOnce();
        expect(existsSync(path.join(repo.repoPath, ".git"))).toBe(true);
        expect(plugin.unloadPlugin).not.toHaveBeenCalled();
        expect(plugin.init).not.toHaveBeenCalled();
    });
});
