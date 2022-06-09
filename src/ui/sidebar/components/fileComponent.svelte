<script lang="ts">
  import { setIcon, Workspace } from "obsidian";
  import { hoverPreview, openOrSwitch } from "obsidian-community-lib";
  import { DIFF_VIEW_CONFIG } from "src/constants";
  import { GitManager } from "src/gitManager";
  import { FileStatusResult } from "src/types";
  import { DiscardModal } from "src/ui/modals/discardModal";
  import GitView from "../sidebarView";

  export let change: FileStatusResult;
  export let view: GitView;
  export let manager: GitManager;
  export let workspace: Workspace;
  let buttons: HTMLElement[] = [];
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
        change.vault_path.split("/").last().replace(".md", "")
      );
    }
  }

  function open(event: MouseEvent) {
    if (
      !(
        change.path.startsWith(view.app.vault.configDir) ||
        change.path.startsWith(".") ||
        change.working_dir === "D"
      )
    ) {
      openOrSwitch(view.app as any, change.vault_path, event);
    }
  }

  function stage() {
    manager.stage(change.path).finally(() => {
      dispatchEvent(new CustomEvent("git-refresh"));
    });
  }

  function showDiff(event: MouseEvent) {
    const leaf = workspace.activeLeaf;

    if (
      leaf &&
      !leaf.getViewState().pinned &&
      !(event.ctrlKey || event.getModifierState("Meta"))
    ) {
      leaf.setViewState({
        type: DIFF_VIEW_CONFIG.type,
        state: {
          file: change.path,
          staged: false,
        },
      });
    } else {
      workspace.createLeafInParent(workspace.rootSplit, 0).setViewState({
        type: DIFF_VIEW_CONFIG.type,
        active: true,
        state: {
          file: change.path,
          staged: false,
        },
      });
    }
  }

  function discard() {
    const deleteFile = change.working_dir == "U";
    new DiscardModal(view.app, deleteFile, change.vault_path)
      .myOpen()
      .then((shouldDiscard) => {
        if (shouldDiscard === true) {
          if (deleteFile) {
            view.app.vault.adapter.remove(change.vault_path).finally(() => {
              dispatchEvent(new CustomEvent("git-refresh"));
            });
          } else {
            manager.discard(change.path).finally(() => {
              dispatchEvent(new CustomEvent("git-refresh"));
            });
          }
        }
      });
  }
</script>

<!-- TODO: Fix arai-label for left sidebar and if it's too long -->
<main on:mouseover={hover} on:click|self={showDiff} on:focus>
  <span
    class="path"
    aria-label-position={side}
    aria-label={change.vault_path.split("/").last() != change.vault_path ? change.vault_path : ""}
    on:click|self={showDiff}
  >
    {change.vault_path.split("/").last().replace(".md", "")}
  </span>
  <div class="tools">
    <div class="buttons">
      {#if view.app.vault.getAbstractFileByPath(change.vault_path)}
        <div
          data-icon="go-to-file"
          aria-label="Open File"
          bind:this={buttons[1]}
          on:click={open}
        />
      {/if}
      <div
        data-icon="skip-back"
        aria-label="Discard"
        bind:this={buttons[0]}
        on:click={discard}
      />
      <div
        data-icon="plus"
        aria-label="Stage"
        bind:this={buttons[2]}
        on:click={stage}
      />
    </div>
    <span class="type" data-type={change.working_dir}>{change.working_dir}</span
    >
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
