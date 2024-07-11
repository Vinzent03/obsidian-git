<!-- tslint:disable ts(2345)  -->
<script lang="ts">
    import type ObsidianGit from "src/main";
    import type { StatusRootTreeItem, TreeItem } from "src/types";
    import { FileType } from "src/types";
    import { DiscardModal } from "src/ui/modals/discardModal";
    import { slide } from "svelte/transition";
    import type GitView from "../sourceControl";
    import FileComponent from "./fileComponent.svelte";
    import PulledFileComponent from "./pulledFileComponent.svelte";
    import StagedFileComponent from "./stagedFileComponent.svelte";
    import { mayTriggerFileMenu } from "src/utils";
    export let hierarchy: StatusRootTreeItem;
    export let plugin: ObsidianGit;
    export let view: GitView;
    export let fileType: FileType;
    export let topLevel = false;
    const closed: Record<string, boolean> = {};
    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

    function stage(path: string) {
        plugin.gitManager.stageAll({ dir: path }).finally(() => {
            dispatchEvent(new CustomEvent("git-refresh"));
        });
    }
    function unstage(path: string) {
        plugin.gitManager.unstageAll({ dir: path }).finally(() => {
            dispatchEvent(new CustomEvent("git-refresh"));
        });
    }
    function discard(item: TreeItem) {
        new DiscardModal(view.app, false, item.vaultPath)
            .myOpen()
            .then((shouldDiscard) => {
                if (shouldDiscard === true) {
                    plugin.gitManager
                        .discardAll({
                            dir: item.path,
                            status: plugin.cachedStatus,
                        })
                        .finally(() => {
                            dispatchEvent(new CustomEvent("git-refresh"));
                        });
                }
            });
    }
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
                {#if fileType == FileType.staged}
                    <StagedFileComponent
                        change={entity.data}
                        manager={plugin.gitManager}
                        {view}
                    />
                {:else if fileType == FileType.changed}
                    <FileComponent
                        change={entity.data}
                        manager={plugin.gitManager}
                        {view}
                    />
                {:else if fileType == FileType.pulled}
                    <PulledFileComponent change={entity.data} {view} />
                {/if}
            </div>
        {:else}
            <div
                on:click|stopPropagation={() => fold(entity)}
                on:auxclick|stopPropagation={(event) =>
                    mayTriggerFileMenu(
                        view.app,
                        event,
                        entity.vaultPath,
                        view.leaf,
                        "git-source-control"
                    )}
                class="tree-item nav-folder"
                class:is-collapsed={closed[entity.title]}
            >
                <div
                    class="tree-item-self is-clickable nav-folder-title"
                    data-tooltip-position={side}
                    aria-label={entity.vaultPath}
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
                    <div class="git-tools">
                        <div class="buttons">
                            {#if fileType == FileType.staged}
                                <div
                                    data-icon="minus"
                                    aria-label="Unstage"
                                    on:click|stopPropagation={() =>
                                        unstage(entity.path)}
                                    class="clickable-icon"
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 18 18"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        class="svg-icon lucide-minus"
                                        ><line
                                            x1="4"
                                            y1="9"
                                            x2="14"
                                            y2="9"
                                        /></svg
                                    >
                                </div>
                            {:else}
                                <div
                                    data-icon="undo"
                                    aria-label="Discard"
                                    on:click|stopPropagation={() =>
                                        discard(entity)}
                                    class="clickable-icon"
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
                                        class="svg-icon lucide-undo"
                                        ><path d="M3 7v6h6" /><path
                                            d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"
                                        /></svg
                                    >
                                </div>
                                <div
                                    data-icon="plus"
                                    aria-label="Stage"
                                    on:click|stopPropagation={() =>
                                        stage(entity.path)}
                                    class="clickable-icon"
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 18 18"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        class="svg-icon lucide-plus"
                                        ><line
                                            x1="9"
                                            y1="4"
                                            x2="9"
                                            y2="14"
                                        /><line
                                            x1="4"
                                            y1="9"
                                            x2="14"
                                            y2="9"
                                        /></svg
                                    >
                                </div>
                            {/if}
                            <div style="width:11px" />
                        </div>
                    </div>
                </div>

                {#if !closed[entity.title]}
                    <div
                        class="tree-item-children nav-folder-children"
                        transition:slide|local={{ duration: 150 }}
                    >
                        <svelte:self
                            hierarchy={entity}
                            {plugin}
                            {view}
                            {fileType}
                        />
                    </div>
                {/if}
            </div>
        {/if}
    {/each}
</main>

<style lang="scss">
    main {
        .nav-folder-title {
            align-items: center;
        }
    }
</style>
