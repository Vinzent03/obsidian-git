<script lang="ts">
    import { setIcon, TFile } from "obsidian";
    import type { DiffFile } from "src/types";
    import {
        fileIsBinary,
        getDisplayPath,
        getNewLeaf,
        mayTriggerFileMenu,
    } from "src/utils";
    import type HistoryView from "../historyView";

    interface Props {
        diff: DiffFile;
        view: HistoryView;
    }

    let { diff, view }: Props = $props();
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
        if (fileIsBinary(diff.path)) {
            open(event);
        } else {
            showDiff(event);
        }
    }

    function open(event: MouseEvent) {
        event.stopPropagation();
        const file = view.app.vault.getAbstractFileByPath(diff.vaultPath);

        if (file instanceof TFile) {
            getNewLeaf(view.app, event)
                ?.openFile(file)
                .catch((e) => view.plugin.displayError(e));
        }
    }

    function showDiff(event: MouseEvent) {
        view.plugin.tools.openDiff({
            event,
            aFile: diff.fromPath ?? diff.path,
            aRef: `${diff.hash}^`,
            bFile: diff.path,
            bRef: diff.hash,
        });
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main
    onclick={mainClick}
    onauxclick={(event) => {
        event.stopPropagation();
        if (event.button == 2)
            mayTriggerFileMenu(
                view.app,
                event,
                diff.vaultPath,
                view.leaf,
                "git-history"
            );
        else mainClick(event);
    }}
    class="tree-item nav-file"
>
    <div
        class="tree-item-self is-clickable nav-file-title"
        data-path={diff.vaultPath}
        data-tooltip-position={side}
        aria-label={diff.vaultPath}
    >
        <div class="tree-item-inner nav-file-title-content">
            {getDisplayPath(diff.vaultPath)}
        </div>
        <div class="git-tools">
            <div class="buttons">
                {#if view.app.vault.getAbstractFileByPath(diff.vaultPath) instanceof TFile}
                    <div
                        data-icon="go-to-file"
                        aria-label="Open File"
                        bind:this={buttons[0]}
                        onauxclick={open}
                        onclick={open}
                        class="clickable-icon"
                    ></div>
                {/if}
            </div>
            <span class="type" data-type={diff.status}>{diff.status}</span>
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
