import { setTimeout } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withCleanup } from "../helpers/cleanup";
import { createRepoWithOrigin } from "../helpers/gitRepo";
import { createIsomorphicGitManager } from "../helpers/isomorphicGit";

afterEach(() => vi.restoreAllMocks());

describe("IsomorphicGit history memory", () => {
    it("does not load separate packfile caches concurrently for history entries", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        for (let i = 0; i < 4; i++) {
            await repo.appendAndCommit("note.md", `${i}\n`, `commit ${i}`);
        }
        await repo.raw(["gc", "--prune=now"]);
        const { manager, plugin } = createIsomorphicGitManager(repo.repoPath);
        const adapter = plugin.app.vault.adapter;
        const read = adapter.readBinary.bind(adapter);
        let active = 0;
        let peak = 0;
        let packReads = 0;
        vi.spyOn(adapter, "readBinary").mockImplementation(async (file) => {
            if (!file.endsWith(".pack")) return read(file);
            packReads++;
            active++;
            peak = Math.max(peak, active);
            try {
                const data = await read(file);
                await setTimeout(5);
                return data;
            } finally {
                active--;
            }
        });

        const logs = await manager.log(undefined, false, 4);
        expect(logs.map((log) => log.message.trim())).toEqual([
            "commit 3",
            "commit 2",
            "commit 1",
            "commit 0",
        ]);
        expect(logs.every((log) => log.diff.files.length === 1)).toBe(true);
        expect(peak).toBe(1);
        expect(packReads).toBe(1);

        await repo.appendAndCommit("note.md", "next\n", "next commit");
        const nextLogs = await manager.log(undefined, false, 1);
        expect(nextLogs[0]?.message.trim()).toBe("next commit");
        // The cache belongs to a single request, so it cannot retain a large
        // packfile indefinitely or return stale history after another commit.
        expect(packReads).toBe(2);
    }, 15000);
});
