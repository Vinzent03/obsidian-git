<!-- tslint:disable ts(2345)  -->
<script lang="ts">
    import type ObsidianGit from "src/main";
    import type { HistoryRootTreeItem, TreeItem } from "src/types";
    import { slide } from "svelte/transition";
    import type HistoryView from "../historyView";
    import LogFileComponent from "./logFileComponent.svelte";
    export let hierarchy: HistoryRootTreeItem;
    export let plugin: ObsidianGit;
    export let view: HistoryView;
    export let topLevel = false;
    const closed: Record<string, boolean> = {};
    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

    function fold(item: TreeItem) {
        closed[item.title] = !closed[item.title];
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<main class:topLevel>
    {#each hierarchy.children as entity}
        {#if entity.data}
            <div>
                <LogFileComponent diff={entity.data} {view} />
            </div>
        {:else}
            <div
                class="tree-item nav-folder"
                class:is-collapsed={closed[entity.title]}
            >
                <div
                    class="tree-item-self is-clickable nav-folder-title"
                    data-tooltip-position={side}
                    aria-label={entity.vaultPath}
                    on:click={() => fold(entity)}
                >
                    <div
                        data-icon="folder"
                        style="padding-right: 5px; display: flex; "
                    />
                    <div
                        class="tree-item-icon nav-folder-collapse-indicator collapse-icon"
                        class:is-collapsed={closed[entity.title]}
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
                    <div class="tree-item-inner nav-folder-title-content">
                        {entity.title}
                    </div>
                </div>

                {#if !closed[entity.title]}
                    <div
                        class="tree-item-children nav-folder-children"
                        transition:slide|local={{ duration: 150 }}
                    >
                        <svelte:self hierarchy={entity} {plugin} {view} />
                    </div>
                {/if}
            </div>
        {/if}
    {/each}
</main>

<style lang="scss">
    main {
        .nav-folder-title-content {
            display: flex;
            align-items: center;
        }
    }
</style>
