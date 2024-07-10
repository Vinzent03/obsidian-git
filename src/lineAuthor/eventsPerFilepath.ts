import type {
    LineAuthoringSubscriber,
    LineAuthoringSubscribers,
} from "src/lineAuthor/control";

const SECONDS = 1000;
const REMOVE_STALES_FREQUENCY = 60 * SECONDS;

/**
 * * stores the subscribers/editors interested in changed per filepath
 * * We need this pub-sub design, because a filepath may be opened in multiple editors
 *   and each editor should be updated asynchronously and independently.
 * * Subscribers can be cleared when the feature is deactivated
 */
class EventsPerFilePath {
    private eventsPerFilepath: Map<string, LineAuthoringSubscribers> =
        new Map();
    private removeStalesSubscribersTimer: number;

    constructor() {
        this.startRemoveStalesSubscribersInterval();
    }

    /**
     * Run the {@link handler} on the subscribers to {@link filepath}.
     */
    public ifFilepathDefinedTransformSubscribers<T>(
        filepath: string | undefined,
        handler: (lass: LineAuthoringSubscribers) => T
    ): T | undefined {
        if (!filepath) return;

        this.ensureInitialized(filepath);

        return handler(this.eventsPerFilepath.get(filepath)!);
    }

    public forEachSubscriber(
        handler: (las: LineAuthoringSubscriber) => void
    ): void {
        this.eventsPerFilepath.forEach((subs) => subs.forEach(handler));
    }

    private ensureInitialized(filepath: string) {
        if (!this.eventsPerFilepath.get(filepath))
            this.eventsPerFilepath.set(filepath, new Set());
    }

    private startRemoveStalesSubscribersInterval() {
        this.removeStalesSubscribersTimer = window.setInterval(
            () => this?.forEachSubscriber((las) => las?.removeIfStale()),
            REMOVE_STALES_FREQUENCY
        );
    }

    public clear() {
        window.clearInterval(this.removeStalesSubscribersTimer);
        this.eventsPerFilepath.clear();
    }
}

export const eventsPerFilePathSingleton = new EventsPerFilePath();
