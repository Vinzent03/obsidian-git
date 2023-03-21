<script lang="ts">
    import { setIcon, TFile } from "obsidian";
    import { DIFF_VIEW_CONFIG } from "src/constants";
    import { DiffFile } from "src/types";
    import { getDisplayPath, getNewLeaf } from "src/utils";
    import HistoryView from "../historyView";

    export let diff: DiffFile;
    export let view: HistoryView;
    let buttons: HTMLElement[] = [];

    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

    window.setTimeout(
        () => buttons.forEach((b) => setIcon(b, b.getAttr("data-icon")!)),
        0
    );

    function open(event: MouseEvent) {
        const file = view.app.vault.getAbstractFileByPath(diff.vault_path);

        if (file instanceof TFile) {
            getNewLeaf(event)?.openFile(file);
        }
    }

    function showDiff(event: MouseEvent) {
        getNewLeaf(event)?.setViewState({
            type: DIFF_VIEW_CONFIG.type,
            active: true,
            state: {
                file: diff.path,
                staged: false,
                hash: diff.hash,
            },
        });
    }
</script>

<main on:click={showDiff} on:focus class="nav-file">
    <div
        class="nav-file-title"
        aria-label-position={side}
        aria-label={diff.vault_path}
    >
        <div class="nav-file-title-content">
            {getDisplayPath(diff.vault_path)}
        </div>
        <div class="tools">
            <div class="buttons">
                {#if view.app.vault.getAbstractFileByPath(diff.vault_path)}
                    <div
                        data-icon="go-to-file"
                        aria-label="Open File"
                        bind:this={buttons[0]}
                        on:auxclick={open}
                        on:click={open}
                        class="clickable-icon"
                    />
                {/if}
            </div>
            <span class="type" data-type={diff.status}>{diff.status}</span>
        </div>
    </div>
</main>

<style lang="scss">
    main {
        .nav-file-title-content {
            display: flex;
            align-items: center;
        }
        .tools {
            display: flex;
            margin-left: auto;
            .type {
                padding-left: var(--size-2-1);
                display: flex;
                align-items: center;
                justify-content: center;
                &[data-type="M"] {
                    color: orange;
                }
                &[data-type="D"] {
                    color: red;
                }
            }
            .buttons {
                display: flex;
                > * {
                    padding: 0 0;
                    height: auto;
                }
            }
        }
    }
</style>
