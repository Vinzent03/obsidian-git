<script lang="ts">
  import ObsidianGit from "src/main";
  import { slide } from "svelte/transition";
  import GitView from "../sidebarView";
  import FileComponent from "./fileComponent.svelte";
  import StagedFileComponent from "./stagedFileComponent.svelte";
  export let hierarchy: any;
  export let plugin: ObsidianGit;
  export let view: GitView;
  export let staged: boolean;
  export let topLevel = false;
  let open: boolean[] = [];
</script>

<main class:topLevel>
  {#each Object.keys(hierarchy) as entity, index}
    <!-- this will break if there is a file called "_file_" without extension -->
    {#if hierarchy[entity]._file_}
      <div class="file-view">
        {#if staged}
          <StagedFileComponent
            change={hierarchy[entity]._file_}
            manager={plugin.gitManager}
            {view}
          />
        {:else}
          <FileComponent
            change={hierarchy[entity]._file_}
            manager={plugin.gitManager}
            {view}
            workspace={plugin.app.workspace}
          />
        {/if}
      </div>
    {:else}
      <div
        class="opener tree-item-self is-clickable"
        class:open={open[index]}
        on:click={() => (open[index] = !open[index])}
      >
        <div>
          <div class="tree-item-icon collapse-icon" style="">
            <svg
              viewBox="0 0 100 100"
              class="right-triangle"
              width="8"
              height="8"
              ><path
                fill="currentColor"
                stroke="currentColor"
                d="M94.9,20.8c-1.4-2.5-4.1-4.1-7.1-4.1H12.2c-3,0-5.7,1.6-7.1,4.1c-1.3,2.4-1.2,5.2,0.2,7.6L43.1,88c1.5,2.3,4,3.7,6.9,3.7 s5.4-1.4,6.9-3.7l37.8-59.6C96.1,26,96.2,23.2,94.9,20.8L94.9,20.8z"
              /></svg
            >
          </div>
          <span>{entity}</span>
        </div>
      </div>
      {#if open[index]}
        <div class="file-view" transition:slide|local={{ duration: 75 }}>
          <svelte:self hierarchy={hierarchy[entity]} {plugin} {view} {staged} />
        </div>
      {/if}
    {/if}
  {/each}
</main>

<style lang="scss">
  main:not(.topLevel) {
    margin-left: 5px;
  }

  .opener {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
    .collapse-icon::after {
      content: "\00a0";
    }

    div {
      display: flex;
    }
    svg {
      transform: rotate(-90deg);
    }
    &.open svg {
      transform: rotate(0);
    }
    span {
      font-size: 0.8rem;
    }
  }

  .file-view {
    margin-left: 5px;
  }
</style>
