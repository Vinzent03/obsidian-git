<script lang="ts">
    import { setIcon, TFile } from "obsidian";
    import { hoverPreview } from "obsidian-community-lib";
    import { DIFF_VIEW_CONFIG } from "src/constants";
    import type { GitManager } from "src/gitManager/gitManager";
    import type { FileStatusResult } from "src/types";
    import { DiscardModal } from "src/ui/modals/discardModal";
    import { getDisplayPath, getNewLeaf, mayTriggerFileMenu } from "src/utils";
    import type GitView from "../sourceControl";

    export let change: FileStatusResult;
    export let view: GitView;
    export let manager: GitManager;
    let buttons: HTMLElement[] = [];
    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

    window.setTimeout(
        () => buttons.forEach((b) => setIcon(b, b.getAttr("data-icon")!)),
        0
    );

    function hover(event: MouseEvent) {
        //Don't show previews of config- or hidden files.
        if (app.vault.getAbstractFileByPath(change.vault_path)) {
            hoverPreview(event, view as any, change.vault_path);
        }
    }

    function open(event: MouseEvent) {
        const file = view.app.vault.getAbstractFileByPath(change.vault_path);

        if (file instanceof TFile) {
            getNewLeaf(event)?.openFile(file);
        }
    }

    function stage() {
        manager.stage(change.path, false).finally(() => {
            dispatchEvent(new CustomEvent("git-refresh"));
        });
    }

    function showDiff(event: MouseEvent) {
        getNewLeaf(event)?.setViewState({
            type: DIFF_VIEW_CONFIG.type,
            active: true,
            state: {
                file: change.path,
                staged: false,
            },
        });
    }

    function discard() {
        const deleteFile = change.working_dir == "U";
        new DiscardModal(view.app, deleteFile, change.vault_path)
            .myOpen()
            .then((shouldDiscard) => {
                if (shouldDiscard === true) {
                    if (deleteFile) {
                        view.app.vault.adapter
                            .remove(change.vault_path)
                            .finally(() => {
                                dispatchEvent(new CustomEvent("git-refresh"));
                            });
                    } else {
                        manager.discard(change.path).finally(() => {
                            dispatchEvent(new CustomEvent("git-refresh"));
                        });
                    }
                }
            });
    }
</script>

<!-- TODO: Fix arai-label for left sidebar and if it's too long -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-unknown-aria-attribute -->
<main
    on:mouseover={hover}
    on:click|stopPropagation={showDiff}
    on:auxclick|stopPropagation={(event) => {
        if (event.button == 2)
            mayTriggerFileMenu(
                view.app,
                event,
                change.vault_path,
                view.leaf,
                "git-source-control"
            );
        else showDiff(event);
    }}
    on:focus
    class="tree-item nav-file"
>
    <div
        class="tree-item-self is-clickable nav-file-title"
        class:is-active={view.plugin.lastDiffViewState?.file ==
            change.vault_path &&
            !view.plugin.lastDiffViewState?.hash &&
            !view.plugin.lastDiffViewState?.staged}
        data-path={change.vault_path}
        data-tooltip-position={side}
        aria-label={change.vault_path}
    >
        <!-- <div
			data-icon="folder"
			bind:this={buttons[3]}
			style="padding-right: 5px; display: flex;"
		/> -->
        <div class="tree-item-inner nav-file-title-content">
            {getDisplayPath(change.vault_path)}
        </div>
        <div class="git-tools">
            <div class="buttons">
                {#if view.app.vault.getAbstractFileByPath(change.vault_path) instanceof TFile}
                    <div
                        data-icon="go-to-file"
                        aria-label="Open File"
                        bind:this={buttons[1]}
                        on:auxclick|stopPropagation={open}
                        on:click|stopPropagation={open}
                        class="clickable-icon"
                    />
                {/if}
                <div
                    data-icon="undo"
                    aria-label="Discard"
                    bind:this={buttons[0]}
                    on:click|stopPropagation={discard}
                    class="clickable-icon"
                />
                <div
                    data-icon="plus"
                    aria-label="Stage"
                    bind:this={buttons[2]}
                    on:click|stopPropagation={stage}
                    class="clickable-icon"
                />
            </div>
            <div class="type" data-type={change.working_dir}>
                {change.working_dir}
            </div>
        </div>
    </div>
</main>

<style lang="scss">
    main {
        .nav-file-title {
            align-items: center;
        }
    }
</style>
