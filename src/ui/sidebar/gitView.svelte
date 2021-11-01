<script lang="ts">
  import { debounce, EventRef, setIcon } from "obsidian";
  import ObsidianGit from "src/main";
  import { Status } from "src/types";
  import { onDestroy } from "svelte";
  import { slide } from "svelte/transition";
  import FileComponent from "./components/fileComponent.svelte";
  import StagedFileComponent from "./components/stagedFileComponent.svelte";
  import GitView from "./sidebarView";

  export let plugin: ObsidianGit;
  export let view: GitView;
  let commitMessage = plugin.settings.commitMessage;
  let buttons: HTMLElement[] = [];
  let status: Status | null;
  let changesOpen = true;
  let stagedOpen = true;
  let loading = true;
  const debRefresh = debounce(() => refresh(), 300000);
  //Refresh every ten minutes
  const interval = window.setInterval(refresh, 600000);

  let event: EventRef;
  //This should go in the onMount callback, for some reason it doesn't fire though
  //setImmediate's callback will execute after the current event loop finishes.
  plugin.app.workspace.onLayoutReady(() =>
    setImmediate(() => {
      buttons.forEach((btn) => setIcon(btn, btn.getAttr("data-icon"), 16));

      refresh();

      event = plugin.app.metadataCache.on("resolved", () => {
        debRefresh();
      });

      plugin.registerInterval(interval);
      plugin.registerEvent(event);
    })
  );
  onDestroy(() => {
    window.clearInterval(interval);
    plugin.app.metadataCache.offref(event);
  });

  function commit() {
    loading = true;
    plugin.gitManager.commit(commitMessage).then(() => {
      if (commitMessage !== plugin.settings.commitMessage) {
        commitMessage = "";
      }
      refresh();
    });
  }

  function refresh() {
    const promise = plugin.gitManager.status();
    loading = true;
    promise.then((s) => {
      status = s;
      loading = false;
    });
  }
  function stageAll() {
    loading = true;
    plugin.gitManager.stageAll().then(() => {
      refresh();
    });
  }
  function unstageAll() {
    loading = true;
    plugin.gitManager.unstageAll().then(() => {
      refresh();
    });
  }
  function push() {
    loading = true;
    plugin.remotesAreSet().then((ready) => {
      if (ready) {
        plugin.gitManager.push().then((pushedFiles) => {
          plugin.displayMessage(`Pushed ${pushedFiles} files to remote`);
          refresh();
        });
      }
    });
  }
  function pull() {
    loading = true;
    plugin.pullChangesFromRemote().then(() => {
      refresh();
    });
  }
</script>

<main>
  <div class="nav-buttons-container">
    <div class="group">
      <div
        id="commit-btn"
        data-icon="feather-check"
        class="nav-action-button"
        aria-label="Commit"
        bind:this={buttons[0]}
        on:click={commit}
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
        id="unstage-all"
        class="nav-action-button"
        data-icon="feather-minus-circle"
        aria-label="Unstage all"
        bind:this={buttons[2]}
        on:click={unstageAll}
      />
      <div
        id="push"
        class="nav-action-button"
        data-icon="feather-upload"
        aria-label="Push"
        bind:this={buttons[3]}
        on:click={push}
      />
      <div
        id="pull"
        class="nav-action-button"
        data-icon="feather-download"
        aria-label="Pull"
        bind:this={buttons[4]}
        on:click={pull}
      />
    </div>
    <div
      id="refresh"
      class="nav-action-button"
      class:loading
      data-icon="feather-refresh-cw"
      aria-label="Refresh"
      bind:this={buttons[5]}
      on:click={refresh}
    />
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
  <div class="git-view-body">
    {#if status}
      <div class="staged">
        <div
          class="opener tree-item-self is-clickable"
          class:open={stagedOpen}
          on:click={() => (stagedOpen = !stagedOpen)}
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
            <span>Staged Changes</span>
          </div>
          <span class="tree-item-flair">{status.staged.length}</span>
        </div>
        {#if stagedOpen}
          <div class="file-view" transition:slide|local={{ duration: 150 }}>
            {#each status.staged as stagedFile}
              <StagedFileComponent
                change={stagedFile}
                {view}
                manager={plugin.gitManager}
                on:git-refresh={refresh}
              />
            {/each}
          </div>
        {/if}
      </div>
      <div class="changes">
        <div
          class="opener tree-item-self is-clickable"
          class:open={changesOpen}
          on:click={() => (changesOpen = !changesOpen)}
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
            <span>Changes</span>
          </div>
          <span class="tree-item-flair">{status.changed.length}</span>
        </div>
        {#if changesOpen}
          <div class="file-view" transition:slide|local={{ duration: 150 }}>
            {#each status.changed as change}
              <FileComponent
                {change}
                {view}
                manager={plugin.gitManager}
                on:git-refresh={refresh}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style lang="scss">
  .file-view {
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
  }
  .git-view-body {
    height: calc(100% - 5rem);
    overflow-y: scroll;
    padding-left: 10px;
  }
  main {
    height: 100%;
    overflow-y: hidden;
  }

  .nav-buttons-container {
    justify-content: space-between;
  }

  .group {
    display: flex;
  }
</style>
