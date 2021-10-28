<script lang="ts">
  import { hoverPreview } from "obsidian-community-lib";

  import { FileStatusResult } from "src/types";
  import GitView from "../sidebarView";

  export let change: FileStatusResult;
  export let view: GitView;
  function hover(event: MouseEvent) {
    if (change.path.endsWith(".md")) {
      hoverPreview(event, view, change.path.split('/').last().replace('.md', ''))
    }
  }
</script>

<main>
  <p class="path" on:mouseover={hover} aria-label={change.path}>
    {change.path.split("/").last()}
  </p>
  <div>
    <div class="buttons" />
    <div class="type" data-type="M">M</div>
  </div>
</main>

<style lang="scss">
  main {
    background-color: var(--background-secondary);
    border-radius: 4px;
    width: 98%;
    padding: 4px;
    margin: 4px;
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;

    .path {
      margin: initial;
      color: var(--text-muted);
      white-space: nowrap;
      max-width: 75%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .type[data-type="M"] {
      color: orange;
    }
  }
</style>
