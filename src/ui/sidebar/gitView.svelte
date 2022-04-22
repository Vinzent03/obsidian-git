<script lang="ts">
  import { debounce, EventRef, MetadataCache, setIcon } from "obsidian";
  import ObsidianGit from "src/main";
  import { Status, TreeItem } from "src/types";
  import { onDestroy } from "svelte";
  import { slide } from "svelte/transition";
  import FileComponent from "./components/fileComponent.svelte";
  import StagedFileComponent from "./components/stagedFileComponent.svelte";
  import TreeComponent from "./components/treeComponent.svelte";
  import GitView from "./sidebarView";

  export let plugin: ObsidianGit;
  export let view: GitView;
  let commitMessage = plugin.settings.commitMessage;
  let buttons: HTMLElement[] = [];
  let status: Status | null;
  let changeHierarchy: TreeItem;
  let stagedHierarchy: TreeItem;
  let changesOpen = true;
  let stagedOpen = true;
  let loading = true;
  const debRefresh = debounce(
    () => {
      if (plugin.settings.refreshSourceControl) {
        refresh();
      }
    },
    7000,
    true
  );

  let showTree = plugin.settings.treeStructure;
  let layoutBtn: HTMLElement;
  $: {
    if (layoutBtn) {
      layoutBtn.empty();
      setIcon(layoutBtn, showTree ? "list" : "folder", 16);
    }
  }

  let modifyEvent: EventRef;
  let deleteEvent: EventRef;
  let createEvent: EventRef;
  let renameEvent: EventRef;

  addEventListener("git-refresh", refresh);
  //This should go in the onMount callback, for some reason it doesn't fire though
  //setImmediate's callback will execute after the current event loop finishes.
  plugin.app.workspace.onLayoutReady(() =>
    setImmediate(() => {
      buttons.forEach((btn) => setIcon(btn, btn.getAttr("data-icon"), 16));
      setIcon(layoutBtn, showTree ? "list" : "folder", 16);

      modifyEvent = plugin.app.vault.on("modify", () => {
        debRefresh();
      });
      deleteEvent = plugin.app.vault.on("delete", () => {
        debRefresh();
      });
      createEvent = plugin.app.vault.on("create", () => {
        debRefresh();
      });
      renameEvent = plugin.app.vault.on("rename", () => {
        debRefresh();
      });

      plugin.registerEvent(modifyEvent);
      plugin.registerEvent(deleteEvent);
      plugin.registerEvent(createEvent);
      plugin.registerEvent(renameEvent);
    })
  );

  onDestroy(() => {
    plugin.app.metadataCache.offref(modifyEvent);
    plugin.app.metadataCache.offref(deleteEvent);
    plugin.app.metadataCache.offref(createEvent);
    plugin.app.metadataCache.offref(renameEvent);
    removeEventListener("git-refresh", refresh);
  });

  function commit() {
    loading = true;
    plugin.gitManager
      .commit(commitMessage)
      .then(() => {
        if (commitMessage !== plugin.settings.commitMessage) {
          commitMessage = "";
        }
      })
      .finally(refresh);
  }

  async function refresh() {
    loading = true;

    status = await plugin.gitManager.status();

    changeHierarchy = {
      title: "",
      children: plugin.gitManager.getTreeStructure(status.changed),
    };
    stagedHierarchy = {
      title: "",
      children: plugin.gitManager.getTreeStructure(status.staged),
    };

    loading = false;
  }

  function stageAll() {
    loading = true;
    plugin.gitManager.stageAll().finally(refresh);
  }
  function unstageAll() {
    loading = true;
    plugin.gitManager.unstageAll().finally(refresh);
  }
  function push() {
    loading = true;

    if (ready) {
      plugin.push().finally(refresh);
    }
  }
  function pull() {
    loading = true;
    plugin.pullChangesFromRemote().finally(refresh);
  }
</script>

<main>
  <div class="nav-buttons-container">
    <div class="group">
      <div
        id="commit-btn"
        data-icon="check"
        class="nav-action-button"
        aria-label="Commit"
        bind:this={buttons[0]}
        on:click={commit}
      />
      <div
        id="stage-all"
        class="nav-action-button"
        data-icon="plus-circle"
        aria-label="Stage all"
        bind:this={buttons[1]}
        on:click={stageAll}
      />
      <div
        id="unstage-all"
        class="nav-action-button"
        data-icon="minus-circle"
        aria-label="Unstage all"
        bind:this={buttons[2]}
        on:click={unstageAll}
      />
      <div
        id="push"
        class="nav-action-button"
        data-icon="upload"
        aria-label="Push"
        bind:this={buttons[3]}
        on:click={push}
      />
      <div
        id="pull"
        class="nav-action-button"
        data-icon="download"
        aria-label="Pull"
        bind:this={buttons[4]}
        on:click={pull}
      />
      <div
        id="layoutChange"
        class="nav-action-button"
        aria-label="Change Layout"
        bind:this={layoutBtn}
        on:click={() => {
          showTree = !showTree;
          plugin.settings.treeStructure = showTree;
          plugin.saveSettings();
        }}
      />
    </div>
    <div
      id="refresh"
      class="nav-action-button"
      class:loading
      data-icon="refresh-cw"
      aria-label="Refresh"
      bind:this={buttons[6]}
      on:click={refresh}
    />
    <div class="search-input-container">
      <textarea
        class="commit-msg"
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
            {#if showTree}
              <TreeComponent
                hierarchy={stagedHierarchy}
                {plugin}
                {view}
                staged={true}
                topLevel={true}
              />
            {:else}
              {#each status.staged as stagedFile}
                <StagedFileComponent
                  change={stagedFile}
                  {view}
                  manager={plugin.gitManager}
                />
              {/each}
            {/if}
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
            {#if showTree}
              <TreeComponent
                hierarchy={changeHierarchy}
                {plugin}
                {view}
                staged={false}
                topLevel={true}
              />
            {:else}
              {#each status.changed as change}
                <FileComponent
                  {change}
                  {view}
                  manager={plugin.gitManager}
                  workspace={plugin.app.workspace}
                  on:git-refresh={refresh}
                />
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style lang="scss">
  .commit-msg {
    width: 100%;
    min-height: 1.9em;
    height: 1.9em;
    resize: vertical;
    padding: 2px 5px;
    background-color: var(--background-modifier-form-field);
  }

  .search-input-container {
    width: 100%;
  }

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
    overflow-y: auto;
    padding-left: 10px;
  }
  main {
    display: flex;
    flex-direction: column;
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
