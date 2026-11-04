import { Errors } from "isomorphic-git";
import { GitConflictError, NoNetworkError, type Status } from "./types";

export type GitActionResult<T> =
    | { status: "success"; value: T }
    | { status: "failed" }
    | { status: "cancelled" };

export interface GitActionHost {
    displayError(error: unknown): void;
    handleConflict(conflictedFiles: readonly string[]): void;
    handleNoNetworkError(error: NoNetworkError): void;
    log(...data: unknown[]): void;
    updateCachedStatus(): Promise<Status>;
}

export async function runGitAction<T>(
    host: GitActionHost,
    action: () => Promise<T>
): Promise<GitActionResult<T>> {
    try {
        return { status: "success", value: await action() };
    } catch (error) {
        await reportGitError(host, error);
        return {
            status:
                error instanceof Errors.UserCanceledError
                    ? "cancelled"
                    : "failed",
        };
    }
}

async function reportGitError(
    host: GitActionHost,
    error: unknown
): Promise<void> {
    if (error instanceof Errors.UserCanceledError) {
        return;
    }
    if (error instanceof GitConflictError) {
        let conflictedFiles = error.files;
        try {
            conflictedFiles = (await host.updateCachedStatus()).conflicted;
        } catch (refreshError) {
            console.error("Failed to refresh conflict status", refreshError);
        }
        host.log("Git conflict:", error.cause);
        host.handleConflict(conflictedFiles);
        return;
    }
    if (error instanceof NoNetworkError) {
        host.handleNoNetworkError(error);
        return;
    }
    if (error instanceof Errors.PushRejectedError) {
        host.log("Push rejected:", error);
        host.displayError(
            error.data.reason === "tag-exists"
                ? "Push rejected because the tag already exists on the remote."
                : "Push rejected. Pull changes from the remote, resolve any conflicts, then push again."
        );
        return;
    }
    host.displayError(error);
}
