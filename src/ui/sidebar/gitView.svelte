<script lang="ts">
	import { setIcon } from "obsidian";
	import ObsidianGit from "src/main";
	import {
		FileStatusResult,
		FileType,
		PluginState,
		RootTreeItem,
		Status,
	} from "src/types";
	import { onDestroy } from "svelte";
	import { slide } from "svelte/transition";
	import FileComponent from "./components/fileComponent.svelte";
	import PulledFileComponent from "./components/pulledFileComponent.svelte";
	import StagedFileComponent from "./components/stagedFileComponent.svelte";
	import TreeComponent from "./components/treeComponent.svelte";
	import GitView from "./sidebarView";

	export let plugin: ObsidianGit;
	export let view: GitView;
	let loading: boolean;
	let status: Status | undefined;
	let lastPulledFiles: FileStatusResult[] = [];
	let commitMessage = plugin.settings.commitMessage;
	let buttons: HTMLElement[] = [];
	let changeHierarchy: RootTreeItem | undefined;
	let stagedHierarchy: RootTreeItem | undefined;
	let lastPulledFilesHierarchy: RootTreeItem;
	let changesOpen = true;
	let stagedOpen = true;
	let lastPulledFilesOpen = true;

	let showTree = plugin.settings.treeStructure;
	let layoutBtn: HTMLElement;
	$: {
		if (layoutBtn) {
			layoutBtn.empty();
			setIcon(layoutBtn, showTree ? "list" : "folder", 16);
		}
	}
	addEventListener("git-view-refresh", refresh);
	//This should go in the onMount callback, for some reason it doesn't fire though
	//setTimeout's callback will execute after the current event loop finishes.
	plugin.app.workspace.onLayoutReady(() => {
		window.setTimeout(() => {
			buttons.forEach((btn) =>
				setIcon(btn, btn.getAttr("data-icon")!, 16)
			);
			setIcon(layoutBtn, showTree ? "list" : "folder", 16);
		}, 0);
	});
	onDestroy(() => {
		removeEventListener("git-view-refresh", refresh);
	});

	async function commit() {
		loading = true;
		if (status) {
			if (await plugin.hasTooBigFiles(status.staged)) {
				plugin.setState(PluginState.idle);
				return false;
			}
			plugin.gitManager
				.commit(commitMessage)
				.then(() => {
					if (commitMessage !== plugin.settings.commitMessage) {
						commitMessage = "";
					}
				})
				.finally(triggerRefresh);
		}
	}

	async function refresh() {
		if (!plugin.gitReady) {
			status = undefined;
			return;
		}

		status = plugin.cachedStatus;
		if (
			plugin.lastPulledFiles &&
			plugin.lastPulledFiles != lastPulledFiles
		) {
			lastPulledFiles = plugin.lastPulledFiles;

			lastPulledFilesHierarchy = {
				title: "",
				path: "",
				children: plugin.gitManager.getTreeStructure(lastPulledFiles),
			};
		}
		if (status) {
			const sort = (a: FileStatusResult, b: FileStatusResult) => {
				return a.vault_path
					.split("/")
					.last()!
					.localeCompare(b.vault_path.split("/").last()!);
			};
			status.changed.sort(sort);
			status.staged.sort(sort);
			if (status.changed.length + status.staged.length > 500) {
				status = undefined;
				if (!plugin.loading) {
					plugin.displayError("Too many changes to display");
				}
			} else {
				changeHierarchy = {
					title: "",
					path: "",
					children: plugin.gitManager.getTreeStructure(
						status.changed
					),
				};
				stagedHierarchy = {
					title: "",
					path: "",
					children: plugin.gitManager.getTreeStructure(status.staged),
				};
			}
		} else {
			changeHierarchy = undefined;
			stagedHierarchy = undefined;
		}
		loading = plugin.loading;
	}

	function triggerRefresh() {
		dispatchEvent(new CustomEvent("git-refresh"));
	}

	function stageAll() {
		loading = true;
		plugin.gitManager.stageAll({ status: status }).finally(triggerRefresh);
	}

	function unstageAll() {
		loading = true;
		plugin.gitManager
			.unstageAll({ status: status })
			.finally(triggerRefresh);
	}

	function push() {
		loading = true;
		plugin.push().finally(triggerRefresh);
	}
	function pull() {
		loading = true;
		plugin.pullChangesFromRemote().finally(triggerRefresh);
	}
</script>

<main>
	<div class="nav-header">
		<div class="nav-buttons-container">
			<div
				id="commit-btn"
				data-icon="check"
				class="clickable-icon nav-action-button"
				aria-label="Commit"
				bind:this={buttons[0]}
				on:click={commit}
			/>
			<div
				id="stage-all"
				class="clickable-icon nav-action-button"
				data-icon="plus-circle"
				aria-label="Stage all"
				bind:this={buttons[1]}
				on:click={stageAll}
			/>
			<div
				id="unstage-all"
				class="clickable-icon nav-action-button"
				data-icon="minus-circle"
				aria-label="Unstage all"
				bind:this={buttons[2]}
				on:click={unstageAll}
			/>
			<div
				id="push"
				class="clickable-icon nav-action-button"
				data-icon="upload"
				aria-label="Push"
				bind:this={buttons[3]}
				on:click={push}
			/>
			<div
				id="pull"
				class="clickable-icon nav-action-button"
				data-icon="download"
				aria-label="Pull"
				bind:this={buttons[4]}
				on:click={pull}
			/>
			<div
				id="layoutChange"
				class="clickable-icon nav-action-button"
				aria-label="Change Layout"
				bind:this={layoutBtn}
				on:click={() => {
					showTree = !showTree;
					plugin.settings.treeStructure = showTree;
					plugin.saveSettings();
				}}
			/>
			<div
				id="refresh"
				class="clickable-icon nav-action-button"
				class:loading
				data-icon="refresh-cw"
				aria-label="Refresh"
				bind:this={buttons[6]}
				on:click={triggerRefresh}
			/>
		</div>
	</div>
	<div class="git-commit-msg">
		<textarea
			class="commit-msg-input"
			type="text"
			spellcheck="true"
			placeholder="Commit Message"
			bind:value={commitMessage}
		/>
		{#if commitMessage}
			<div
				class="git-commit-msg-clear-button"
				on:click={() => (commitMessage = "")}
				aria-label={"Clear"}
			/>
		{/if}
	</div>

	<div class="nav-files-container" style="position: relative;">
		{#if status && stagedHierarchy && changeHierarchy}
			<div class="nav-folder mod-root">
				<div class="nav-folder-children">
					<div
						class="staged nav-folder"
						class:is-collapsed={!stagedOpen}
					>
						<div
							class="nav-folder-title"
							on:click={() => (stagedOpen = !stagedOpen)}
						>
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
								Staged Changes
							</div>
							<span class="tree-item-flair"
								>{status.staged.length}</span
							>
						</div>
						{#if stagedOpen}
							<div
								class="nav-folder-children"
								transition:slide|local={{ duration: 150 }}
							>
								{#if showTree}
									<TreeComponent
										hierarchy={stagedHierarchy}
										{plugin}
										{view}
										fileType={FileType.staged}
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
					<div
						class="changes nav-folder"
						class:is-collapsed={!changesOpen}
					>
						<div
							on:click={() => (changesOpen = !changesOpen)}
							class="nav-folder-title"
						>
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

							<div class="nav-folder-title-content">Changes</div>
							<span class="tree-item-flair"
								>{status.changed.length}</span
							>
						</div>
						{#if changesOpen}
							<div
								class="nav-folder-children"
								transition:slide|local={{ duration: 150 }}
							>
								{#if showTree}
									<TreeComponent
										hierarchy={changeHierarchy}
										{plugin}
										{view}
										fileType={FileType.changed}
										topLevel={true}
									/>
								{:else}
									{#each status.changed as change}
										<FileComponent
											{change}
											{view}
											manager={plugin.gitManager}
											on:git-refresh={triggerRefresh}
										/>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
					{#if lastPulledFiles.length > 0}
						<div
							class="pulled nav-folder"
							class:is-collapsed={!lastPulledFilesOpen}
						>
							<div
								class="nav-folder-title"
								on:click={() =>
									(lastPulledFilesOpen =
										!lastPulledFilesOpen)}
							>
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
									Recently Pulled Files
								</div>

								<span class="tree-item-flair"
									>{lastPulledFiles.length}</span
								>
							</div>
							{#if lastPulledFilesOpen}
								<div
									class="nav-folder-children"
									transition:slide|local={{ duration: 150 }}
								>
									{#if showTree}
										<TreeComponent
											hierarchy={lastPulledFilesHierarchy}
											{plugin}
											{view}
											fileType={FileType.pulled}
											topLevel={true}
										/>
									{:else}
										{#each lastPulledFiles as change}
											<PulledFileComponent
												{change}
												{view}
												on:git-refresh={triggerRefresh}
											/>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</main>

<style lang="scss">
	.commit-msg-input {
		width: 100%;
		min-height: 33px;
		height: 30px;
		resize: vertical;
		padding: 7px 5px;
		background-color: var(--background-modifier-form-field);
	}

	.git-commit-msg {
		position: relative;
		padding: 0;
		width: calc(100% - var(--size-4-8));
		margin: 4px auto;
	}

	.git-commit-msg-clear-button {
		position: absolute;
		background: transparent;
		border-radius: 50%;
		color: var(--search-clear-button-color);
		cursor: var(--cursor);
		top: 0px;
		right: 2px;
		bottom: 0px;
		line-height: 0;
		height: var(--input-height);
		width: 28px;
		margin: auto;
		padding: 0 0;
		text-align: center;
		display: flex;
		justify-content: center;
		align-items: center;
		transition: color 0.15s ease-in-out;
	}

	.git-commit-msg-clear-button:after {
		content: "";
		height: var(--search-clear-button-size);
		width: var(--search-clear-button-size);
		display: block;
		background-color: currentColor;
		-webkit-mask-image: url("data:image/svg+xml,<svg viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M6 12C9.31371 12 12 9.31371 12 6C12 2.68629 9.31371 0 6 0C2.68629 0 0 2.68629 0 6C0 9.31371 2.68629 12 6 12ZM3.8705 3.09766L6.00003 5.22718L8.12955 3.09766L8.9024 3.8705L6.77287 6.00003L8.9024 8.12955L8.12955 8.9024L6.00003 6.77287L3.8705 8.9024L3.09766 8.12955L5.22718 6.00003L3.09766 3.8705L3.8705 3.09766Z' fill='currentColor'/></svg>");
		-webkit-mask-repeat: no-repeat;
	}
	.tree-item-flair {
		margin-left: auto;
		align-items: center;
	}
</style>
