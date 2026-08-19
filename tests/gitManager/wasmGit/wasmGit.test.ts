import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { WasmGit } from "../../../src/gitManager/wasmGit/wasmGit";
import {
    NoNetworkError,
    UserCanceledError,
    type ObsidianGitSettings,
} from "../../../src/types";
import { withCleanup } from "../../helpers/cleanup";
import {
    createWasmGitPlugin,
    type WasmGitFakePlugin,
} from "../../helpers/createWasmGitPlugin";
import {
    git,
    gitCommitCount,
    gitIsClean,
    gitIsRepo,
    gitStaged,
    gitTags,
    gitUntracked,
} from "../../helpers/gitCli";
import { FsVaultAdapter } from "../../helpers/fsVaultAdapter";
import { startGitHttpServer } from "../../helpers/gitHttpServer";
import {
    cleanupTempDirectory,
    createTempDirectory,
} from "../../helpers/gitRepo";

/**
 * The interactive credential prompts are replaced with a queue so auth-retry
 * flows can be tested without a DOM.
 */
const modalQueue: (string | undefined)[] = [];
vi.mock("../../../src/ui/modals/generalModal", () => ({
    GeneralModal: class {
        openAndGetResult(): Promise<string | undefined> {
            return Promise.resolve(modalQueue.shift());
        }
    },
}));

type VaultFixture = {
    dir: string;
    adapter: FsVaultAdapter;
    plugin: WasmGitFakePlugin;
    manager: WasmGit;
};

function createVault(args?: {
    settings?: Partial<ObsidianGitSettings>;
    username?: string;
    password?: string;
}): VaultFixture {
    const dir = createTempDirectory("obsidian-git-wasm-test-");
    const adapter = new FsVaultAdapter(dir);
    const plugin = createWasmGitPlugin({ adapter, ...args });
    const manager = new WasmGit(plugin);
    withCleanup({
        cleanup: () => {
            manager.unload();
            cleanupTempDirectory(dir);
        },
    });
    return { dir, adapter, plugin, manager };
}

/** Initializes a repo with one pushed base commit using native git. */
async function seedRepo(vault: VaultFixture): Promise<void> {
    await git(vault.dir, ["init", "--initial-branch=main", "."]);
    await git(vault.dir, ["config", "user.name", "Test User"]);
    await git(vault.dir, ["config", "user.email", "test@example.com"]);
    writeFileSync(path.join(vault.dir, "note.md"), "base\n");
    await git(vault.dir, ["add", "note.md"]);
    await git(vault.dir, ["commit", "-m", "base"]);
}

type RemoteFixture = {
    url: string;
    remotePath: string;
    /** Commits a file to the remote through a native side clone. */
    commitToRemote(filePath: string, content: string): Promise<void>;
    readFromRemote(ref: string): Promise<string>;
};

async function createHttpRemote(credentials?: {
    username: string;
    password: string;
}): Promise<RemoteFixture> {
    const rootDir = createTempDirectory("obsidian-git-wasm-remote-");
    const remotePath = path.join(rootDir, "remote.git");
    await git(rootDir, ["init", "--bare", "--initial-branch=main", remotePath]);
    await git(remotePath, ["config", "http.receivepack", "true"]);
    const server = await startGitHttpServer(rootDir, credentials);
    withCleanup({
        cleanup: () => {
            void server.close();
            cleanupTempDirectory(rootDir);
        },
    });

    const sideCloneDir = path.join(rootDir, "side-clone");
    let cloned = false;
    return {
        url: `${server.url}/remote.git`,
        remotePath,
        commitToRemote: async (filePath, content) => {
            if (!cloned) {
                await git(rootDir, ["clone", remotePath, sideCloneDir]);
                await git(sideCloneDir, ["config", "user.name", "Remote User"]);
                await git(sideCloneDir, [
                    "config",
                    "user.email",
                    "remote@example.com",
                ]);
                cloned = true;
            } else {
                await git(sideCloneDir, ["pull"]);
            }
            mkdirSync(path.dirname(path.join(sideCloneDir, filePath)), {
                recursive: true,
            });
            writeFileSync(path.join(sideCloneDir, filePath), content);
            await git(sideCloneDir, ["add", filePath]);
            await git(sideCloneDir, ["commit", "-m", `remote: ${filePath}`]);
            await git(sideCloneDir, ["push", "--quiet"]);
        },
        readFromRemote: async (ref) => git(remotePath, ["show", ref]),
    };
}

/** Seeds the vault and connects it to an HTTP remote with upstream set. */
async function seedRepoWithRemote(
    vault: VaultFixture,
    remote: RemoteFixture
): Promise<void> {
    await seedRepo(vault);
    await git(vault.dir, ["remote", "add", "origin", remote.url]);
    await git(vault.dir, ["push", "--quiet", "-u", "origin", "main"]);
}

describe("WasmGit.checkRequirements and init", () => {
    it("reports missing-repo for an empty vault and valid after init", async () => {
        const vault = createVault();
        expect(await vault.manager.checkRequirements()).toBe("missing-repo");

        await vault.manager.init();

        expect(await vault.manager.checkRequirements()).toBe("valid");
        expect(await vault.adapter.exists(".git/HEAD")).toBe(true);
        // The repository layout is valid for native git too.
        expect(await gitIsRepo(vault.dir)).toBe(true);
        expect(await gitIsClean(vault.dir)).toBe(true);
    });
});

describe("WasmGit.status", () => {
    it("reports untracked, modified, and staged files", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "changed\n");
        writeFileSync(path.join(vault.dir, "untracked.md"), "new\n");
        writeFileSync(path.join(vault.dir, "staged.md"), "staged\n");
        await git(vault.dir, ["add", "staged.md"]);

        const status = await vault.manager.status();

        const byPath = Object.fromEntries(
            status.all.map((file) => [file.path, file])
        );
        expect(byPath["note.md"]).toMatchObject({
            index: " ",
            workingDir: "M",
        });
        expect(byPath["untracked.md"]).toMatchObject({
            index: "U",
            workingDir: "U",
        });
        expect(byPath["staged.md"]).toMatchObject({ index: "A" });
        expect(status.changed.map((file) => file.path).sort()).toEqual([
            "note.md",
            "untracked.md",
        ]);
        expect(status.staged.map((file) => file.path)).toEqual(["staged.md"]);
        expect(status.conflicted).toEqual([]);
    });

    it("lists files individually inside untracked directories", async () => {
        const vault = createVault();
        await seedRepo(vault);
        mkdirSync(path.join(vault.dir, "newdir"));
        writeFileSync(path.join(vault.dir, "newdir/a.md"), "a\n");
        writeFileSync(path.join(vault.dir, "newdir/b.md"), "b\n");

        const status = await vault.manager.status();

        expect(status.changed.map((file) => file.path).sort()).toEqual([
            "newdir/a.md",
            "newdir/b.md",
        ]);
    });
});

describe("WasmGit staging", () => {
    it("stages and unstages a single file", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "new.md"), "new\n");

        await vault.manager.stage("new.md", true);
        expect((await gitStaged(vault.dir)).join("\n")).toBe("new.md");

        await vault.manager.unstage("new.md", true);
        expect((await gitStaged(vault.dir)).join("\n")).toBe("");
        expect(await gitUntracked(vault.dir)).toContain("new.md");
    });

    it("stages deletions", async () => {
        const vault = createVault();
        await seedRepo(vault);
        await vault.adapter.remove("note.md");

        await vault.manager.stage("note.md", true);

        expect(await gitStaged(vault.dir)).toEqual(["note.md"]);
    });

    it("stageAll stages everything including deletions", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "added.md"), "added\n");
        writeFileSync(path.join(vault.dir, "note.md"), "modified\n");

        await vault.manager.stageAll({});

        const staged = (
            await git(vault.dir, ["diff", "--cached", "--name-only"])
        )
            .trim()
            .split("\n")
            .sort();
        expect(staged).toEqual(["added.md", "note.md"]);
    });

    it("unstageAll clears the whole index", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "one.md"), "1\n");
        writeFileSync(path.join(vault.dir, "two.md"), "2\n");
        await vault.manager.stageAll({});

        await vault.manager.unstageAll({});

        expect((await gitStaged(vault.dir)).join("\n")).toBe("");
    });

    it("keeps other files staged when unstaging one", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "one.md"), "1\n");
        writeFileSync(path.join(vault.dir, "two.md"), "2\n");
        await vault.manager.stageAll({});

        await vault.manager.unstage("one.md", true);

        expect((await gitStaged(vault.dir)).join("\n")).toBe("two.md");
    });

    it("discards working tree changes of a tracked file", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "dirty\n");

        await vault.manager.discard("note.md");

        expect(await vault.adapter.read("note.md")).toBe("base\n");
    });

    it("getUntrackedPaths collapses fully untracked directories", async () => {
        const vault = createVault();
        await seedRepo(vault);
        mkdirSync(path.join(vault.dir, "newdir"));
        writeFileSync(path.join(vault.dir, "newdir/a.md"), "a\n");
        writeFileSync(path.join(vault.dir, "loose.md"), "loose\n");

        const untracked = await vault.manager.getUntrackedPaths({});

        expect(untracked.sort()).toEqual(["loose.md", "newdir/"]);
    });
});

describe("WasmGit.commit", () => {
    it("commits staged changes only", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "staged.md"), "staged\n");
        writeFileSync(path.join(vault.dir, "unstaged.md"), "unstaged\n");
        await vault.manager.stage("staged.md", true);

        const changed = await vault.manager.commit({ message: "staged only" });

        expect(changed).toBe(1);
        expect(
            (await git(vault.dir, ["log", "-1", "--pretty=%s"])).trim()
        ).toBe("staged only");
        expect(await gitUntracked(vault.dir)).toContain("unstaged.md");
    });

    it("commitAll stages and commits everything", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "changed\n");
        writeFileSync(path.join(vault.dir, "new.md"), "new\n");

        const changed = await vault.manager.commitAll({
            message: "commit all",
        });

        expect(changed).toBe(2);
        expect(await gitIsClean(vault.dir)).toBe(true);
        expect((await git(vault.dir, ["show", "HEAD:note.md"])).trim()).toBe(
            "changed"
        );
    });

    it("returns 0 and creates no commit when nothing is staged", async () => {
        const vault = createVault();
        await seedRepo(vault);
        const headBefore = (await git(vault.dir, ["rev-parse", "HEAD"])).trim();

        const changed = await vault.manager.commit({ message: "empty" });

        expect(changed).toBe(0);
        expect((await git(vault.dir, ["rev-parse", "HEAD"])).trim()).toBe(
            headBefore
        );
    });

    it("amends the previous commit", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "second.md"), "second\n");
        await vault.manager.commitAll({ message: "second" });
        writeFileSync(path.join(vault.dir, "second.md"), "second amended\n");
        await vault.manager.stage("second.md", true);

        await vault.manager.commit({ message: "second, amended", amend: true });

        expect(
            (await git(vault.dir, ["log", "-1", "--pretty=%s"])).trim()
        ).toBe("second, amended");
        expect(
            (await git(vault.dir, ["rev-list", "--count", "HEAD"])).trim()
        ).toBe("2");
        expect((await git(vault.dir, ["show", "HEAD:second.md"])).trim()).toBe(
            "second amended"
        );
    });

    it("fails with a clear error when the author is not configured", async () => {
        const vault = createVault();
        await git(vault.dir, ["init", "--initial-branch=main", "."]);
        writeFileSync(path.join(vault.dir, "a.md"), "a\n");

        await expect(
            vault.manager.commitAll({ message: "no author" })
        ).rejects.toThrow(/author name and email/);
    });
});

describe("WasmGit history", () => {
    it("log returns commits with messages, authors, and changed files", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "second.md"), "content\n");
        await vault.manager.commitAll({ message: "add second" });

        const log = await vault.manager.log(undefined, false, 10);

        expect(log).toHaveLength(2);
        expect(log[0]!.message).toBe("add second");
        expect(log[0]!.author.name).toBe("Test User");
        expect(log[0]!.diff.files.map((file) => file.path)).toEqual([
            "second.md",
        ]);
        expect(log[1]!.message).toBe("base");
    });

    it("log can be limited to one file", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "other.md"), "other\n");
        await vault.manager.commitAll({ message: "add other" });

        const log = await vault.manager.log("note.md", false, 10);

        expect(log).toHaveLength(1);
        expect(log[0]!.message).toBe("base");
    });

    it("revParse and catFileCommit expose commit metadata", async () => {
        const vault = createVault();
        await seedRepo(vault);

        const head = await vault.manager.revParse("HEAD");
        expect(head).toMatch(/^[0-9a-f]{40}$/);

        const commit = await vault.manager.catFileCommit(head!);
        expect(commit!.author.name).toBe("Test User");
        expect(commit!.message.trim()).toBe("base");
    });

    it("getLastCommitTime returns the committer time", async () => {
        const vault = createVault();
        await seedRepo(vault);

        const time = await vault.manager.getLastCommitTime();

        expect(time).toBeInstanceOf(Date);
        expect(Math.abs(Date.now() - time!.getTime())).toBeLessThan(60_000);
    });

    it("getDiffString returns working tree, staged, and commit diffs", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "base\nworking\n");

        const workingDiff = await vault.manager.getDiffString("note.md", false);
        expect(workingDiff).toContain("+working");

        await vault.manager.stage("note.md", true);
        const stagedDiff = await vault.manager.getDiffString("note.md", true);
        expect(stagedDiff).toContain("+working");

        await vault.manager.commit({ message: "working" });
        const head = await vault.manager.revParse("HEAD");
        const commitDiff = await vault.manager.getDiffString(
            "note.md",
            false,
            head
        );
        expect(commitDiff).toContain("+working");
    });

    it("getDiffString synthesizes a patch for files of the root commit", async () => {
        const vault = createVault();
        await seedRepo(vault);
        const head = await vault.manager.revParse("HEAD");

        const diff = await vault.manager.getDiffString("note.md", false, head);

        expect(diff).toContain("new file");
        expect(diff).toContain("+base");
    });

    it("blame maps lines to commits", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "base\nsecond line\n");
        await vault.manager.commitAll({ message: "second line" });

        const blame = await vault.manager.blame("note.md");

        expect(blame).not.toBe("untracked");
        if (blame === "untracked") return;
        expect(blame.hashPerLine).toHaveLength(3);
        expect(blame.commits.size).toBe(2);
        const firstHash = blame.hashPerLine[1]!;
        const secondHash = blame.hashPerLine[2]!;
        expect(firstHash).not.toBe(secondHash);
        expect(blame.commits.get(firstHash)!.summary).toBe("base");
    });

    it("isTracked and show read index and commit blobs", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "new.md"), "untracked");

        expect(await vault.manager.isTracked("note.md")).toBe(true);
        expect(await vault.manager.isTracked("new.md")).toBe(false);
        expect(await vault.manager.show("HEAD", "note.md")).toBe("base");
        expect(await vault.manager.show("", "note.md")).toBe("base");
    });

    it("applyPatch stages a hunk without changing the working tree", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "base\nworking\n");

        const patch = [
            "diff --git a/note.md b/note.md",
            "index 000000..000000 100644",
            "--- a/note.md",
            "+++ b/note.md",
            "@@ -1,1 +1,2 @@",
            "-base",
            "+base",
            "+working",
            "",
        ].join("\n");
        await vault.manager.applyPatch(patch);

        expect(await gitStaged(vault.dir)).toEqual(["note.md"]);
        expect(readFileSync(path.join(vault.dir, "note.md"), "utf8")).toBe(
            "base\nworking\n"
        );
    });

    it("squashAllUnpushedCommits folds unpushed history", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "base\none\n");
        await vault.manager.commitAll({ message: "one" });
        writeFileSync(path.join(vault.dir, "note.md"), "base\none\ntwo\n");
        await vault.manager.commitAll({ message: "two" });

        // No tracking branch yet — squash is a no-op.
        await vault.manager.squashAllUnpushedCommits();
        expect(await gitCommitCount(vault.dir)).toBeGreaterThanOrEqual(3);
    });

    it("lsFiles lists tracked paths", async () => {
        const vault = createVault();
        await seedRepo(vault);

        expect(await vault.manager.lsFiles()).toEqual(["note.md"]);
    });
});

describe("WasmGit branches", () => {
    it("creates, switches, lists, and deletes branches", async () => {
        const vault = createVault();
        await seedRepo(vault);

        await vault.manager.createBranch("feature");
        let info = await vault.manager.branchInfo();
        expect(info.current).toBe("feature");
        expect(info.branches.sort()).toEqual(["feature", "main"]);

        writeFileSync(path.join(vault.dir, "feature.md"), "feature\n");
        await vault.manager.commitAll({ message: "feature work" });

        await vault.manager.checkout("main");
        info = await vault.manager.branchInfo();
        expect(info.current).toBe("main");
        expect(await vault.adapter.exists("feature.md")).toBe(false);

        expect(await vault.manager.branchIsMerged("feature")).toBe(false);
        await expect(
            vault.manager.deleteBranch("feature", false)
        ).rejects.toThrow(/not fully merged/);

        await vault.manager.deleteBranch("feature", true);
        info = await vault.manager.branchInfo();
        expect(info.branches).toEqual(["main"]);
    });

    it("refuses to delete the checked out branch", async () => {
        const vault = createVault();
        await seedRepo(vault);

        await expect(vault.manager.deleteBranch("main", true)).rejects.toThrow(
            /checked out/
        );
    });
});

describe("WasmGit config and remotes", () => {
    it("sets, gets, and unsets config values", async () => {
        const vault = createVault();
        await seedRepo(vault);

        await vault.manager.setConfig("core.testvalue", "hello");
        expect(await vault.manager.getConfig("core.testvalue")).toBe("hello");
        expect(
            (await git(vault.dir, ["config", "core.testvalue"])).trim()
        ).toBe("hello");

        await vault.manager.setConfig("core.testvalue", undefined);
        expect(await vault.manager.getConfig("core.testvalue")).toBeUndefined();
    });

    it("manages remotes", async () => {
        const vault = createVault();
        await seedRepo(vault);

        await vault.manager.setRemote("origin", "https://example.com/a.git");
        expect(await vault.manager.getRemotes()).toEqual(["origin"]);
        expect(await vault.manager.getRemoteUrl("origin")).toBe(
            "https://example.com/a.git"
        );

        await vault.manager.setRemote("origin", "https://example.com/b.git");
        expect(await vault.manager.getRemoteUrl("origin")).toBe(
            "https://example.com/b.git"
        );

        await vault.manager.removeRemote("origin");
        expect(await vault.manager.getRemotes()).toEqual([]);
    });
});

describe("WasmGit networking", () => {
    it("clones a repository over HTTP into the vault", async () => {
        const remote = await createHttpRemote();
        await remote.commitToRemote("readme.md", "hello from remote\n");
        const vault = createVault();

        await vault.manager.clone(remote.url, ".");

        expect(await vault.adapter.read("readme.md")).toBe(
            "hello from remote\n"
        );
        expect(await vault.manager.checkRequirements()).toBe("valid");
        const info = await vault.manager.branchInfo();
        expect(info.current).toBe("main");
        // The clone is a fully valid repository for native git too.
        expect(await gitIsClean(vault.dir)).toBe(true);
    });

    it("fetches and reports unpushed commits and pushability", async () => {
        const remote = await createHttpRemote();
        const vault = createVault();
        await seedRepoWithRemote(vault, remote);

        expect(await vault.manager.getUnpushedCommits()).toBe(0);
        expect(await vault.manager.canPush()).toBe(false);

        writeFileSync(path.join(vault.dir, "local.md"), "local\n");
        await vault.manager.commitAll({ message: "local work" });

        expect(await vault.manager.getUnpushedCommits()).toBe(1);
        expect(await vault.manager.canPush()).toBe(true);
    });

    it("pushes local commits to the remote", async () => {
        const remote = await createHttpRemote();
        const vault = createVault();
        await seedRepoWithRemote(vault, remote);
        writeFileSync(path.join(vault.dir, "pushed.md"), "pushed\n");
        await vault.manager.commitAll({ message: "to push" });

        const pushed = await vault.manager.push();

        expect(pushed).toBe(1);
        expect(await remote.readFromRemote("main:pushed.md")).toBe("pushed");
    });

    it("pulls remote commits into the vault", async () => {
        const remote = await createHttpRemote();
        const vault = createVault();
        await seedRepoWithRemote(vault, remote);
        await remote.commitToRemote("from-remote.md", "incoming\n");

        const pulled = await vault.manager.pull();

        expect(pulled!.map((file) => file.path)).toEqual(["from-remote.md"]);
        expect(await vault.adapter.read("from-remote.md")).toBe("incoming\n");
        expect(await gitIsClean(vault.dir)).toBe(true);
    });

    it("merges diverged histories on pull", async () => {
        const remote = await createHttpRemote();
        const vault = createVault();
        await seedRepoWithRemote(vault, remote);
        await remote.commitToRemote("remote-side.md", "remote\n");
        writeFileSync(path.join(vault.dir, "local-side.md"), "local\n");
        await vault.manager.commitAll({ message: "local side" });

        await vault.manager.pull();

        expect(await vault.adapter.read("remote-side.md")).toBe("remote\n");
        expect(await vault.adapter.exists("local-side.md")).toBe(true);
        // A merge commit joins both sides.
        expect(
            (
                await git(vault.dir, [
                    "rev-list",
                    "--merges",
                    "--count",
                    "HEAD",
                ])
            ).trim()
        ).toBe("1");
    });

    it("auto-resolves conflicts with the theirs strategy", async () => {
        const remote = await createHttpRemote();
        const vault = createVault({ settings: { mergeStrategy: "theirs" } });
        await seedRepoWithRemote(vault, remote);
        await remote.commitToRemote("note.md", "remote version\n");
        writeFileSync(path.join(vault.dir, "note.md"), "local version\n");
        await vault.manager.commitAll({ message: "local version" });

        await vault.manager.pull();

        expect(await vault.adapter.read("note.md")).toBe("remote version\n");
        expect(await gitIsClean(vault.dir)).toBe(true);
    });

    it("reports conflicts and leaves markers with the none strategy", async () => {
        const remote = await createHttpRemote();
        const vault = createVault({ settings: { mergeStrategy: "none" } });
        await seedRepoWithRemote(vault, remote);
        await remote.commitToRemote("note.md", "remote version\n");
        writeFileSync(path.join(vault.dir, "note.md"), "local version\n");
        await vault.manager.commitAll({ message: "local version" });

        await expect(vault.manager.pull()).rejects.toThrow(/conflict/i);

        expect(vault.plugin.handleConflict).toHaveBeenCalledWith(["note.md"]);
        expect(vault.plugin.localStorage.getConflict()).toBe(true);
        const conflicted = await vault.adapter.read("note.md");
        expect(conflicted).toContain("<<<<<<<");
        expect(conflicted).toContain("local version");
        expect(conflicted).toContain("remote version");
    });

    it("throws NoNetworkError when the remote is unreachable", async () => {
        const vault = createVault();
        await seedRepo(vault);
        await git(vault.dir, [
            "remote",
            "add",
            "origin",
            "http://127.0.0.1:9/dead.git",
        ]);
        await git(vault.dir, ["config", "branch.main.remote", "origin"]);
        await git(vault.dir, [
            "config",
            "branch.main.merge",
            "refs/heads/main",
        ]);
        writeFileSync(path.join(vault.dir, "x.md"), "x\n");
        await vault.manager.commitAll({ message: "x" });

        await expect(vault.manager.push()).rejects.toBeInstanceOf(
            NoNetworkError
        );
    });

    it("getRemoteBranches lists branches over HTTP", async () => {
        const remote = await createHttpRemote();
        const vault = createVault();
        await seedRepoWithRemote(vault, remote);

        expect(await vault.manager.getRemoteBranches("origin")).toEqual([
            "origin/main",
        ]);
    });
});

describe("WasmGit authentication", () => {
    it("sends stored credentials", async () => {
        const remote = await createHttpRemote({
            username: "alice",
            password: "secret",
        });
        await remote.commitToRemote("auth.md", "authorized\n");
        const vault = createVault({ username: "alice", password: "secret" });

        await vault.manager.clone(remote.url, ".");

        expect(await vault.adapter.read("auth.md")).toBe("authorized\n");
    });

    it("throws UserCanceledError when the credential prompt is canceled", async () => {
        const remote = await createHttpRemote({
            username: "alice",
            password: "secret",
        });
        await remote.commitToRemote("auth.md", "authorized\n");
        const vault = createVault({ username: "alice", password: "wrong" });
        modalQueue.length = 0;
        modalQueue.push(undefined); // cancel the username prompt

        await expect(
            vault.manager.clone(remote.url, ".")
        ).rejects.toBeInstanceOf(UserCanceledError);
    });

    it("retries with newly prompted credentials and stores them", async () => {
        const remote = await createHttpRemote({
            username: "alice",
            password: "secret",
        });
        await remote.commitToRemote("auth.md", "authorized\n");
        const vault = createVault({ username: "alice", password: "wrong" });
        modalQueue.length = 0;
        modalQueue.push("alice", "secret");

        await vault.manager.clone(remote.url, ".");

        expect(await vault.adapter.read("auth.md")).toBe("authorized\n");
        expect(vault.plugin.storage.get("password")).toBe("secret");
    });
});

describe("WasmGit extended features", () => {
    it("stashes and pops changes", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "stash me\n");

        await vault.manager.stashPush();
        expect(await vault.adapter.read("note.md")).toBe("base\n");
        expect(await vault.manager.stashList()).toHaveLength(1);

        await vault.manager.stashPop();
        expect(await vault.adapter.read("note.md")).toBe("stash me\n");
        expect(await vault.manager.stashList()).toHaveLength(0);
    });

    it("applies and drops stashes by index", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "note.md"), "stashed\n");
        await vault.manager.stashPush();

        await vault.manager.stashApply(0);
        expect(await vault.adapter.read("note.md")).toBe("stashed\n");
        expect(await vault.manager.stashList()).toHaveLength(1);

        await vault.manager.discard("note.md");
        await vault.manager.stashDrop(0);
        expect(await vault.manager.stashList()).toHaveLength(0);
    });

    it("creates, lists, describes, and deletes tags", async () => {
        const vault = createVault();
        await seedRepo(vault);

        await vault.manager.tagCreate("v1.0.0");
        expect(await vault.manager.tagList()).toEqual(["v1.0.0"]);
        expect(await vault.manager.describe()).toBe("v1.0.0");
        expect(await gitTags(vault.dir)).toEqual(["v1.0.0"]);

        await vault.manager.tagDelete("v1.0.0");
        expect(await vault.manager.tagList()).toEqual([]);
    });

    it("reverts a commit and stages the revert", async () => {
        const vault = createVault();
        await seedRepo(vault);
        writeFileSync(path.join(vault.dir, "revert-me.md"), "temp\n");
        await vault.manager.commitAll({ message: "to be reverted" });
        const hash = await vault.manager.revParse("HEAD");

        await vault.manager.revert(hash!);

        expect(await vault.adapter.exists("revert-me.md")).toBe(false);
        expect((await gitStaged(vault.dir)).join("\n")).toBe("revert-me.md");
        // A follow-up commit works (no sequencer state left behind).
        await vault.manager.commit({ message: "revert commit" });
        expect(await gitIsClean(vault.dir)).toBe(true);
    });

    it("runs raw commands and returns their output", async () => {
        const vault = createVault();
        await seedRepo(vault);

        const output = await vault.manager.rawCommand("rev-parse HEAD");
        expect(output.trim()).toMatch(/^[0-9a-f]{40}$/);

        const errorOutput = await vault.manager.rawCommand("no-such-command");
        expect(errorOutput.length).toBeGreaterThan(0);
    });
});
