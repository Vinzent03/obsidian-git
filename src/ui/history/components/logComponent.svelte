<script lang="ts">
    import { moment } from "obsidian";
    import type ObsidianGit from "src/main";
    import type { LogEntry } from "src/types";
    import { slide } from "svelte/transition";
    import type HistoryView from "../historyView";
    import LogFileComponent from "./logFileComponent.svelte";
    import LogTreeComponent from "./logTreeComponent.svelte";

    interface Props {
        log: LogEntry;
        view: HistoryView;
        showTree: boolean;
        plugin: ObsidianGit;
    }

    let { log, view, showTree, plugin }: Props = $props();
    let logsHierarchy = $derived({
        title: "",
        path: "",
        vaultPath: "",
        children: plugin.gitManager.getTreeStructure(log.diff.files),
    });

    let side = $derived(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (view.leaf.getRoot() as any).side == "left" ? "right" : "left"
    );
    let isCollapsed = $state(true);

    function authorToString(log: LogEntry) {
        const name = log.author.name;
        if (plugin.settings.authorInHistoryView == "full") {
            return name;
        } else if (plugin.settings.authorInHistoryView == "initials") {
            const words = name.split(" ").filter((word) => word.length > 0);

            return words.map((word) => word[0].toUpperCase()).join("");
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<main>
    <div class="tree-item nav-folder" class:is-collapsed={isCollapsed}>
        <div
            class="tree-item-self is-clickable nav-folder-title"
            aria-label={`${log.refs.length > 0 ? log.refs.join(", ") + "\n" : ""}${log.author?.name}
${moment(log.date).format(plugin.settings.commitDateFormat)}
${log.message}`}
            data-tooltip-position={side}
            onclick={() => (isCollapsed = !isCollapsed)}
        >
            <div
                class="tree-item-icon nav-folder-collapse-indicator collapse-icon"
                class:is-collapsed={isCollapsed}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="svg-icon right-triangle"
                    ><path d="M3 8L12 17L21 8" /></svg
                >
            </div>
            <div>
                {#if log.refs.length > 0}
                    <div class="git-ref">
                        {log.refs.join(", ")}
                    </div>
                {/if}
                {#if plugin.settings.authorInHistoryView != "hide" && log.author?.name}
                    <div class="git-author">
                        {authorToString(log)}
                    </div>
                {/if}
                {#if plugin.settings.dateInHistoryView}
                    <div class="git-date">
                        {moment(log.date).format(
                            plugin.settings.commitDateFormat
                        )}
                    </div>
                {/if}

                <div class="tree-item-inner nav-folder-title-content">
                    {log.message}
                </div>
            </div>
        </div>
        {#if !isCollapsed}
            <div
                class="tree-item-children nav-folder-children"
                transition:slide|local={{ duration: 150 }}
            >
                {#if showTree}
                    <LogTreeComponent
                        hierarchy={logsHierarchy}
                        {plugin}
                        {view}
                        topLevel={true}
                    />
                {:else}
                    {#each log.diff.files as file}
                        <LogFileComponent {view} diff={file} />
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
</main>

<style lang="scss">
</style>
