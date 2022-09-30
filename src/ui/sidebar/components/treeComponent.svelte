<!-- tslint:disable ts(2345)  -->
<script lang="ts">
	import ObsidianGit from "src/main";
	import { FileType, RootTreeItem } from "src/types";
	import { slide } from "svelte/transition";
	import GitView from "../sidebarView";
	import FileComponent from "./fileComponent.svelte";
	import PulledFileComponent from "./pulledFileComponent.svelte";
	import StagedFileComponent from "./stagedFileComponent.svelte";
	export let hierarchy: RootTreeItem;
	export let plugin: ObsidianGit;
	export let view: GitView;
	export let fileType: FileType;
	export let topLevel = false;

	const closed: Record<string, boolean> = {};
</script>

<main class:topLevel>
	{#each hierarchy.children as entity}
		{#if entity.statusResult}
			<div class="file-view">
				{#if fileType == FileType.staged}
					<StagedFileComponent
						change={entity.statusResult}
						manager={plugin.gitManager}
						{view}
					/>
				{:else if fileType == FileType.changed}
					<FileComponent
						change={entity.statusResult}
						manager={plugin.gitManager}
						{view}
					/>
				{:else if fileType == FileType.pulled}
					<PulledFileComponent change={entity.statusResult} {view} />
				{/if}
			</div>
		{:else}
			<div class="nav-folder" class:is-collapsed={closed[entity.title]}>
				<div
					on:click={() =>
						(closed[entity.title] = !closed[entity.title])}
				>
					<div class="nav-folder-title">
						<div
							class="nav-folder-collapse-indicator collapse-icon"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="svg-icon right-triangle"
								><path d="M3 8L12 17L21 8" /></svg
							>
						</div>
						<div class="nav-folder-title-content">
							{entity.title}
						</div>
					</div>
				</div>

				{#if !closed[entity.title]}
					<div
						class="nav-folder-children"
						transition:slide|local={{ duration: 150 }}
					>
						<svelte:self
							hierarchy={entity}
							{plugin}
							{view}
							{fileType}
						/>
					</div>
				{/if}
			</div>
		{/if}
	{/each}
</main>

<style lang="scss">
	// main:not(.topLevel) {
	// 	margin-left: 5px;
	// }

	// .opener {
	// 	display: flex;
	// 	justify-content: space-between;
	// 	align-items: center;
	// 	padding: 0 4px;
	// 	.collapse-icon::after {
	// 		content: "\00a0";
	// 	}

	// 	div {
	// 		display: flex;
	// 	}
	// 	svg {
	// 		transform: rotate(-90deg);
	// 	}
	// 	&.open svg {
	// 		transform: rotate(0);
	// 	}
	// 	span {
	// 		font-size: 0.8rem;
	// 	}
	// }

	// .file-view {
	// 	margin-left: 9px;
	// }
</style>
