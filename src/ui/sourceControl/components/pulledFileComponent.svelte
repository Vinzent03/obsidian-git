<script lang="ts">
    import { TFile } from "obsidian";
    import { hoverPreview } from "obsidian-community-lib";
    import type { FileStatusResult } from "src/types";
    import { getDisplayPath, getNewLeaf, mayTriggerFileMenu } from "src/utils";
    import type GitView from "../sourceControl";

    interface Props {
        change: FileStatusResult;
        view: GitView;
    }

    let { change, view }: Props = $props();
    let side = $derived(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (view.leaf.getRoot() as any).side == "left" ? "right" : "left"
    );

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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<main
    onmouseover={hover}
    onclick={open}
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
        else open(event);
    }}
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
