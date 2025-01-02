<script lang="ts">
    interface Props {
        files: unknown[];
    }

    let { files }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main>
    {#if files.length > 500}
        <div class="tree-item nav-file">
            <div
                class="tree-item-self nav-file-title"
                aria-label={"And " + (files.length - 500) + " more files"}
            >
                <div class="tree-item-inner nav-file-title-content">
                    {"And " + (files.length - 500) + " more files"}
                </div>
            </div>
        </div>
    {/if}
</main>
