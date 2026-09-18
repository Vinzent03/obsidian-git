import { Errors } from "isomorphic-git";
import { describe, expect, it, vi } from "vitest";
import { runGitAction, type GitActionHost } from "../src/gitAction";
import { GitConflictError, type Status } from "../src/types";

function createHost() {
    const displayError = vi.fn();
    const handleConflict = vi.fn(() => {
        displayError("Resolve conflicts and commit manually");
    });
    const updateCachedStatus = vi.fn<() => Promise<Status>>();
    const host: GitActionHost = {
        displayError,
        handleConflict,
        handleNoNetworkError: vi.fn(),
        log: vi.fn(),
        updateCachedStatus,
    };
    return { displayError, handleConflict, host, updateCachedStatus };
}

describe("runGitAction", () => {
    it("reports a conflict once through the conflict handler", async () => {
        const { displayError, handleConflict, host, updateCachedStatus } =
            createHost();
        updateCachedStatus.mockResolvedValue({
            all: [],
            changed: [],
            staged: [],
            conflicted: ["note.md"],
            stagedOutsideVault: 0,
            conflictedOutsideVault: 0,
        });

        const result = await runGitAction(host, () =>
            Promise.reject(
                new GitConflictError(["note.md"], new Error("raw Git error"))
            )
        );

        expect(result).toEqual({ status: "failed" });
        expect(updateCachedStatus).toHaveBeenCalledOnce();
        expect(handleConflict).toHaveBeenCalledOnce();
        expect(handleConflict).toHaveBeenCalledWith(["note.md"]);
        expect(displayError).toHaveBeenCalledOnce();
    });

    it("returns successful values without reporting an error", async () => {
        const { displayError, handleConflict, host } = createHost();

        const result = await runGitAction(host, () =>
            Promise.resolve({ status: "up-to-date" as const })
        );

        expect(result).toEqual({
            status: "success",
            value: { status: "up-to-date" },
        });
        expect(handleConflict).not.toHaveBeenCalled();
        expect(displayError).not.toHaveBeenCalled();
    });

    it("stops quietly when the user cancels an action", async () => {
        const { displayError, handleConflict, host } = createHost();

        const result = await runGitAction(host, () =>
            Promise.reject(new Errors.UserCanceledError())
        );

        expect(result).toEqual({ status: "cancelled" });
        expect(handleConflict).not.toHaveBeenCalled();
        expect(displayError).not.toHaveBeenCalled();
    });

    it("displays an unknown error once", async () => {
        const { displayError, handleConflict, host } = createHost();
        const error = new Error("commit failed");

        const result = await runGitAction(host, () => Promise.reject(error));

        expect(result).toEqual({ status: "failed" });
        expect(handleConflict).not.toHaveBeenCalled();
        expect(displayError).toHaveBeenCalledOnce();
        expect(displayError).toHaveBeenCalledWith(error);
    });
});
