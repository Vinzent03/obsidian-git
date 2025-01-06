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

    interface Props {
        change: FileStatusResult;
        view: GitView;
        manager: GitManager;
    }

    let { change, view, manager }: Props = $props();
    let buttons: HTMLElement[] = $state([]);

    let side = $derived(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (view.leaf.getRoot() as any).side == "left" ? "right" : "left"
    );

    $effect(() => {
        for (const b of buttons) if (b) setIcon(b, b.getAttr("data-icon")!);
    });

    function mainClick(event: MouseEvent) {
        event.stopPropagation();
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
        event.stopPropagation();
        const file = view.app.vault.getAbstractFileByPath(change.vaultPath);

        if (file instanceof TFile) {
            getNewLeaf(view.app, event)
                ?.openFile(file)
                .catch((e) => view.plugin.displayError(e));
        }
    }

    function stage(event: MouseEvent) {
        event.stopPropagation();
        manager
            .stage(change.path, false)
            .catch((e) => view.plugin.displayError(e))
            .finally(() => {
                view.app.workspace.trigger("obsidian-git:refresh");
            });
    }

    function showDiff(event: MouseEvent) {
        event.stopPropagation();
        view.plugin.tools.openDiff({
            aFile: change.path,
            aRef: "",
            event,
        });
    }

    function discard(event: MouseEvent) {
        event.stopPropagation();
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
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_unknown_aria_attribute -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<main
    onmouseover={hover}
    onclick={mainClick}
    onauxclick={(event) => {
        event.stopPropagation();
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
                        bind:this={buttons[0]}
                        onauxclick={open}
                        onclick={open}
                        class="clickable-icon"
                    ></div>
                {/if}
                <div
                    data-icon="undo"
                    aria-label="Discard"
                    bind:this={buttons[1]}
                    onclick={discard}
                    class="clickable-icon"
                ></div>
                <div
                    data-icon="plus"
                    aria-label="Stage"
                    bind:this={buttons[2]}
                    onclick={stage}
                    class="clickable-icon"
                ></div>
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
