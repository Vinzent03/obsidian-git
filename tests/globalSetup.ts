import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

/**
 * Isolate the temporary test repositories from the machine's system and
 * global Git config. Otherwise settings such as Git for Windows' default
 * `core.autocrlf=true` leak into the fixtures and change their behavior.
 * Test workers, the fixtures and the plugin's simple-git instance all inherit
 * these variables.
 */
export default function setup(): () => void {
    const dir = mkdtempSync(path.join(tmpdir(), "obsidian-git-test-config-"));
    const emptyGlobalGitConfig = path.join(dir, "gitconfig");
    writeFileSync(emptyGlobalGitConfig, "");
    process.env.GIT_CONFIG_NOSYSTEM = "1";
    process.env.GIT_CONFIG_GLOBAL = emptyGlobalGitConfig;

    return () => rmSync(dir, { recursive: true, force: true });
}
