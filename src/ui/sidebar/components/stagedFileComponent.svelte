<script lang="ts">
  import { setIcon } from "obsidian";
  import { hoverPreview, openOrSwitch } from "obsidian-community-lib";
  import { GitManager } from "src/gitManager";
  import { createEventDispatcher } from "svelte";
  import GitView from "../sidebarView";

  export let path: string;
  export let view: GitView;
  export let manager: GitManager;
  let buttons: HTMLElement[] = [];
  const dispatch = createEventDispatcher();

  setImmediate(() =>
    buttons.forEach((b) => setIcon(b, b.getAttr("data-icon"), 16))
  );

  function hover(event: MouseEvent) {
    //Don't show previews of config- or hidden files.
    if (!path.startsWith(view.app.vault.configDir) || !path.startsWith(".")) {
      hoverPreview(event, view, path.split("/").last().replace(".md", ""));
    }
  }

  function open(event: MouseEvent) {
    if (!path.startsWith(view.app.vault.configDir) || !path.startsWith(".")) {
      openOrSwitch(view.app, (event.target as HTMLElement).innerText, event);
    }
  }

  function unstage() {
    manager.unstage(path).then(() => {
      dispatch("git-refresh");
    });
  }
</script>

<main>
  <span
    class="path"
    on:mouseover={hover}
    on:click={open}
    aria-label-position="left"
    aria-label={path.split("/").last() != path ? path : ""}
  >
    {path.split("/").last().replace(".md", "")}
  </span>
  <div class="tools">
    <div class="buttons">
      <div
        data-icon="feather-minus"
        aria-label="Unstage"
        bind:this={buttons[0]}
        on:click={unstage}
      />
    </div>
    <span class="type" data-type="A">A</span>
  </div>
</main>

<style lang="scss">
  main {
    background-color: var(--background-secondary);
    border-radius: 4px;
    width: 98%;
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    margin-bottom: 2px;

    .path {
      color: var(--text-muted);
      white-space: nowrap;
      max-width: 75%;
      overflow: hidden;
      text-overflow: ellipsis;

      &:hover {
        color: var(--text-normal);
        transition: all 200ms;
      }
    }

    .tools {
      display: flex;
      align-items: center;

      .type {
        height: 16px;
        width: 16px;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: greenyellow;
      }
      .buttons {
        display: flex;
        > * {
          color: var(--text-faint);
          height: 16px;
          width: 16px;
          margin: 0;
          transition: all 0.2s;
          border-radius: 2px;
          margin-right: 1px;
          &:hover {
            color: var(--text-normal);
            background-color: var(--interactive-accent);
          }
        }
      }
    }
  }
</style>
