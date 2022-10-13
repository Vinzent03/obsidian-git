<!-- tslint:disable ts(2345)  -->
<script lang="ts">
	import ObsidianGit from "src/main";
	import { FileType, RootTreeItem, TreeItem } from "src/types";
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

	function stage(path: string) {
		plugin.gitManager.stageAll({ dir: path }).finally(() => {
			dispatchEvent(new CustomEvent("git-refresh"));
		});
	}
	function unstage(path: string) {
		plugin.gitManager.unstageAll({ dir: path }).finally(() => {
			dispatchEvent(new CustomEvent("git-refresh"));
		});
	}
	function fold(item: TreeItem) {
		closed[item.title] = !closed[item.title];
	}
</script>

<main class:topLevel>
	{#each hierarchy.children as entity}
		{#if entity.statusResult}
			<div>
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
					class="nav-folder-title"
					on:click|self={() => fold(entity)}
				>
					<div
						class="nav-folder-collapse-indicator collapse-icon"
						on:click={() => fold(entity)}
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
					<div
						on:click={() => fold(entity)}
						class="nav-folder-title-content"
					>
						{entity.title}
					</div>
					<div class="tools">
						<div class="buttons">
							{#if fileType == FileType.staged}
								<div
									data-icon="minus"
									aria-label="Unstage"
									on:click={() => unstage(entity.title)}
									class="clickable-icon"
								>
									<svg
										width="18"
										height="18"
										viewBox="0 0 18 18"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="svg-icon lucide-minus"
										><line
											x1="4"
											y1="9"
											x2="14"
											y2="9"
										/></svg
									>
								</div>
							{:else}
								<div
									data-icon="plus"
									aria-label="Stage"
									on:click={() => stage(entity.path)}
									class="clickable-icon"
								>
									<svg
										width="18"
										height="18"
										viewBox="0 0 18 18"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="svg-icon lucide-plus"
										><line
											x1="9"
											y1="4"
											x2="9"
											y2="14"
										/><line
											x1="4"
											y1="9"
											x2="14"
											y2="9"
										/></svg
									>
								</div>
							{/if}
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
	main {
		.nav-folder-title-content {
			display: flex;
			align-items: center;
		}
		.tools {
			display: flex;
			margin-left: auto;
			.buttons {
				display: flex;
				> * {
					padding: 0 0;
					height: auto;
				}
			}
		}
	}
</style>
