<script lang="ts">
	import { TFile } from "obsidian";
	import { hoverPreview } from "obsidian-community-lib";
	import { FileStatusResult } from "src/types";
	import { getNewLeaf } from "src/utils";
	import GitView from "../sidebarView";

	export let change: FileStatusResult;
	export let view: GitView;
	$: side = (view.leaf.getRoot() as any).side == "left" ? "right" : "left";

	function hover(event: MouseEvent) {
		//Don't show previews of config- or hidden files.
		if (
			!change.path.startsWith(view.app.vault.configDir) ||
			!change.path.startsWith(".")
		) {
			hoverPreview(
				event,
				view as any,
				change.vault_path.split("/").last()!.replace(".md", "")
			);
		}
	}

	function open(event: MouseEvent) {
		const file = view.app.vault.getAbstractFileByPath(change.vault_path);
		if (file instanceof TFile) {
			getNewLeaf(event)?.openFile(file);
		}
	}
</script>

<main on:mouseover={hover} on:click={open} on:focus class="nav-file">
	<!-- svelte-ignore a11y-unknown-aria-attribute -->
	<div
		class="nav-file-title"
		aria-label-position={side}
		aria-label={change.vault_path.split("/").last() != change.vault_path
			? change.vault_path
			: ""}
	>
		<div class="nav-file-title-content">
			{change.vault_path.split("/").last()?.replace(".md", "")}
		</div>
		<div class="tools">
			<span class="type" data-type={change.working_dir}
				>{change.working_dir}</span
			>
		</div>
	</div>
</main>

<style lang="scss">
	main {
		.nav-file-title-content {
			display: flex;
			align-items: center;
		}
		.tools {
			display: flex;
			margin-left: auto;
			.type {
				padding-left: var(--size-2-1);
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
		}
	}
</style>
