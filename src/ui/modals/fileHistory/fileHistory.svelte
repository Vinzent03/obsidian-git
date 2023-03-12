<script lang="ts">
    import { GitManager } from "../../../gitManager";
    import { TFile } from "obsidian";

    export let gitManager: GitManager;
    export let file: TFile;

    let items: { date: string; message: string; content: string; }[] = [];
    let activeIndex: number = 0;

    const main = async () => {
        const result = await gitManager.log(file.path);
        for (const r of result) {
            items.push({
                date: r.date,
                message: r.message,
                content: await gitManager.show(r.hash, file.path),
            });
        }
        items = items;
    };

    main();
</script>

<style lang="scss">
    .obsidian-git-file-history-parent {
        display: flex;
        height: 100%;
        .items-list::-webkit-scrollbar {
            display: none;
        }
        .items-list {
            width: 30%;
            margin-right: 10px;
            overflow-y: scroll;
            .item {
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
            padding-top: 20px;
            width: 70%;
            textarea {
                width: 100%;
                height: 100%;
                resize: none;
            }
        }
    }
</style>

<div class="obsidian-git-file-history-parent">
    <div class="items-list">
        {#each items as item, i}
            <div class="item" class:is-active={i === activeIndex} on:click={() => { activeIndex = i }}>
                <div>{item.message}</div>
                <div>{item.date}</div>
            </div>
        {/each}
    </div>
    <div class="content-area">
        <textarea spellcheck="false" disabled>{items[activeIndex]?.content}</textarea>
    </div>
</div>
