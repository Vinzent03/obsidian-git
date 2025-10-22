export type HunkType = "add" | "change" | "delete";

export interface HunkNode {
    start: number;
    count: number;
    lines: string[];
    no_nl_at_eof?: true;
}

export interface Hunk {
    type: HunkType;
    head: string;
    added: HunkNode;
    removed: HunkNode;
    vend: number;
}

export type SignType = HunkType | "topdelete" | "changedelete" | "untracked";

export interface Sign {
    type: SignType;
    /// Number of lines added/removed. Only set on the first line of a hunk.
    count?: number;
    lnum: number;
}

export interface StatusObj {
    added: number;
    changed: number;
    removed: number;
}

export interface HlMark {
    start_row: number;
    hl_group: string;
    end_row?: number;
    start_col?: number;
    end_col?: number;
}

export type LineSpec = [[string, HlMark[], string?]];

export abstract class Hunks {
    static createHunk(
        oldStart: number,
        oldCount: number,
        newStart: number,
        newCount: number
    ): Hunk {
        return {
            removed: { start: oldStart, count: oldCount, lines: [] },
            added: { start: newStart, count: newCount, lines: [] },
            head:
                `@@ -${oldStart}${oldCount > 0 ? `,${oldCount}` : ""} ` +
                `+${newStart}${newCount > 0 ? `,${newCount}` : ""} @@`,
            vend: newStart + Math.max(newCount - 1, 0),
            type: newCount === 0 ? "delete" : oldCount === 0 ? "add" : "change",
        };
    }

    static createPartialHunk(
        hunks: Hunk[],
        top: number,
        bot: number
    ): Hunk | undefined {
        let pretop = top;
        let precount = bot - top + 1;
        let unused = 0;

        for (const h of hunks) {
            const addedInHunk = h.added.count - h.removed.count;
            let addedInRange = 0;

            if (h.added.start >= top && h.vend <= bot) {
                addedInRange = addedInHunk;
            } else {
                const addedAboveBot = Math.max(
                    0,
                    bot + 1 - (h.added.start + h.removed.count)
                );
                const addedAboveTop = Math.max(
                    0,
                    top - (h.added.start + h.removed.count)
                );

                if (h.added.start >= top && h.added.start <= bot) {
                    addedInRange = addedAboveBot;
                } else if (h.vend >= top && h.vend <= bot) {
                    addedInRange = addedInHunk - addedAboveTop;
                    pretop = pretop - addedAboveTop;
                } else if (h.added.start <= top && h.vend >= bot) {
                    addedInRange = addedAboveBot - addedAboveTop;
                    pretop = pretop - addedAboveTop;
                } else {
                    unused++;
                }

                if (top > h.vend) {
                    pretop = pretop - addedInHunk;
                }
            }

            precount = precount - addedInRange;
        }

        if (unused === hunks.length) {
            return undefined;
        }

        if (precount === 0) {
            pretop = pretop - 1;
        }

        return this.createHunk(pretop, precount, top, bot - top + 1);
    }

    patchLines(hunk: Hunk, stripCr: boolean = false): string[] {
        const lines: string[] = [];

        for (const l of hunk.removed.lines) {
            lines.push("-" + l);
        }
        for (const l of hunk.added.lines) {
            lines.push("+" + l);
        }

        if (stripCr) {
            return lines.map((l) => l.replace(/\r$/, ""));
        }
        return lines;
    }

    static parseDiffLine(line: string): Hunk {
        const parts = line.split("@@");
        const diffkey = parts[1].trim();

        // diffkey: "-xx,n +yy,m"
        const tokens = diffkey.split(" ");
        const pre = tokens[0].substring(1).split(",");
        const now = tokens[1].substring(1).split(",");

        const hunk = this.createHunk(
            parseInt(pre[0]),
            parseInt(pre[1] || "1"),
            parseInt(now[0]),
            parseInt(now[1] || "1")
        );

        hunk.head = line;
        return hunk;
    }

    private static changeEnd(hunk: Hunk): number {
        if (hunk.added.count === 0) {
            return hunk.added.start;
        } else if (hunk.removed.count === 0) {
            return hunk.added.start + hunk.added.count - 1;
        } else {
            return (
                hunk.added.start +
                Math.min(hunk.added.count, hunk.removed.count) -
                1
            );
        }
    }

    static calcSigns(
        prevHunk: Hunk | undefined,
        hunk: Hunk,
        nextHunk: Hunk | undefined,
        minLnum: number = 1,
        maxLnum: number = Infinity,
        untracked?: boolean
    ): Sign[] {
        if (untracked && hunk.type !== "add") {
            console.error(
                `Invalid hunk with untracked=${untracked} hunk="${hunk.head}"`
            );
            return [];
        }

        minLnum = Math.max(1, minLnum);

        const { start, added, removed } = {
            start: hunk.added.start,
            added: hunk.added.count,
            removed: hunk.removed.count,
        };

        const cend = this.changeEnd(hunk);

        const topdelete =
            hunk.type === "delete" &&
            (start === 0 || (prevHunk && this.changeEnd(prevHunk) === start)) &&
            (!nextHunk || nextHunk.added.start !== start + 1);

        if (topdelete && minLnum === 1) {
            minLnum = 0;
        }

        const signs: Sign[] = [];

        for (
            let lnum = Math.max(start, minLnum);
            lnum <= Math.min(cend, maxLnum);
            lnum++
        ) {
            const changedelete =
                hunk.type === "change" &&
                ((removed > added && lnum === cend) ||
                    (prevHunk && prevHunk.added.start === 0));

            signs.push({
                type: topdelete
                    ? "topdelete"
                    : changedelete
                      ? "changedelete"
                      : untracked
                        ? "untracked"
                        : hunk.type,
                count:
                    lnum === start
                        ? hunk.type === "add"
                            ? added
                            : removed
                        : undefined,
                lnum: lnum + (topdelete ? 1 : 0),
            });
        }

        if (
            hunk.type === "change" &&
            added > removed &&
            hunk.vend >= minLnum &&
            cend <= maxLnum
        ) {
            for (
                let lnum = Math.max(cend, minLnum);
                lnum <= Math.min(hunk.vend, maxLnum);
                lnum++
            ) {
                signs.push({
                    type: "add",
                    count: lnum === hunk.vend ? added - removed : undefined,
                    lnum,
                });
            }
        }

        return signs;
    }

    static createPatch(
        relpath: string,
        hunks: Hunk[],
        modeBits: string,
        invert: boolean = false
    ): string[] {
        const results = [
            `diff --git a/${relpath} b/${relpath}`,
            `index 000000..000000 ${modeBits}`,
            `--- a/${relpath}`,
            `+++ b/${relpath}`,
        ];

        let offset = 0;

        for (const processHunk of hunks) {
            let start = processHunk.removed.start;
            let preCount = processHunk.removed.count;
            let nowCount = processHunk.added.count;

            if (processHunk.type === "add") {
                start = start + 1;
            }

            let preLines = processHunk.removed.lines;
            let nowLines = processHunk.added.lines;

            if (invert) {
                [preCount, nowCount] = [nowCount, preCount];
                [preLines, nowLines] = [nowLines, preLines];
            }

            results.push(
                `@@ -${start},${preCount} +${start + offset},${nowCount} @@`
            );

            for (const l of preLines) {
                results.push("-" + l);
            }

            if (
                (invert ? processHunk.added : processHunk.removed).no_nl_at_eof
            ) {
                results.push("\\ No newline at end of file");
            }

            for (const l of nowLines) {
                results.push("+" + l);
            }

            if (
                (invert ? processHunk.removed : processHunk.added).no_nl_at_eof
            ) {
                results.push("\\ No newline at end of file");
            }

            processHunk.removed.start = start + offset;
            offset = offset + (nowCount - preCount);
        }

        return results;
    }

    getSummary(hunks: Hunk[]): StatusObj {
        const status: StatusObj = { added: 0, changed: 0, removed: 0 };

        for (const hunk of hunks) {
            if (hunk.type === "add") {
                status.added += hunk.added.count;
            } else if (hunk.type === "delete") {
                status.removed += hunk.removed.count;
            } else if (hunk.type === "change") {
                const add = hunk.added.count;
                const remove = hunk.removed.count;
                const delta = Math.min(add, remove);
                status.changed += delta;
                status.added += add - delta;
                status.removed += remove - delta;
            }
        }

        return status;
    }

    static findHunk(
        lnum: number,
        hunks?: Hunk[]
    ): [Hunk, number] | [undefined, undefined] {
        if (!hunks) return [undefined, undefined];

        for (let i = 0; i < hunks.length; i++) {
            const hunk = hunks[i];
            if (lnum === 1 && hunk.added.start === 0 && hunk.vend === 0) {
                return [hunk, i];
            }

            if (hunk.added.start <= lnum && hunk.vend >= lnum) {
                return [hunk, i];
            }
        }

        return [undefined, undefined];
    }

    findNearestHunk(
        lnum: number,
        hunks: Hunk[],
        direction: "first" | "last" | "next" | "prev",
        wrap?: boolean
    ): number | undefined {
        if (hunks.length === 0) {
            return undefined;
        } else if (direction === "first") {
            return 0;
        } else if (direction === "last") {
            return hunks.length - 1;
        } else if (direction === "next") {
            if (hunks[0].added.start > lnum) {
                return 0;
            }
            for (let i = hunks.length - 1; i >= 0; i--) {
                if (hunks[i].added.start <= lnum) {
                    if (
                        i + 1 < hunks.length &&
                        hunks[i + 1].added.start > lnum
                    ) {
                        return i + 1;
                    } else if (wrap) {
                        return 0;
                    }
                }
            }
        } else if (direction === "prev") {
            if (Math.max(hunks[hunks.length - 1].vend) < lnum) {
                return hunks.length - 1;
            }
            for (let i = 0; i < hunks.length; i++) {
                if (lnum <= Math.max(hunks[i].vend, 1)) {
                    if (i > 0 && Math.max(hunks[i - 1].vend, 1) < lnum) {
                        return i - 1;
                    } else if (wrap) {
                        return hunks.length - 1;
                    }
                }
            }
        }
        return undefined;
    }

    compareHeads(a?: Hunk[], b?: Hunk[]): boolean {
        if ((a === undefined) !== (b === undefined)) {
            return true;
        } else if (a && b && a.length !== b.length) {
            return true;
        }
        for (let i = 0; i < (a || []).length; i++) {
            if (b![i].head !== a![i].head) {
                return true;
            }
        }
        return false;
    }

    private static compareNew(a: Hunk, b: Hunk): boolean {
        if (a.added.start !== b.added.start) {
            return false;
        }

        if (a.added.count !== b.added.count) {
            return false;
        }

        for (let i = 0; i < a.added.count; i++) {
            if (a.added.lines[i] !== b.added.lines[i]) {
                return false;
            }
        }

        return true;
    }

    static filterCommon(a?: Hunk[], b?: Hunk[]): Hunk[] | undefined {
        if (!a && !b) {
            return undefined;
        }

        a = a || [];
        b = b || [];

        let aI = 0;
        let bI = 0;

        const ret: Hunk[] = [];

        for (let _ = 0; _ < Math.max(a.length, b.length) + 1; _++) {
            const aH = a[aI];
            const bH = b[bI];

            if (!aH) {
                break;
            }

            if (!bH) {
                for (let i = aI; i < a.length; i++) {
                    ret.push(a[i]);
                }
                break;
            }

            if (aH.added.start > bH.added.start) {
                bI++;
            } else if (aH.added.start < bH.added.start) {
                ret.push(aH);
                aI++;
            } else {
                if (!this.compareNew(aH, bH)) {
                    ret.push(aH);
                }
                aI++;
                bI++;
            }
        }

        return ret;
    }

    linespecForHunk(hunk: Hunk, stripCr: boolean = false): LineSpec[] {
        const hls: LineSpec[] = [];

        let removed = hunk.removed.lines;
        let added = hunk.added.lines;

        if (stripCr) {
            removed = removed.map((l) => l.replace(/\r$/, ""));
            added = added.map((l) => l.replace(/\r$/, ""));
        }

        for (const spec of [
            { sym: "-", lines: removed, hl: "GitSignsDeletePreview" },
            { sym: "+", lines: added, hl: "GitSignsAddPreview" },
        ]) {
            for (const l of spec.lines) {
                const mark: HlMark = {
                    start_row: 0,
                    hl_group: spec.hl,
                    end_row: 1,
                };
                hls.push([[spec.sym + l, [mark]]]);
            }
        }

        // Note: Word diff functionality would require porting diff_int module
        // Placeholder for internal diff highlighting

        return hls;
    }
}
