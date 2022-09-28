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
			<div
				class="opener tree-item-self is-clickable"
				class:open={!closed[entity.title]}
				on:click={() => {
					closed[entity.title] = !closed[entity.title];
				}}
			>
				<div
					style="padding-left: 10px; padding-bottom: 2px; padding-top:2px;"
				>
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
					<span>{entity.title}</span>
				</div>
			</div>
			{#if !closed[entity.title]}
				<div
					class="file-view"
					transition:slide|local={{ duration: 75 }}
				>
					<svelte:self
						hierarchy={entity}
						{plugin}
						{view}
						{fileType}
					/>
				</div>
			{/if}
		{/if}
	{/each}
</main>

<style lang="scss">
	main:not(.topLevel) {
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
		span {
			font-size: 0.8rem;
		}
	}

	.file-view {
		margin-left: 9px;
	}
</style>
