<!-- tslint:disable ts(2345)  -->
<script lang="ts">
    import TreeComponent from "./treeComponent.svelte";

    import type ObsidianGit from "src/main";
    import type { StatusRootTreeItem, TreeItem } from "src/types";
    import { FileType } from "src/types";
    import { DiscardModal } from "src/ui/modals/discardModal";
    import { slide } from "svelte/transition";
    import type GitView from "../sourceControl";
    import FileComponent from "./fileComponent.svelte";
    import PulledFileComponent from "./pulledFileComponent.svelte";
    import StagedFileComponent from "./stagedFileComponent.svelte";
    import { arrayProxyWithNewLength, mayTriggerFileMenu } from "src/utils";
    import TooManyFilesComponent from "./tooManyFilesComponent.svelte";
    interface Props {
        hierarchy: StatusRootTreeItem;
        plugin: ObsidianGit;
        view: GitView;
        fileType: FileType;
        topLevel?: boolean;
    }

    let {
        hierarchy,
        plugin,
        view,
        fileType,
        topLevel = false,
    }: Props = $props();
    const closed: Record<string, boolean> = $state({});

    for (const entity of hierarchy.children) {
        closed[entity.title] = (entity.children?.length ?? 0) > 100;
    }
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
    let side = $derived(
        (view.leaf.getRoot() as any).side == "left" ? "right" : "left"
    );

    function stage(event: MouseEvent, path: string) {
        event.stopPropagation();
        plugin.gitManager
            .stageAll({ dir: path })
            .catch((e) => plugin.displayError(e))
            .finally(() => {
                view.app.workspace.trigger("obsidian-git:refresh");
            });
    }
    function unstage(event: MouseEvent, path: string) {
        event.stopPropagation();
        plugin.gitManager
            .unstageAll({ dir: path })
            .catch((e) => plugin.displayError(e))
            .finally(() => {
                view.app.workspace.trigger("obsidian-git:refresh");
            });
    }
    function discard(event: MouseEvent, item: TreeItem) {
        event.stopPropagation();
        new DiscardModal(view.app, false, item.vaultPath).myOpen().then(
            (shouldDiscard) => {
                if (shouldDiscard === true) {
                    return plugin.gitManager
                        .discardAll({
                            dir: item.path,
                            status: plugin.cachedStatus,
                        })
                        .finally(() => {
                            view.app.workspace.trigger("obsidian-git:refresh");
                        });
                }
            },
            (e) => plugin.displayError(e)
        );
    }
    function fold(item: TreeItem) {
        closed[item.title] = !closed[item.title];
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<main class:topLevel>
    {#each arrayProxyWithNewLength(hierarchy.children, 500) as entity}
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
                onclick={() => fold(entity)}
                onauxclick={(event) =>
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
                    <div class="git-tools">
                        <div class="buttons">
                            {#if fileType == FileType.staged}
                                <div
                                    data-icon="minus"
                                    aria-label="Unstage"
                                    onclick={(event) =>
                                        unstage(event, entity.path)}
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
                                    onclick={(event) => discard(event, entity)}
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
                                    onclick={(event) =>
                                        stage(event, entity.path)}
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
                            <div style="width:11px"></div>
                        </div>
                    </div>
                </div>

                {#if !closed[entity.title]}
                    <div
                        class="tree-item-children nav-folder-children"
                        transition:slide|local={{ duration: 150 }}
                    >
                        <TreeComponent
                            hierarchy={entity as StatusRootTreeItem}
                            {plugin}
                            {view}
                            {fileType}
                        />
                    </div>
                {/if}
            </div>
        {/if}
    {/each}

    <TooManyFilesComponent files={hierarchy.children} />
</main>

<style lang="scss">
    main {
        .nav-folder-title {
            align-items: center;
        }
    }
</style>
