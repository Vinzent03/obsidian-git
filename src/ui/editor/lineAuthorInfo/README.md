# Line Authoring Feature

todo.

Looking into the proper way how CodeMirror works, we can see
that we need state, facet, transactions, etc. to make transactions
whenever the git-blame resuls are out, and dispatch them to the view
for the updated gutter.

We could use a state-field to store the current line-author information.
Whenever we get the async result from git-blame, we can then issue a transaction
to update the line-author state-field.
It then is responsible via the GutterMarker or a ViewPlugin to simply display the
current computed line-author state-field.

State Field: https://codemirror.net/docs/ref/#state.StateField
Transaction: https://codemirror.net/docs/ref/#state.Transaction
Create transaction: https://codemirror.net/docs/ref/#state.EditorState.update
We can store the hash of the new git-blame information in an annotation type.
https://codemirror.net/docs/ref/#state.Annotation


---

Document this workflow somewhere.

tracked changes within obsidian -> initiate computation | done

computation finished -> publish new value to subscribers for the finished file | done

editors subscribe to their file at startup | done

subscribed editors update their internal state | done

state/editor update -> gutter can get new value | done.

---

A reproduceable dev environment can be found here:
https://github.com/GollyTicker/obsidian-git/tree/docker-setup

## Open Tasks

* error-handling on the main scopes to ensure robustness
* Refactor and cleanup view and model
* write ts-doc where useful
* populate readme with most important information
* write tests for most flaky/complex logic
* Beta testing with real users
* create feature summary page with GIFs for devs and users
    * add note, saying that feature is only available in source and live-preview mode
* decide, whether to notify users once of this feature
* add GollyTicker to creator for line authoring feature?
* review and merge

## Future Improvements

* small tooltip widget when hovering/r-clicking on line author gutter with author/hash, etc.
* use addMomentFormat in settings.ts when configuring the line author date format.
* main.ts: refreshUpdatedHead(): Detect, if the head has changed from outside of Obsidian git (e.g. script) and run this callback then.
* Avoid "Uncaught illegal access error" when closing a separate Obsidian window. It doesn't seem to
    have any impact on UX yet though.
* Unique initials option. Work in progress here: https://github.com/GollyTicker/obsidian-git/tree/line-author-unique-initials


## Edge/Error Cases to manukally test

* running outside of a git repository
* opening an untracked file
* opening and closing obsidian windows of panes/notes
* notes with a starting "--" in their filename
* special characters in filenames
* unicode filenames
* empty file
* file with populated last line
* multi-line block with differeing line commits
* examples for moving/copy-following
* submodules
* vault root != repository root
* error in git blame result
