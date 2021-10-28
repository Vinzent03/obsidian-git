<script lang="ts">
  import { log } from "console";

  import { setIcon } from "obsidian";
  import ObsidianGit from "src/main";
  import { Status } from "src/types";
  import { onMount } from "svelte";
  import FileComponent from "./components/fileComponent.svelte";
  import GitView from "./sidebarView";

  export let plugin: ObsidianGit;
  export let view: GitView;
  let commitMessage = plugin.settings.commitMessage;
  let buttons: HTMLElement[] = [];
  let status: Promise<Status> | null;

  plugin.app.workspace.onLayoutReady(() => {
    setImmediate(() => {
      status = plugin.gitManager.status();
    });
  });

  //This should go in the onMount callback, for some reason it doesn't fire though
  //setImmediate's callback will execute after the current event loop finishes.
  setImmediate(() => {
    buttons.forEach((btn) => setIcon(btn, btn.getAttr("data-icon"), 16));
  });

  function commitAll() {}
  function refresh() {
    status = plugin.gitManager.status();
  }
  function stageAll() {}
  function push() {}
  function pull() {}
</script>

<main>
  <div class="control">
    <div class="nav-buttons-container">
      <div class="btnGroup">
        <div
          id="commit-btn"
          data-icon="feather-check"
          class="nav-action-button"
          aria-label="Commit"
          bind:this={buttons[0]}
          on:click={commitAll}
        />
        <div
          id="stage-all"
          class="nav-action-button"
          data-icon="feather-plus-circle"
          aria-label="Stage all"
          bind:this={buttons[1]}
          on:click={stageAll}
        />
        <div
          id="push"
          class="nav-action-button"
          data-icon="feather-upload"
          aria-label="Push"
          bind:this={buttons[2]}
          on:click={push}
        />
        <div
          id="pull"
          class="nav-action-button"
          data-icon="feather-download"
          aria-label="Pull"
          bind:this={buttons[3]}
          on:click={pull}
        />
      </div>
      <div
        id="refresh"
        class="nav-action-button"
        data-icon="feather-refresh-cw"
        aria-label="Refresh"
        bind:this={buttons[4]}
        on:click={refresh}
      />
    </div>
    <div class="search-input-container">
      <input
        type="text"
        spellcheck="true"
        placeholder="Commit Message"
        bind:value={commitMessage}
      />
      {#if commitMessage}
        <div
          class="search-input-clear-button"
          on:click={() => (commitMessage = "")}
          aria-label={"Clear"}
        />
      {/if}
    </div>
  </div>
  <div class="contents">
    {#if status}
      {#await status then resolvedStatus}
        <div class="changes">
          {#each resolvedStatus.changed as change}
            <FileComponent {change} {view} />
          {/each}
        </div>
      {/await}
    {/if}
  </div>
</main>

<style lang="scss">
  .contents {
    height: calc(100% - 5rem);
    overflow-y: auto;
    padding-left: 10px;
  }
  main {
    height: 100%;
    overflow-y: hidden;
  }

  .nav-buttons-container {
    justify-content: space-between;
  }

  .btnGroup {
    display: flex;
  }
</style>
