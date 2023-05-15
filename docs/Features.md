## Source Control View

Open it using the "Open Source Control View" command. It lists all current changes like when you run `git status`. It provides the following features
- See every file's diff
- Stage/Unstage individual files
- Discard any changes to a specific file
- Switch between list and tree view using the button at the top
- Stage/Unstage all files
- Push/Pull
- Commit and [[Start here#Backup|Backup]]

## History View

Open it using the "Open History View" command. It behaves like `git log` resulting in a list of the last commits. Each commit entry can be expanded to see the changed files in that commit. By clicking on a file, you can even see the specific diff.

## Line Authoring

For each line, view the last time, it was modified: [[Line Authoring|Line Authoring]]. Technically known as `git-blame`.

## Automatic Backup

See [[Start here#Backup|Backup]] for an explanation of the term. The goal of automatic Backups is that you can focus on taking notes and not to care about saving your work, because this plugin will take care of it.
There are multiple ways to trigger an automatic backup. The default is a basic interval, resulting in backing up your files every X minutes. Use the "Vault backup interval" setting for that. The interval works across Obsidian sessions to ensure the backup is always run. For example, if you set a 15 minutes interval, you don't have to keep Obsidian open for 15 minutes. If you close Obsidian before the interval end, the backup will automatically run the next time you start Obsidian.

Another method is to enable "Auto backup after file change". This waits X minutes after your last change for the backup. This is useful if you don't want to get interrupted by a backup while typing. 

The last mode is the "Auto backup after latest commit" setting. This sets the last backup timestamp to the last commit. By default, the plugin only compares with it's own last run backup. So if you manually commit and want the backup timer to reset, enable this setting.

## Commit message

The plugin uses [momentjs](https://momentjs.com/) for formatting the date, so read through their documentation on how to construct your date placeholder.

## Submodules Support

Since version 1.10.0 submodules are supported. While adding/cloning new submodules is still not supported (might come later), updating existing submodules on the known "Create Backup" and "Pull" commands is supported. This works even recursively. "Create Backup" will cause adding, commit and push (if turned on) all changes in all submodules. This feature needs to be turned on in the settings.

Additional **requirements**:

- Checked out branch (not just a commit as it is when running `git submodule update --init`)
- Tracking branch is set up, so that `git push` works
- Tracking branch needs to be fetched, so that a `git diff` with the branch works