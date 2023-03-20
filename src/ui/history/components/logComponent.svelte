<script lang="ts">
    import { LogEntry } from "src/types";
    import { slide } from "svelte/transition";
    import HistoryView from "../historyView";
    import LogFileComponent from "./logFileComponent.svelte";

    export let log: LogEntry;
    export let view: HistoryView;
    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";
    let isCollapsed = true;
</script>

<main>
    <div class="staged nav-folder" class:is-collapsed={isCollapsed}>
        <div
            class="nav-folder-title"
            on:click|self={() => (isCollapsed = !isCollapsed)}
        >
            <div
                class="nav-folder-collapse-indicator collapse-icon"
                on:click={() => (isCollapsed = !isCollapsed)}
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
            <div
                class="nav-folder-title-content"
                on:click={() => (isCollapsed = !isCollapsed)}
                aria-label={log.message}
            >
                {log.message}
            </div>
            <div class="tools">
                <div class="type">{log.refs.join(", ")}</div>
            </div>
        </div>

        {#if !isCollapsed}
            <div
                class="nav-folder-children"
                transition:slide|local={{ duration: 150 }}
            >
                {#each log.diff.files as file}
                    <LogFileComponent {view} diff={file} />
                {/each}
            </div>
        {/if}
    </div>
</main>

<style lang="scss">
    main {
        .nav-file-title-content {
            display: flex;
            align-items: center;
        }
    }
    .tools {
        display: inline;
        margin-left: auto;
        white-space: nowrap;
        overflow: hidden;
    }
</style>
