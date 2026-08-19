import { describe, expect, it } from "vitest";
import {
    hashLfsContent,
    isLfsTracked,
    lfsBatchEndpoint,
    parseGitAttributes,
    parseLfsConfigUrl,
    parseLfsPointer,
    serializeLfsPointer,
} from "../../../src/gitManager/wasmGit/lfs";

describe("LFS pointers", () => {
    it("round-trips pointer text", () => {
        const hash = hashLfsContent(new Uint8Array([1, 2, 3]));
        const pointer = serializeLfsPointer(hash, 3);
        expect(parseLfsPointer(pointer)).toEqual({ sha256: hash, size: 3 });
    });

    it("rejects non-pointer files", () => {
        expect(parseLfsPointer("not a pointer\n")).toBeUndefined();
    });
});

describe("git attributes LFS matching", () => {
    it("matches extension patterns in any directory", () => {
        const rules = parseGitAttributes("*.bin filter=lfs\n*.md filter=\n");
        expect(isLfsTracked("photo.bin", rules)).toBe(true);
        expect(isLfsTracked("dir/photo.bin", rules)).toBe(true);
        expect(isLfsTracked("note.md", rules)).toBe(false);
    });

    it("lets a later rule unset the filter", () => {
        const rules = parseGitAttributes(
            "*.bin filter=lfs\nsecret.bin filter=\n"
        );
        expect(isLfsTracked("photo.bin", rules)).toBe(true);
        expect(isLfsTracked("secret.bin", rules)).toBe(false);
    });
});

describe("LFS config", () => {
    it("reads lfs.url and builds the batch endpoint", () => {
        expect(
            parseLfsConfigUrl("[lfs]\n\turl = http://example.com/foo\n")
        ).toBe("http://example.com/foo");
        expect(lfsBatchEndpoint("http://host/repo.git")).toBe(
            "http://host/repo.git/info/lfs/objects/batch"
        );
        expect(lfsBatchEndpoint("http://host/repo")).toBe(
            "http://host/repo.git/info/lfs/objects/batch"
        );
        expect(lfsBatchEndpoint("http://host/repo.git", "http://lfs/")).toBe(
            "http://lfs/objects/batch"
        );
    });
});
