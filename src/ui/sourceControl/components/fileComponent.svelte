<script lang="ts">
    import { setIcon, TFile } from "obsidian";
    import { hoverPreview } from "obsidian-community-lib";
    import type { GitManager } from "src/gitManager/gitManager";
    import type { FileStatusResult } from "src/types";
    import { DiscardModal } from "src/ui/modals/discardModal";
    import {
        fileIsBinary,
        getDisplayPath,
        getNewLeaf,
        mayTriggerFileMenu,
    } from "src/utils";
    import type GitView from "../sourceControl";

    export let change: FileStatusResult;
    export let view: GitView;
    export let manager: GitManager;
    let buttons: HTMLElement[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

    window.setTimeout(
        () => buttons.forEach((b) => setIcon(b, b.getAttr("data-icon")!)),
        0
    );

    function mainClick(event: MouseEvent) {
        if (fileIsBinary(change.path)) {
            open(event);
        } else {
            showDiff(event);
        }
    }

    function hover(event: MouseEvent) {
        //Don't show previews of config- or hidden files.
        if (view.app.vault.getAbstractFileByPath(change.vaultPath)) {
            hoverPreview(event, view, change.vaultPath);
        }
    }

    function open(event: MouseEvent) {
        const file = view.app.vault.getAbstractFileByPath(change.vaultPath);

        if (file instanceof TFile) {
            getNewLeaf(view.app, event)
                ?.openFile(file)
                .catch((e) => view.plugin.displayError(e));
        }
    }

    function stage() {
        manager
            .stage(change.path, false)
            .catch((e) => view.plugin.displayError(e))
            .finally(() => {
                view.app.workspace.trigger("obsidian-git:refresh");
            });
    }

    function showDiff(event: MouseEvent) {
        view.plugin.tools.openDiff({
            aFile: change.path,
            aRef: "",
            event,
        });
    }

    function discard() {
        const deleteFile = change.workingDir == "U";
        new DiscardModal(view.app, deleteFile, change.vaultPath).myOpen().then(
            (shouldDiscard) => {
                if (shouldDiscard === true) {
                    if (deleteFile) {
                        return view.app.vault.adapter
                            .remove(change.vaultPath)
                            .finally(() => {
                                view.app.workspace.trigger(
                                    "obsidian-git:refresh"
                                );
                            });
                    } else {
                        return manager.discard(change.path).finally(() => {
                            view.app.workspace.trigger("obsidian-git:refresh");
                        });
                    }
                }
            },
            (e) => view.plugin.displayError(e)
        );
    }
</script>

<!-- TODO: Fix arai-label for left sidebar and if it's too long -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-unknown-aria-attribute -->
<main
    on:mouseover={hover}
    on:click|stopPropagation={mainClick}
    on:auxclick|stopPropagation={(event) => {
        if (event.button == 2)
            mayTriggerFileMenu(
                view.app,
                event,
                change.vaultPath,
                view.leaf,
                "git-source-control"
            );
        else mainClick(event);
    }}
    on:focus
    class="tree-item nav-file"
>
    <div
        class="tree-item-self is-clickable nav-file-title"
        data-path={change.vaultPath}
        data-tooltip-position={side}
        aria-label={change.vaultPath}
    >
        <!-- <div
			data-icon="folder"
			bind:this={buttons[3]}
			style="padding-right: 5px; display: flex;"
		/> -->
        <div class="tree-item-inner nav-file-title-content">
            {getDisplayPath(change.vaultPath)}
        </div>
        <div class="git-tools">
            <div class="buttons">
                {#if view.app.vault.getAbstractFileByPath(change.vaultPath) instanceof TFile}
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
            <div class="type" data-type={change.workingDir}>
                {change.workingDir}
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
