/**
 * Wraps an async task so that calls made while it is running don't start
 * overlapping runs. Instead, they are coalesced into a single follow-up run
 * that starts once the running one has finished, so every caller still
 * observes a run that started after its call.
 */
export function coalesce(task: () => Promise<void>): () => Promise<void> {
    let active: Promise<void> | undefined;
    let queued: Promise<void> | undefined;

    const run = (): Promise<void> => {
        if (!active) {
            active = task().finally(() => {
                active = undefined;
            });
            return active;
        }
        queued ??= active
            .catch(() => {})
            .then(() => {
                queued = undefined;
                return run();
            });
        return queued;
    };
    return run;
}
