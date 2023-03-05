<script lang="ts">
    import { GitManager } from "../../../gitManager";
    import { TFile } from "obsidian";

    export let gitManager: GitManager;
    export let file: TFile;

    let items: { date: string; content: string; }[] = [];
    let activeIndex: number = 0;

    gitManager.log(file.path).then(async (result) => {
        const temp = [];
        for (const r of result) {
            temp.push({
                date: r.date,
                content: await gitManager.show(r.hash, file.path),
            });
        }
        items = temp;
    });
</script>

<style lang="scss">
    .obsidian-git-file-history-parent {
        display: flex;
        .items-list {
            width: 30%;
            .item {
                width: 200px;
                padding: var(--size-4-1) var(--size-4-2);
                font-size: calc(var(--font-ui-small) + 1px);
                border-radius: var(--radius-s);
            }
            .item:hover {
                background-color: var(--background-modifier-hover);
            }
            .is-active {
                background-color: var(--interactive-accent);
            }
            .is-active:hover {
                background-color: var(--interactive-accent);
            }
        }
        .content-area {
            margin-top: 20px;
            width: 70%;
            height: 550px;
        }
    }
</style>

<div class="obsidian-git-file-history-parent">
    <div class="items-list">
        {#each items as item, i}
            <div class="item" class:is-active={i === activeIndex} on:click={() => { activeIndex = i }}>
                {item.date}
            </div>
        {/each}
    </div>
    <textarea class="content-area" spellcheck="false" disabled>
        {items[activeIndex]?.content}
    </textarea>
</div>
