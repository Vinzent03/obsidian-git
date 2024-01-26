# Line Authoring Feature - Developer Documentation

-   This feature was developed by [GollyTicker](https://github.com/GollyTicker).
-   [Feature documentation for users](https://publish.obsidian.md/git-doc/Line+Authoring)

## Architecture

To understand how this feature integrates with the [Codemirror 6 editor](https://codemirror.net/) used in the Obsidian editors, it is adviseable to read the following sections of the [Codemirror Guide](https://codemirror.net/docs/guide/):

-   Architecture Overview > (everything)
-   Data Model
    -   Configuration
    -   Facets
    -   Transactions
-   View > (intro)
-   Extending Codemirror
    -   State Fields

Furthermore, the following concepts are necessary:

-   [EditorState](https://codemirror.net/docs/ref/#state.EditorState)
-   [State Field](https://codemirror.net/docs/ref/#state.StateField)
-   [Transaction](https://codemirror.net/docs/ref/#state.Transaction)
-   [Creating a transaction](https://codemirror.net/docs/ref/#state.EditorState.update)
-   [Annotation within a transaction](https://codemirror.net/docs/ref/#state.Annotation)
-   [ChangeSet](https://codemirror.net/docs/ref/#state.ChangeSet) (for the unsaved changes gutter update)
-   [Exmaple: Document Changes](https://codemirror.net/examples/change/)
-   [Example: Configuratoin and Extension](https://codemirror.net/examples/config/)

Given changes/updates of the file or file-view within Obsidian, we want to re-compute the line authoring (via [git-blame](https://git-scm.com/docs/git-blame)) and show it in the line gutters left to the editors.

When doing this, we need to integrate with the declarative modeling of Codemirror - and have its views automatically updated, when we change its associated data.

We achieve the goal via the following steps:

1. Every new editor pane in Obsidian subscribes itself
   by its filepath ([LineAuthoringSubcriber](/src/lineAuthor/control.ts))
   and listens in an internal publish-subscriber-model
   ([eventsPerFilepath.ts](/src/lineAuthor/eventsPerFilepath.ts))
   for updates on that filepath.
2. Any changed file in the Obsidian Vault or anytime when a new
   file is opened, [lineAuthorProvider](/src/lineAuthor/lineAuthoProvider.ts)
   initiates the asynchronous computation of the
   [LineAuthoring](/src/lineAuthor/model.ts)
   via [simpleGit.ts](/src/simpleGit.ts) -
   which parses the output of `git-blame`.
3. Once the `LineAuthoring` is computed, the publish-subscriber-model is notified
   of the new value for the corresponding filepath.
4. The notified `LineAuthoringSubcriber` creates a new transaction
   (via [newComputationResultAsTransaction](/src/lineAuthor/model.ts))
   containing the `LineAuthoring`.
5. The `LineAuthoringSubscriber` [dispatches the transaction
   on the current EditorView](https://codemirror.net/docs/ref/#view.EditorView.dispatch).
6. The [StateField's update](https://codemirror.net/docs/ref/#state.StateField^define^config.update)
   method is called by Codemirror due to the dispatched transaction.
   The [lineAuthorState](/src/lineAuthor/model.ts) updates itself with the
   newest `LineAuthoring`, if it one was provided in the transaction.
7. The [lineAuthorGutter](/src/lineAuthor/view/view.ts) is automatically re-rendered,
   due to the dispatch and the changes of the state-fields. The re-rendering
   now accesses the newest state-field values - resulting in a new DOM.

## Development

You can use this test-vault https://github.com/GollyTicker/obsidian-git-test-vault-online.

Once the watchmode npm is started, one can simply open the `test-vault` in Obsidian to
test the plugin. The Git plugin files are symbolic links to the
automatically re-compiled files at repository root level.

One can additionally use the
[docker-setup from this branch for a reproduceable developer setup](https://github.com/GollyTicker/obsidian-git/tree/docker-setup).

## Edge cases and error cases

These cases should be tested, when changes to this feature have been made.

-   running outside of a git repository
-   opening an untracked file
-   opening and closing obsidian windows of panes/notes
-   notes with a starting "--" in their filename
-   special characters in filenames
-   unicode filenames
-   empty file
-   file with populated last line
-   multi-line block with differeing line commits
-   examples for moving/copy-following
-   submodules
-   vault root != repository root
-   error in git blame result
-   open multiple files simultanously
-   open same file multiple times - and edit
-   open same files in multiple windows - and edit
-   open empty tracked file and make edits. quick update should respond sensibly
-   open file in a large, complex real-world vault with unknown characteristics
    (the private vault of the developer GollyTicker suffices) and repeatedly press Enter in a tracked file.
    -   We expect no errors, but after adding the unsaved changed gutter update feature,
        an early bu was present, where errors would occur during rendering and the view would become messed up.
-   UI should render correctly regardless of whether line numbers are shown as well or not.
    -   [[see obsidan forum discussion](https://forum.obsidian.md/t/added-editor-gutter-overlaps-and-obscures-editor-content/45217)
-   indentation changes and changes after last line (without trailing newline) with 'Ignored whitespace' enabled/disabled
-   [Unsaved Changes Gutter Update Scenario](#unsaved-changes-gutter-update-scenario)
-   commit file in a different time-zone than the current Obsidian user
    -   check that time-zone "local" formatting is correct
    -   time-zone "UTC" should always show the same result regardless of the local time-zone
-   line authoring id correctly uses submodule HEAD revision rather than super-project.

    -   There was a bug with the old super-project identifier. It did not fully work with submodules as the following scenario lead to a different displayed line authoring, than the true one.

    1. remember the lineAuthoringId A for a file in a submodule in the vault.

        - it uses the HEAD of the git super-project rather than of the submodule the file is contained in.

    2. add a few lines in the file. The plugin will correctly detect the changed file-contents
       hash, which will trigger re-computation and re-render.
    3. commit the changes in the submodule - without making a corresponding commit in the super-project.
    4. Close the file and re-open it in Obsidian.

        - In the submodule, the HEAD has changed - but not in the super-project.
        - Since the file path and file contents are same after committing, they haven't changed.
        - The current cache key doesn't detect this change and hence the view isn't updated.
        - Reloading Obsidian entirely will evict the cache - and the line authoring will be shown correctly again.

### Unsaved Changes Gutter Update Scenario

This scenario contains two main cases to test:

#### 1. Untracked file

1. Open an untracked file. It should show +++ everywhere.
2. Make insertions, deletions and in-line changes. It should always show +++.

#### 2. Tracked file

1. Open a tracked file with different line author dates and colors
2. Make insertions, deletions and in-line changes.

-   It should first show % until the changes are saved and the line authoring is computed.
-   The % should preserving the color of the changed line and insertions/deletions should shift the
    line authoring for subsequent lines accordingly

3. Make multi-line insertions, deletions and in-line changes (e.g. via cut-copy-pasting of blocks of text).

-   Hint: Use Ctrl+Z as well.
-   The behavior should be same as above.

4. Make changes at the intersection of unsaved and saved changes. The result should be consistent with above.

## Potential Future Improvements

-   show commit info when click/hover on gutter
-   show / highlight diff when hover/click on gutter
-   small tooltip widget when hovering/right-clicking on line author gutter with author/hash, etc.
-   show deleted lines
-   interpret new 'newline' at end of line as non-change to make gutter change marking more intuitive.
    -   [one option is to add a setting which switches between compatibility-mode and comfort-mode](https://github.com/denolehov/obsidian-git/pull/288)
-   distinguish untracked and changed line (e.g. "~" and "+")
-   use addMomentFormat in settings.ts when configuring the line author date format.
-   main.ts: refreshUpdatedHead(): Detect, if the head has changed from outside of Git (e.g. script) and run this callback then.
-   Avoid "Uncaught illegal access error" when closing a separate Obsidian window.
    It doesn't seem to have any impact on UX yet though...
-   Unique initials option: [work in progress branch](https://github.com/GollyTicker/obsidian-git/tree/line-author-unique-initials)
