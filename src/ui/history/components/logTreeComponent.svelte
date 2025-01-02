<!-- tslint:disable ts(2345)  -->
<script lang="ts">
    import LogTreeComponent from "./logTreeComponent.svelte";
    import type ObsidianGit from "src/main";
    import type { HistoryRootTreeItem, TreeItem } from "src/types";
    import { slide } from "svelte/transition";
    import type HistoryView from "../historyView";
    import LogFileComponent from "./logFileComponent.svelte";

    interface Props {
        hierarchy: HistoryRootTreeItem;
        plugin: ObsidianGit;
        view: HistoryView;
        topLevel?: boolean;
    }

    let { hierarchy, plugin, view, topLevel = false }: Props = $props();
    const closed: Record<string, boolean> = $state({});

    let side = $derived(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (view.leaf.getRoot() as any).side == "left" ? "right" : "left"
    );

    function fold(item: TreeItem) {
        closed[item.title] = !closed[item.title];
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
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
                    onclick={() => fold(entity)}
                >
                    <div
                        data-icon="folder"
                        style="padding-right: 5px; display: flex; "
                    ></div>
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
                        <LogTreeComponent
                            hierarchy={entity as HistoryRootTreeItem}
                            {plugin}
                            {view}
                        />
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
