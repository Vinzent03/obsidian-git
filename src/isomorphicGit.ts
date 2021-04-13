import git from 'isomorphic-git';
import { App } from 'obsidian';
import { GitManager, Status } from "./gitManager";

export class IsomorphicGit implements GitManager {
    fs: any;
    dir: string;
    app: App;
    constructor(app: App) {
        this.app = app;
        this.fs = (this.app.vault.adapter as any).fs;

        this.dir = decodeURIComponent(this.app.vault.adapter.getResourcePath("").replace("app://local/", ""));
        this.dir = this.dir.substring(0, this.dir.indexOf("?"));
    }

    async status(): Promise<Status> {
        const status = await git.statusMatrix({
            fs: this.fs,
            dir: this.dir,
        });
        const FILE = 0, HEAD = 1, WORKDIR = 2, STAGE = 3;

        const changed = status.filter(row => row[HEAD] !== row[WORKDIR]).map(row => row[FILE]);
        const staged = status.filter(row => row[STAGE] === 3 || row[STAGE] === 2).map(row => row[FILE]);

        return {
            changed: changed,
            staged: staged,
        };
    }


}