<script lang="ts">
    import ObsidianGit from "src/main";
    import { LogEntry } from "src/types";
    import { slide } from "svelte/transition";
    import HistoryView from "../historyView";
    import LogFileComponent from "./logFileComponent.svelte";
    import LogTreeComponent from "./logTreeComponent.svelte";

    export let log: LogEntry;
    export let view: HistoryView;
    export let showTree: boolean;
    export let plugin: ObsidianGit;
    $: logsHierarchy = {
        title: "",
        path: "",
        vaultPath: "",
        children: plugin.gitManager.getTreeStructure(log.diff.files),
    };

    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";
    let isCollapsed = true;
</script>

<main>
    <div class="tree-item nav-folder" class:is-collapsed={isCollapsed}>
        <div
            class="tree-item-self is-clickable nav-folder-title"
            on:click={() => (isCollapsed = !isCollapsed)}
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
                <div
                    class="tree-item-inner nav-folder-title-content"
                    aria-label={log.message}
                    aria-label-position={side}
                >
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
    .git-ref {
        color: var(--text-accent);
    }
</style>
