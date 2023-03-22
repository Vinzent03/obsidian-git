<script lang="ts">
    import { setIcon } from "obsidian";
    import ObsidianGit from "src/main";
    import { LogEntry } from "src/types";
    import { onDestroy } from "svelte";
    import LogComponent from "./components/logComponent.svelte";
    import HistoryView from "./historyView";

    export let plugin: ObsidianGit;
    export let view: HistoryView;
    let loading: boolean;
    let buttons: HTMLElement[] = [];
    let logs: LogEntry[] | undefined;
    let showTree: boolean = plugin.settings.treeStructure;

    let layoutBtn: HTMLElement;
    $: {
        if (layoutBtn) {
            layoutBtn.empty();
            setIcon(layoutBtn, showTree ? "list" : "folder", 16);
        }
    }
    addEventListener("git-view-refresh", refresh);
    //This should go in the onMount callback, for some reason it doesn't fire though
    //setTimeout's callback will execute after the current event loop finishes.
    plugin.app.workspace.onLayoutReady(() => {
        window.setTimeout(() => {
            buttons.forEach((btn) =>
                setIcon(btn, btn.getAttr("data-icon")!, 16)
            );
            setIcon(layoutBtn, showTree ? "list" : "folder", 16);
        }, 0);
    });
    onDestroy(() => {
        removeEventListener("git-view-refresh", refresh);
    });

    function triggerRefresh() {
        dispatchEvent(new CustomEvent("git-refresh"));
    }

    async function refresh() {
        loading = true;
        logs = await plugin.gitManager.log(undefined, false, 50);
        loading = false;
    }
</script>

<main>
    <div class="nav-header">
        <div class="nav-buttons-container">
            <div
                id="layoutChange"
                class="clickable-icon nav-action-button"
                aria-label="Change Layout"
                bind:this={layoutBtn}
                on:click={() => {
                    showTree = !showTree;
                    plugin.settings.treeStructure = showTree;
                    plugin.saveSettings();
                }}
            />
            <div
                id="refresh"
                class="clickable-icon nav-action-button"
                class:loading
                data-icon="refresh-cw"
                aria-label="Refresh"
                style="margin: 1px;"
                bind:this={buttons[6]}
                on:click={triggerRefresh}
            />
        </div>
    </div>

    <div class="nav-files-container" style="position: relative;">
        {#if logs}
            <div class="nav-folder mod-root">
                <div class="nav-folder-children">
                    {#each logs as log}
                        <LogComponent {view} {showTree} {log} {plugin} />
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</main>

<style lang="scss">
</style>
