import git from 'isomorphic-git';
import { GitManager } from "./gitManager";
import ObsidianGit from './main';
import { Author, FileStatusResult, Status } from './types';

export class IsomorphicGit extends GitManager {
    private fs: any;
    private dir: string;
    author: Author;
    readonly FILE = 0;
    readonly HEAD = 1;
    readonly WORKDIR = 2;
    readonly STAGE = 3;
    readonly indexes = {
        "000": "",
        "003": "AD",
        "020": "??",
        "022": "A",
        "023": "AM",
        "100": "D ",
        "101": " D",
        "103": "MD",
        "110": "D ??",
        "111": "",
        "120": "D ??",
        "121": " M",
        "122": "M ",
        "123": "MM"
    };

    constructor(plugin: ObsidianGit, author: Author) {
        super(plugin);
        this.fs = (this.app.vault.adapter as any).fs;
        this.author = author;
        this.dir = decodeURIComponent(this.app.vault.adapter.getResourcePath("").replace("app://local/", ""));
        this.dir = this.dir.substring(0, this.dir.indexOf("?"));
    }

    async status(): Promise<Status> {
        const status = await git.statusMatrix({
            fs: this.fs,
            dir: this.dir,
        });

        const changed: FileStatusResult[] = status.filter(row => row[this.HEAD] !== row[this.WORKDIR]).map(row => this.getFileStatusResult(row));
        const staged = status.filter(row => row[this.STAGE] === 3 || row[this.STAGE] === 2).map(row => row[this.FILE]);

        return {
            changed: changed,
            staged: staged,
        };
    }

    async commit(message?: string): Promise<void> {
        const repo = {
            fs: this.fs,
            dir: this.dir
        };
        const status = await git.statusMatrix(repo);
        await Promise.all(
            status.map(([filepath, , worktreeStatus]) =>
                worktreeStatus ? git.add({ ...repo, filepath }) : git.remove({ ...repo, filepath })
            )
        );
        const formatMessage = message ?? await this.formatCommitMessage();

        await git.commit({
            ...repo,
            author: this.author,
            message: formatMessage
        });
    }

    getFileStatusResult(row: [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3]): FileStatusResult {
        const index = (this.indexes as any)[`${row[this.HEAD]}${row[this.WORKDIR]}${row[this.STAGE]}`];

        return { index: index, path: row[this.FILE] };
    }
}