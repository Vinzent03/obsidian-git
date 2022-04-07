<script lang="ts">
  import { setIcon } from "obsidian";
  import { hoverPreview, openOrSwitch } from "obsidian-community-lib";
  import { DIFF_VIEW_CONFIG } from "src/constants";
  import { GitManager } from "src/gitManager";
  import { FileStatusResult } from "src/types";
  import GitView from "../sidebarView";

  export let change: FileStatusResult;
  export let view: GitView;
  export let manager: GitManager;
  let buttons: HTMLElement[] = [];
  $: formattedPath = change.path;
  $: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

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
        view as any,
        formattedPath.split("/").last().replace(".md", "")
      );
    }
  }

  function open(event: MouseEvent) {
    if (
      !(
        change.path.startsWith(view.app.vault.configDir) ||
        change.path.startsWith(".") ||
        change.index === "D"
      )
    ) {
      openOrSwitch(view.app as any, formattedPath, event);
    }
  }

  function showDiff(event: MouseEvent) {
    const leaf = view.app.workspace.activeLeaf;

    if (
      leaf &&
      !leaf.getViewState().pinned &&
      !(event.ctrlKey || event.getModifierState("Meta"))
    ) {
      leaf.setViewState({
        type: DIFF_VIEW_CONFIG.type,
        state: {
          file: change.path,
          staged: true,
        },
      });
    } else {
      view.app.workspace
        .createLeafInParent(view.app.workspace.rootSplit, 0)
        .setViewState({
          type: DIFF_VIEW_CONFIG.type,
          active: true,
          state: {
            file: change.path,
            staged: true,
          },
        });
    }
  }

  function unstage() {
    manager.unstage(formattedPath).finally(() => {
      dispatchEvent(new CustomEvent("git-refresh"));
    });
  }
</script>

<main on:mouseover={hover} on:focus on:click|self={showDiff}>
  <span
    class="path"
    aria-label-position={side}
    aria-label={change.path.split("/").last() != change.path ? change.path : ""}
    on:click={showDiff}
  >
    {formattedPath.split("/").last().replace(".md", "")}
  </span>
  <div class="tools">
    <div class="buttons">
      {#if view.app.vault.getAbstractFileByPath(change.path)}
        <div
          data-icon="go-to-file"
          aria-label="Open File"
          bind:this={buttons[1]}
          on:click={open}
        />
      {/if}
      <div
        data-icon="minus"
        aria-label="Unstage"
        bind:this={buttons[0]}
        on:click={unstage}
      />
    </div>
    <span class="type" data-type={change.index}>{change.index}</span>
  </div>
</main>

<style lang="scss">
  main {
    cursor: pointer;
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
    }

    &:hover .path {
      color: var(--text-normal);
      transition: all 200ms;
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
        &[data-type="D"] {
          color: red;
        }
        &[data-type="A"] {
          color: yellowgreen;
        }
        &[data-type="R"] {
          color: violet;
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
