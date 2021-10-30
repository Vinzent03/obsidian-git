<script lang="ts">
  import { setIcon } from "obsidian";

  import { hoverPreview, openOrSwitch } from "obsidian-community-lib";
  import { GitManager } from "src/gitManager";

  import { FileStatusResult } from "src/types";
  import GitView from "../sidebarView";

  export let change: FileStatusResult;
  export let view: GitView;
  export let manager: GitManager;
  let buttons: HTMLElement[] = [];

  setImmediate(() =>
    buttons.forEach((b) => setIcon(b, b.getAttr("data-icon"), 16))
  );

  function hover(event: MouseEvent) {
    //Don't show previews of config- or hidden files.
    if (
      !change.path.startsWith(view.app.vault.configDir) ||
      !change.path.startsWith(".")
    ) {
      hoverPreview(
        event,
        view,
        change.path.split("/").last().replace(".md", "")
      );
    }
  }

  function open(event: MouseEvent) {
    if (
      !change.path.startsWith(view.app.vault.configDir) ||
      !change.path.startsWith(".")
    ) {
      openOrSwitch(view.app, (event.target as HTMLElement).innerText, event);
    }
  }

  function stage() {
    //Stage File
  }

  function discard() {
    //Maybe ask for confirmation before actually reverting the file
  }
</script>

<main>
  <span
    class="path"
    on:mouseover={hover}
    on:click={open}
    aria-label-position="left"
    aria-label={change.path.split("/").last() != change.path ? change.path : ""}
  >
    {change.path.split("/").last().replace(".md", "")}
  </span>
  <div class="tools">
    <div class="buttons">
      <div
        data-icon="feather-skip-back"
        aria-label="Discard"
        bind:this={buttons[0]}
        on:click={discard}
      />
      <div
        data-icon="feather-plus"
        aria-label="Stage"
        bind:this={buttons[1]}
        on:click={stage}
      />
    </div>
    <span class="type" data-type="M">M</span>
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
        &[data-type="M"] {
          color: orange;
        }
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
