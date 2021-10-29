<script lang="ts">
  import { debounce, setIcon } from "obsidian";
  import ObsidianGit from "src/main";
  import { Status } from "src/types";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import FileComponent from "./components/fileComponent.svelte";
  import StagedFileComponent from "./components/stagedFileComponent.svelte";
  import GitView from "./sidebarView";

  export let plugin: ObsidianGit;
  export let view: GitView;
  let commitMessage = plugin.settings.commitMessage;
  let buttons: HTMLElement[] = [];
  let status: Promise<Status> | null;
  let changesOpen = true;
  let stagedOpen = true;
  let loading = true;

  //This should go in the onMount callback, for some reason it doesn't fire though
  //setImmediate's callback will execute after the current event loop finishes.
  plugin.app.workspace.onLayoutReady(() =>
    setImmediate(() => {
      buttons.forEach((btn) => setIcon(btn, btn.getAttr("data-icon"), 16));

      refresh();
      //Refresh every ten minutes
      plugin.registerInterval(window.setInterval(refresh, 600000));
      plugin.registerEvent(
        plugin.app.metadataCache.on(
          "resolved",
          debounce(() => refresh, 10000)
        )
      );
    })
  );

  function commitAll() {}
  function refresh() {
    const promise = plugin.gitManager.status();
    loading = true;
    promise.then((s) => {
      //If File is already staged, don't show it as duplicate under changed
      s.changed = s.changed.filter((pre) => !s.staged.contains(pre.path));
      //Dont "remove" the content while the promise is still pending
      status = promise;
      loading = false;
    });
  }
  function stageAll() {
    
  }
  function push() {}
  function pull() {}
</script>

<main>
  <div class="control">
    <div class="nav-buttons-container">
      <div class="group">
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
        class:loading
        data-icon="feather-refresh-cw"
        aria-label="Refresh"
        bind:this={buttons[4]}
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
  </div>
  <div class="contents">
    {#if status}
      {#await status then resolvedStatus}
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
            <span class="tree-item-flair">{resolvedStatus.staged.length}</span>
          </div>
          {#if stagedOpen}
            <div class="file-view" transition:slide|local={{ duration: 150 }}>
              {#each resolvedStatus.staged as stagedFile}
                <StagedFileComponent path={stagedFile} {view} manager={plugin.gitManager}/>
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
            <span class="tree-item-flair">{resolvedStatus.changed.length}</span>
          </div>
          {#if changesOpen}
            <div class="file-view" transition:slide|local={{ duration: 150 }}>
              {#each resolvedStatus.changed as change}
                <FileComponent {change} {view} manager={plugin.gitManager} />
              {/each}
            </div>
          {/if}
        </div>
      {/await}
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
  .contents {
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
