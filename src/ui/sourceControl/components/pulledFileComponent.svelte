<script lang="ts">
    import { TFile } from "obsidian";
    import { hoverPreview } from "obsidian-community-lib";
    import type { FileStatusResult } from "src/types";
    import { getDisplayPath, getNewLeaf, mayTriggerFileMenu } from "src/utils";
    import type GitView from "../sourceControl";

    export let change: FileStatusResult;
    export let view: GitView;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

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
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<main
    on:mouseover={hover}
    on:click|stopPropagation={open}
    on:auxclick|stopPropagation={(event) => {
        if (event.button == 2)
            mayTriggerFileMenu(
                view.app,
                event,
                change.vaultPath,
                view.leaf,
                "git-source-control"
            );
        else open(event);
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
        <div class="tree-item-inner nav-file-title-content">
            {getDisplayPath(change.vaultPath)}
        </div>
        <div class="git-tools">
            <span class="type" data-type={change.workingDir}
                >{change.workingDir}</span
            >
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
