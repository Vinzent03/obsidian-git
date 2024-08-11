<script lang="ts">
    import { Platform, setIcon } from "obsidian";
    import { SOURCE_CONTROL_VIEW_CONFIG } from "src/constants";
    import type ObsidianGit from "src/main";
    import type {
        FileStatusResult,
        Status,
        StatusRootTreeItem,
    } from "src/types";
    import { FileType, PluginState } from "src/types";
    import { getDisplayPath } from "src/utils";
    import { onDestroy } from "svelte";
    import { slide } from "svelte/transition";
    import { DiscardModal } from "../modals/discardModal";
    import FileComponent from "./components/fileComponent.svelte";
    import PulledFileComponent from "./components/pulledFileComponent.svelte";
    import StagedFileComponent from "./components/stagedFileComponent.svelte";
    import TreeComponent from "./components/treeComponent.svelte";
    import type GitView from "./sourceControl";

    export let plugin: ObsidianGit;
    export let view: GitView;
    let loading: boolean;
    let status: Status | undefined;
    let lastPulledFiles: FileStatusResult[] = [];
    let commitMessage = plugin.settings.commitMessage;
    let buttons: HTMLElement[] = [];
    let changeHierarchy: StatusRootTreeItem | undefined;
    let stagedHierarchy: StatusRootTreeItem | undefined;
    let lastPulledFilesHierarchy: StatusRootTreeItem;
    let changesOpen = true;
    let stagedOpen = true;
    let lastPulledFilesOpen = true;

    let showTree = plugin.settings.treeStructure;
    let layoutBtn: HTMLElement;
    $: {
        if (layoutBtn) {
            layoutBtn.empty();
            setIcon(layoutBtn, showTree ? "list" : "folder");
        }
    }
    addEventListener("git-view-refresh", refresh);
    //This should go in the onMount callback, for some reason it doesn't fire though
    //setTimeout's callback will execute after the current event loop finishes.
    plugin.app.workspace.onLayoutReady(() => {
        window.setTimeout(() => {
            buttons.forEach((btn) => setIcon(btn, btn.getAttr("data-icon")!));
            setIcon(layoutBtn, showTree ? "list" : "folder");
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
            plugin.promiseQueue.addTask(() =>
                plugin.gitManager
                    .commit({ message: commitMessage })
                    .then(() => {
                        if (commitMessage !== plugin.settings.commitMessage) {
                            commitMessage = "";
                        }
                        plugin.setUpAutoBackup();
                    })
                    .finally(triggerRefresh)
            );
        }
    }

    async function backup() {
        loading = true;
        if (status) {
            plugin.promiseQueue.addTask(() =>
                plugin
                    .createBackup(false, false, commitMessage)
                    .then(() => {
                        if (commitMessage !== plugin.settings.commitMessage) {
                            commitMessage = "";
                        }
                    })
                    .finally(triggerRefresh)
            );
        }
    }

    async function refresh() {
        if (!plugin.gitReady) {
            status = undefined;
            return;
        }
        const unPushedCommits = await plugin.gitManager.getUnpushedCommits();

        buttons.forEach((btn) => {
            if (Platform.isMobile) {
                btn.removeClass("button-border");
                if (btn.id == "push" && unPushedCommits > 0) {
                    btn.addClass("button-border");
                }
            } else {
                btn.firstElementChild?.removeAttribute("color");
                if (btn.id == "push" && unPushedCommits > 0) {
                    btn.firstElementChild?.setAttr(
                        "color",
                        "var(--text-accent)"
                    );
                }
            }
        });

        status = plugin.cachedStatus;
        if (
            plugin.lastPulledFiles &&
            plugin.lastPulledFiles != lastPulledFiles
        ) {
            lastPulledFiles = plugin.lastPulledFiles;

            lastPulledFilesHierarchy = {
                title: "",
                path: "",
                vaultPath: "",
                children: plugin.gitManager.getTreeStructure(lastPulledFiles),
            };
        }
        if (status) {
            const sort = (a: FileStatusResult, b: FileStatusResult) => {
                return a.vault_path
                    .split("/")
                    .last()!
                    .localeCompare(getDisplayPath(b.vault_path));
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
                    vaultPath: "",
                    children: plugin.gitManager.getTreeStructure(
                        status.changed
                    ),
                };
                stagedHierarchy = {
                    title: "",
                    path: "",
                    vaultPath: "",
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
        plugin.promiseQueue.addTask(() =>
            plugin.gitManager
                .stageAll({ status: status })
                .finally(triggerRefresh)
        );
    }

    function unstageAll() {
        loading = true;
        plugin.promiseQueue.addTask(() =>
            plugin.gitManager
                .unstageAll({ status: status })
                .finally(triggerRefresh)
        );
    }

    function push() {
        loading = true;
        plugin.promiseQueue.addTask(() =>
            plugin.push().finally(triggerRefresh)
        );
    }
    function pull() {
        loading = true;
        plugin.promiseQueue.addTask(() =>
            plugin.pullChangesFromRemote().finally(triggerRefresh)
        );
    }
    function discard() {
        new DiscardModal(
            view.app,
            false,
            plugin.gitManager.getRelativeVaultPath("/")
        )
            .myOpen()
            .then((shouldDiscard) => {
                if (shouldDiscard === true) {
                    plugin.promiseQueue.addTask(() =>
                        plugin.gitManager
                            .discardAll({
                                status: plugin.cachedStatus,
                            })
                            .finally(() => {
                                dispatchEvent(new CustomEvent("git-refresh"));
                            })
                    );
                }
            });
    }

    $: rows = (commitMessage.match(/\n/g) || []).length + 1 || 1;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<main data-type={SOURCE_CONTROL_VIEW_CONFIG.type}>
    <div class="nav-header">
        <div class="nav-buttons-container">
            <div
                id="backup-btn"
                data-icon="arrow-up-circle"
                class="clickable-icon nav-action-button"
                aria-label="Backup"
                bind:this={buttons[5]}
                on:click={backup}
            />
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
                style="margin: 1px;"
                bind:this={buttons[6]}
                on:click={triggerRefresh}
            />
        </div>
    </div>
    <div class="git-commit-msg">
        <textarea
            {rows}
            class="commit-msg-input"
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
            <div class="tree-item nav-folder mod-root">
                <div
                    class="staged tree-item nav-folder"
                    class:is-collapsed={!stagedOpen}
                >
                    <div
                        class="tree-item-self is-clickable nav-folder-title"
                        on:click={() => (stagedOpen = !stagedOpen)}
                    >
                        <div
                            class="tree-item-icon nav-folder-collapse-indicator collapse-icon"
                            class:is-collapsed={!stagedOpen}
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
                        <div class="tree-item-inner nav-folder-title-content">
                            Staged Changes
                        </div>

                        <div class="git-tools">
                            <div class="buttons">
                                <div
                                    data-icon="minus"
                                    aria-label="Unstage"
                                    bind:this={buttons[8]}
                                    on:click|stopPropagation={unstageAll}
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
                            </div>
                            <div class="files-count">
                                {status.staged.length}
                            </div>
                        </div>
                    </div>
                    {#if stagedOpen}
                        <div
                            class="tree-item-children nav-folder-children"
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
                    class="changes tree-item nav-folder"
                    class:is-collapsed={!changesOpen}
                >
                    <div
                        on:click={() => (changesOpen = !changesOpen)}
                        class="tree-item-self is-clickable nav-folder-title"
                    >
                        <div
                            class="tree-item-icon nav-folder-collapse-indicator collapse-icon"
                            class:is-collapsed={!changesOpen}
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

                        <div class="tree-item-inner nav-folder-title-content">
                            Changes
                        </div>
                        <div class="git-tools">
                            <div class="buttons">
                                <div
                                    data-icon="undo"
                                    aria-label="Discard"
                                    on:click|stopPropagation={discard}
                                    class="clickable-icon"
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
                                        class="svg-icon lucide-undo"
                                        ><path d="M3 7v6h6" /><path
                                            d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"
                                        /></svg
                                    >
                                </div>
                                <div
                                    data-icon="plus"
                                    aria-label="Stage"
                                    bind:this={buttons[9]}
                                    on:click|stopPropagation={stageAll}
                                    class="clickable-icon"
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
                                        class="svg-icon lucide-plus"
                                        ><line
                                            x1="12"
                                            y1="5"
                                            x2="12"
                                            y2="19"
                                        /><line
                                            x1="5"
                                            y1="12"
                                            x2="19"
                                            y2="12"
                                        /></svg
                                    >
                                </div>
                            </div>
                            <div class="files-count">
                                {status.changed.length}
                            </div>
                        </div>
                    </div>
                    {#if changesOpen}
                        <div
                            class="tree-item-children nav-folder-children"
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
                            class="tree-item-self is-clickable nav-folder-title"
                            on:click={() =>
                                (lastPulledFilesOpen = !lastPulledFilesOpen)}
                        >
                            <div
                                class="tree-item-icon nav-folder-collapse-indicator collapse-icon"
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
                                class="tree-item-inner nav-folder-title-content"
                            >
                                Recently Pulled Files
                            </div>

                            <span class="tree-item-flair"
                                >{lastPulledFiles.length}</span
                            >
                        </div>
                        {#if lastPulledFilesOpen}
                            <div
                                class="tree-item-children nav-folder-children"
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
        {/if}
    </div>
</main>

<style lang="scss">
    .commit-msg-input {
        width: 100%;
        overflow: hidden;
        resize: none;
        padding: 7px 5px;
        background-color: var(--background-modifier-form-field);
    }

    .git-commit-msg {
        position: relative;
        padding: 0;
        width: calc(100% - var(--size-4-8));
        margin: 4px auto;
    }
    main {
        .git-tools {
            .files-count {
                padding-left: var(--size-2-1);
                width: 11px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        }
    }

    .nav-folder-title {
        align-items: center;
    }

    .git-commit-msg-clear-button {
        position: absolute;
        background: transparent;
        border-radius: 50%;
        color: var(--search-clear-button-color);
        cursor: var(--cursor);
        top: -4px;
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
        mask-image: url("data:image/svg+xml,<svg viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M6 12C9.31371 12 12 9.31371 12 6C12 2.68629 9.31371 0 6 0C2.68629 0 0 2.68629 0 6C0 9.31371 2.68629 12 6 12ZM3.8705 3.09766L6.00003 5.22718L8.12955 3.09766L8.9024 3.8705L6.77287 6.00003L8.9024 8.12955L8.12955 8.9024L6.00003 6.77287L3.8705 8.9024L3.09766 8.12955L5.22718 6.00003L3.09766 3.8705L3.8705 3.09766Z' fill='currentColor'/></svg>");
        mask-repeat: no-repeat;
        -webkit-mask-image: url("data:image/svg+xml,<svg viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M6 12C9.31371 12 12 9.31371 12 6C12 2.68629 9.31371 0 6 0C2.68629 0 0 2.68629 0 6C0 9.31371 2.68629 12 6 12ZM3.8705 3.09766L6.00003 5.22718L8.12955 3.09766L8.9024 3.8705L6.77287 6.00003L8.9024 8.12955L8.12955 8.9024L6.00003 6.77287L3.8705 8.9024L3.09766 8.12955L5.22718 6.00003L3.09766 3.8705L3.8705 3.09766Z' fill='currentColor'/></svg>");
        -webkit-mask-repeat: no-repeat;
    }
</style>
