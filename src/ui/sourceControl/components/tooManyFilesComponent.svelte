<script lang="ts">
    export let files: unknown[];
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
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
