<script lang="ts">
    import { DiffFile } from "src/types";
    import HistoryView from "../historyView";

    export let diff: DiffFile;
    export let view: HistoryView;
    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

    function hover(event: MouseEvent) {
        //Don't show previews of config- or hidden files.
        // if (
        //     !change.path.startsWith(view.app.vault.configDir) ||
        //     !change.path.startsWith(".")
        // ) {
        //     hoverPreview(
        //         event,
        //         view as any,
        //         change.vault_path.split("/").last()!.replace(".md", "")
        //     );
        // }
    }

    function open(event: MouseEvent) {
        // const file = view.app.vault.getAbstractFileByPath(change.vault_path);
        // if (file instanceof TFile) {
        //     getNewLeaf(event)?.openFile(file);
        // }
    }
</script>

<main on:mouseover={hover} on:click={open} on:focus class="nav-file">
    <div
        class="nav-file-title"
        aria-label-position={side}
        aria-label={diff.vault_path}
    >
        <div class="nav-file-title-content">
            {diff.path.split("/").last()?.replace(".md", "")}
        </div>
        <div class="tools">
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
        }
    }
</style>
