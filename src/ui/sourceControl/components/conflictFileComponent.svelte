<script lang="ts">
    import { TFile } from "obsidian";
    import type { GitManager } from "src/gitManager/gitManager";
    import { getDisplayPath, getNewLeaf, getTooltipSide } from "src/utils";
    import type GitView from "../sourceControl";

    interface Props {
        path: string;
        view: GitView;
        manager: GitManager;
    }

    let { path, view, manager }: Props = $props();

    let vaultPath = $derived(manager.getRelativeVaultPath(path));
    let side = $derived(getTooltipSide(view.leaf));

    function open(event: MouseEvent) {
        event.stopPropagation();
        const file = view.app.vault.getAbstractFileByPath(vaultPath);
        if (file instanceof TFile) {
            getNewLeaf(view.app, event)
                ?.openFile(file)
                .catch((e) => view.plugin.displayError(e));
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_unknown_aria_attribute -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<main onclick={open} class="tree-item nav-file">
    <div
        class="tree-item-self is-clickable nav-file-title"
        data-path={vaultPath}
        data-tooltip-position={side}
        aria-label={vaultPath}
    >
        <div class="tree-item-inner nav-file-title-content">
            {getDisplayPath(vaultPath)}
        </div>
    </div>
</main>
