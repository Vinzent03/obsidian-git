import type { FileStatusResult, Status } from "./types";

export interface RenameHint {
    from: string;
    to: string;
}

export interface RenameReconcileContext {
    pathExists(path: string): Promise<boolean>;
    getIndexPaths(): Promise<ReadonlySet<string>>;
    getVaultPath(path: string): string;
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isUntracked(file: FileStatusResult): boolean {
    return file.index === "U" && file.workingDir === "U";
}

function combineIndexStatus(
    source: FileStatusResult,
    destination: FileStatusResult
): string {
    if (source.index === "D" && destination.index === "A") return "R";
    if (destination.index !== " " && destination.index !== "U") {
        return destination.index;
    }
    if (source.index !== " " && source.index !== "U") return source.index;
    return source.index === "U" ? destination.index : " ";
}

function combineWorkingTreeStatus(
    source: FileStatusResult,
    destination: FileStatusResult
): string {
    if (source.workingDir === "D" && isUntracked(destination)) return "R";
    if (destination.workingDir !== " " && destination.workingDir !== "U") {
        return destination.workingDir;
    }
    if (source.workingDir !== " " && source.workingDir !== "U") {
        return source.workingDir;
    }
    if (destination.workingDir === "U") return "U";
    return source.workingDir === "U" ? "U" : " ";
}

/**
 * Tracks exact rename events reported by Obsidian until Git records them.
 *
 * Git stores snapshots rather than rename metadata. Before both paths are
 * staged, a rename is normally reported as a deletion plus an untracked file.
 * This class preserves the exact user action so source-control operations can
 * treat both paths atomically without relying on similarity heuristics.
 */
export class RenameTracker {
    private readonly sourcesByDestination = new Map<string, string>();
    private readonly destinationsBySource = new Map<string, string>();

    constructor(
        initialHints: RenameHint[] = [],
        private readonly saveHints: (hints: RenameHint[]) => void = () => {}
    ) {
        for (const hint of initialHints) {
            if (typeof hint.from === "string" && typeof hint.to === "string") {
                const from = normalizePath(hint.from);
                const to = normalizePath(hint.to);
                if (from !== to) this.setHint(from, to);
            }
        }
    }

    get hasHints(): boolean {
        return this.sourcesByDestination.size > 0;
    }

    getSource(destination: string): string | undefined {
        return this.sourcesByDestination.get(normalizePath(destination));
    }

    getDestination(source: string): string | undefined {
        return this.destinationsBySource.get(normalizePath(source));
    }

    getHints(): RenameHint[] {
        return [...this.sourcesByDestination].map(([to, from]) => ({
            from,
            to,
        }));
    }

    record(from: string, to: string): void {
        this.recordMany([{ from, to }]);
    }

    recordMany(hints: RenameHint[]): void {
        let changed = false;
        for (const hint of hints) {
            const to = normalizePath(hint.to);
            let from = normalizePath(hint.from);
            if (from === to) continue;

            const originalSource = this.sourcesByDestination.get(from);
            if (originalSource != undefined) {
                this.deleteHint(from);
                changed = true;
                from = originalSource;
            }

            if (from === to) {
                changed = this.deleteHint(to) || changed;
                continue;
            }

            changed = this.setHint(from, to) || changed;
        }
        if (changed) this.persist();
    }

    forgetPath(path: string): void {
        path = normalizePath(path);
        const destination = this.destinationsBySource.get(path);
        let changed = this.deleteHint(path);
        if (destination != undefined) {
            changed = this.deleteHint(destination) || changed;
        }
        if (changed) this.persist();
    }

    async reconcile(
        status: Status,
        context: RenameReconcileContext
    ): Promise<Status> {
        if (!this.hasHints) return status;

        const files = status.all.map((file) => ({ ...file }));
        const byPath = new Map(files.map((file) => [file.path, file]));
        const conflicted = new Set(status.conflicted);
        const staleHints: string[] = [];
        let indexPaths: ReadonlySet<string> | undefined;

        const getIndexPaths = async () => {
            indexPaths ??= await context.getIndexPaths();
            return indexPaths;
        };

        for (const [to, from] of this.sourcesByDestination) {
            if (conflicted.has(from) || conflicted.has(to)) continue;
            let destination = byPath.get(to);
            let source = byPath.get(from);

            if (destination?.from != undefined) {
                const isNativeRename =
                    destination.index === "R" || destination.workingDir === "R";
                if (destination.from !== from || !isNativeRename) {
                    staleHints.push(to);
                }
                continue;
            }

            if (destination == undefined && !(await context.pathExists(to))) {
                staleHints.push(to);
                continue;
            }

            const index = await getIndexPaths();
            if (destination == undefined && index.has(to)) {
                staleHints.push(to);
                continue;
            }
            const sourceExists =
                source == undefined
                    ? await context.pathExists(from)
                    : source.workingDir !== "D" &&
                      !(source.index === "D" && source.workingDir === " ");
            if (sourceExists && index.has(from)) {
                staleHints.push(to);
                continue;
            }
            const hasRawChange =
                source != undefined || destination != undefined;
            const sourceWasTracked = index.has(from) || source?.index === "D";
            const isPendingUnstagedRename =
                !hasRawChange && index.has(from) && !index.has(to);

            if (
                !sourceWasTracked ||
                (!hasRawChange && !isPendingUnstagedRename)
            ) {
                staleHints.push(to);
                continue;
            }

            if (destination == undefined) {
                destination = {
                    path: to,
                    vaultPath: context.getVaultPath(to),
                    index: "U",
                    workingDir: "U",
                };
                files.push(destination);
                byPath.set(to, destination);
            }

            if (source == undefined) {
                if (sourceExists) continue;
                const deletionIsStaged =
                    destination.index === "A" && !index.has(from);
                source = {
                    path: from,
                    vaultPath: context.getVaultPath(from),
                    index: deletionIsStaged ? "D" : " ",
                    workingDir: deletionIsStaged ? " " : "D",
                };
            }

            const sourceIsInStatus = byPath.has(from);
            const isUnstagedRename =
                source.index === " " &&
                source.workingDir === "D" &&
                isUntracked(destination);
            const isStagedRename =
                source.index === "D" &&
                source.workingDir === " " &&
                destination.index === "A";

            // Keep partially staged states split by path. In those states the
            // index and working tree have different destinations, which a
            // single FileStatusResult cannot represent faithfully.
            if (!isUnstagedRename && !isStagedRename) {
                if (!sourceIsInStatus) {
                    files.push(source);
                    byPath.set(from, source);
                }
                continue;
            }

            const combined: FileStatusResult = {
                ...destination,
                from,
                index: combineIndexStatus(source, destination),
                workingDir: combineWorkingTreeStatus(source, destination),
            };

            const destinationIndex = files.indexOf(destination);
            files[destinationIndex] = combined;
            byPath.set(to, combined);

            const sourceIndex = files.findIndex((file) => file.path === from);
            if (sourceIndex >= 0) files.splice(sourceIndex, 1);
            byPath.delete(from);
        }

        if (staleHints.length > 0) {
            for (const destination of staleHints) {
                this.deleteHint(destination);
            }
            this.persist();
        }

        const all = files.filter(
            (file) => file.index !== " " || file.workingDir !== " "
        );
        return {
            all,
            changed: all.filter((file) => file.workingDir !== " "),
            staged: all.filter(
                (file) => file.index !== " " && file.index !== "U"
            ),
            conflicted: status.conflicted,
        };
    }

    private persist(): void {
        this.saveHints(this.getHints());
    }

    private setHint(from: string, to: string): boolean {
        if (this.sourcesByDestination.get(to) === from) return false;

        const previousSource = this.sourcesByDestination.get(to);
        if (previousSource != undefined) {
            this.destinationsBySource.delete(previousSource);
        }
        const previousDestination = this.destinationsBySource.get(from);
        if (previousDestination != undefined) {
            this.sourcesByDestination.delete(previousDestination);
        }

        this.sourcesByDestination.set(to, from);
        this.destinationsBySource.set(from, to);
        return true;
    }

    private deleteHint(destination: string): boolean {
        const source = this.sourcesByDestination.get(destination);
        if (source == undefined) return false;

        this.sourcesByDestination.delete(destination);
        if (this.destinationsBySource.get(source) === destination) {
            this.destinationsBySource.delete(source);
        }
        return true;
    }
}

export function statusMatchesDirectory(
    file: FileStatusResult,
    directory?: string
): boolean {
    if (directory == undefined) return true;
    directory = normalizePath(directory).replace(/\/+$/, "");
    if (directory === "" || directory === ".") return true;
    const prefix = `${directory}/`;
    return (
        file.path === directory ||
        file.path.startsWith(prefix) ||
        file.from === directory ||
        file.from?.startsWith(prefix) === true
    );
}

export function pathMatchesDirectory(
    path: string,
    directory?: string
): boolean {
    if (directory == undefined) return true;
    path = normalizePath(path);
    directory = normalizePath(directory).replace(/\/+$/, "");
    if (directory === "" || directory === ".") return true;
    return path === directory || path.startsWith(`${directory}/`);
}
