## Source Control View

Open it using the "Open source control view" command. It lists all current changes like when you run `git status`. It provides the following features

- Stage/Unstage individual files
- Discard any changes to a specific file
- Open the diff view for changed files
- Stage/Unstage all files
- Push/Pull
- Commit or [[Start here#commit-and-sync|commit-and-sync]]
- Switch between list and tree view using the button at the top

## History View

Open it using the "Open history view" command. It behaves like `git log` resulting in a list of the last commits. Each commit entry can be expanded to see the changed files in that commit. By clicking on a file, you can even see the diff.

## Line Authoring

For each line, view the last time, it was modified: [[Line Authoring|Line Authoring]]. Technically known as `git-blame`.

## Automatic commit-and-sync

See [[Start here#commit-and-sync|commit-and-sync]] for an explanation of the term. The goal of automatic commit-and-sync is that you can focus on taking notes and not care about saving your work, as this plugin will take care of it.
There are multiple ways to trigger an automatic commit-and-sync. The default is a basic interval to run commit-and-sync every X minutes. Use the "Auto commit-and-sync interval" setting for that. The interval works across Obsidian sessions to ensure opening Obsidian only for short times doesn't prevent running commit-and-sync. For example, if you set a 15 minutes interval, you don't have to keep Obsidian open for 15 minutes. If you close Obsidian before the interval end, the commit-and-sync will automatically run the next time you start Obsidian.

Another method is to enable "Auto commit-and-sync after stopping file edits". This waits X minutes after your latest change for the commit-and-sync. This is useful if you don't want to get interrupted by a commit while typing. 

The last mode is the "Auto commit-and-sync after latest commit" setting. This sets the last commit-and-sync timestamp to the latest commit. By default, the plugin only compares with it's own latest run of commit-and-sync. So if you manually commit and want the commit-and-sync timer to reset, enable this setting.

## Commit message

The plugin uses [momentjs](https://momentjs.com/) for formatting the date, so read through their documentation on how to construct your date placeholder.

## Submodules Support

Since version 1.10.0 submodules are supported. While adding/cloning new submodules is still not supported (might come later), updating existing submodules on the known "Commit-and-sync" and "Pull" commands is supported. This works even recursively. "Commit-and-sync" will cause adding, commit and push (if turned on) all changes in all submodules. This feature needs to be turned on in the settings.

Additional **requirements**:

- Checked out branch (not just a commit as it is when running `git submodule update --init`)
- Tracking branch is set up, so that `git push` works
- Tracking branch needs to be fetched, so that a `git diff` with the branch works
