# Conflict resolution

A conflict means Git could not decide how to combine two changes to the same file. This commonly happens when a note is edited on two devices before both copies are synced. It can also happen when one side deletes or renames a file that the other side changes. During a pull, Git combines changes it can and leaves the remaining choices for you. Commit-and-sync and automatic routines cannot finish that sync until you resolve them.

Before resolving anything, make sure changes from your other devices have been committed and pushed. If you are unsure which version to keep, copy the affected files somewhere safe first.

## Resolve a merge in Obsidian

1. Run **Open source control view** from the command palette. Files needing attention appear under **Conflicts**. Select a file to open it.
2. Review each highlighted conflict block in the note. **Keep ours** keeps the local version in this vault; **Keep theirs** keeps the incoming version from the remote. **Keep both** keeps both pieces of text, which you may need to edit into a single coherent note. You can also edit the text manually. Review the result before saving, especially if you use a **Keep all** action.
3. If you edit the conflict markers manually, remove the marker lines (`<<<<<<<`, `=======`, `>>>>>>>`, and `|||||||` if present) and keep the content you want. Save the file. The conflict count beside it should reach zero.
4. Select **Mark resolved** (the plus/check icon) beside the file in **Conflicts**. This stages the resolved file. Repeat for every conflicted file. For a conflict involving a deleted file or a file that cannot be opened in Obsidian, resolve it with a Git client and stage the result there.
5. When **Conflicts** is empty, enter a commit message and use **Commit** in Source Control to finish the merge. Then push, or run commit-and-sync again. A merge remains in progress until this commit is made, even after all files are marked resolved.

<!-- Screenshot: Conflicts section in the Source Control view, including the conflict count and Mark resolved button. -->

<!-- Screenshot: A highlighted conflict block and its Keep ours, Keep theirs, and Keep both actions. -->

> [!warning] Review before marking resolved
> **Mark resolved** stages the current file; it does not choose the correct text for you. If a file contains binary data or cannot be edited safely in Obsidian, use a Git client to inspect and resolve it.

## If you use a different pull strategy

The steps above describe a merge, the default pull strategy. If you selected **Rebase** on desktop, resolve and stage each conflict, then continue the rebase in a terminal or Git client with `git rebase --continue`. Repeat if Git stops at another conflict. Do not make a normal merge commit to continue a rebase. Rebase is not supported on mobile.

If you use **Other sync service (update HEAD only)**, the plugin does not merge file contents on pull. Reconcile differences through that sync service before relying on Git's status. Choosing **Our changes** or **Their changes** under **Merge strategy on conflicts** can automatically favor one side's text; check the resulting notes because the other side's conflicting text may be omitted.

## If the conflict is not listed in Obsidian

If your vault is inside a larger repository, the Source Control view may show **Conflicts outside vault**. Resolve those files outside Obsidian with a Git client. The plugin cannot open them as vault notes, and the merge cannot be committed or pushed until they are resolved.

If a push is rejected because the remote has newer commits, pull to bring them in. A rejected push alone is not necessarily a conflict; Git reports a conflict only if it cannot combine the changes during the pull. Avoid force pushing to bypass this, since it may overwrite commits from another device.
