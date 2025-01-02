<script lang="ts">
    import { setIcon, type EventRef } from "obsidian";
    import { SimpleGit } from "src/gitManager/simpleGit";
    import type ObsidianGit from "src/main";
    import type { LogEntry } from "src/types";
    import { onDestroy } from "svelte";
    import LogComponent from "./components/logComponent.svelte";
    import type HistoryView from "./historyView";

    interface Props {
        plugin: ObsidianGit;
        view: HistoryView;
    }

    let { plugin = $bindable(), view }: Props = $props();
    let loading: boolean = $state(false);
    let buttons: HTMLElement[] = $state([]);
    let logs: LogEntry[] | undefined = $state();
    let showTree: boolean = $state(plugin.settings.treeStructure);
    let refreshRef: EventRef;

    let layoutBtn: HTMLElement | undefined = $state();
    $effect(() => {
        if (layoutBtn) {
            layoutBtn.empty();
            setIcon(layoutBtn, showTree ? "list" : "folder");
        }
    });
    refreshRef = view.app.workspace.on(
        "obsidian-git:view-refresh",
        () => void refresh().catch(console.error)
    );
    refresh().catch(console.error);
    //This should go in the onMount callback, for some reason it doesn't fire though
    //setTimeout's callback will execute after the current event loop finishes.
    plugin.app.workspace.onLayoutReady(() => {
        window.setTimeout(() => {
            buttons.forEach((btn) => setIcon(btn, btn.getAttr("data-icon")!));
            setIcon(layoutBtn!, showTree ? "list" : "folder");
        }, 0);
    });
    onDestroy(() => {
        view.app.workspace.offref(refreshRef);
    });

    function triggerRefresh() {
        view.app.workspace.trigger("obsidian-git:refresh");
    }

    async function refresh() {
        if (!plugin.gitReady) {
            logs = undefined;
            return;
        }
        loading = true;
        const isSimpleGit = plugin.gitManager instanceof SimpleGit;
        logs = await plugin.gitManager.log(
            undefined,
            false,
            isSimpleGit ? 50 : 10
        );
        loading = false;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<main>
    <div class="nav-header">
        <div class="nav-buttons-container">
            <div
                id="layoutChange"
                class="clickable-icon nav-action-button"
                aria-label="Change Layout"
                bind:this={layoutBtn}
                onclick={() => {
                    showTree = !showTree;
                    plugin.settings.treeStructure = showTree;
                    void plugin.saveSettings();
                }}
            ></div>
            <div
                id="refresh"
                class="clickable-icon nav-action-button"
                class:loading
                data-icon="refresh-cw"
                aria-label="Refresh"
                style="margin: 1px;"
                bind:this={buttons[6]}
                onclick={triggerRefresh}
            ></div>
        </div>
    </div>

    <div class="nav-files-container" style="position: relative;">
        {#if logs}
            <div class="tree-item nav-folder mod-root">
                {#each logs as log}
                    <LogComponent {view} {showTree} {log} {plugin} />
                {/each}
            </div>
        {/if}
    </div>
</main>

<style lang="scss">
</style>
