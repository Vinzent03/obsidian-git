# Obsidian Git
Simple plugin that allows you to back up your [Obsidian.md](https://obsidian.md) vault to a remote git repository (e.g. private repo on GitHub).
This plugin assumes credentials are set up.

On advantages of backing up your vault with git I suggest reading this [amazing article](https://medium.com/analytics-vidhya/how-i-put-my-mind-under-version-control-24caea37b8a5) by [@tallguyjenks](https://github.com/tallguyjenks).

**This plugin does not work on mobile at the moment** See [#57](https://github.com/denolehov/obsidian-git/issues/57) for updates.

### Installation

See the [installation guide](https://github.com/denolehov/obsidian-git/wiki/Installation) for further instructions.

### Documentation

Requirements, tips and tricks, common issues and more can be found in the [wiki](https://github.com/denolehov/obsidian-git/wiki/)

### Features

- Automatic vault backup every X minutes
- Pull changes from remote repository on Obsidian startup
- Assign hotkeys for pulling/pushing changes to a remote repository
- Manage different repositories via Git submodules

### Sidebar view
The Source Control View allows you to stage and commit individual files. It can be opened by the `Open Source Control View` command.

![Source Control View](https://raw.githubusercontent.com/denolehov/obsidian-git/master/images/source-view.png)

## Available Commands
- `Create Backup`: Commits all changes and pushes them depending on your setting whether to push on backup or not
- `Create Backup with specific message`: Same as above, but with a custom message
- `Commit all changes`: Only commits all changes without pushing
- `Commit all changes with specific message`: Same as above, but with a custom message
- `Push`
- `Pull`
- `List changed files`: Lists all changes in a modal
- `Edit remotes` and `Remove remote`
- `Initialize` a new repo`
- `Clone an existing remote repo`

### Contact

If you have any kind of feedback or questions, feel free to reach out via GitHub issues or `@Vinadon` on [Obsidian Discord server](https://discord.com/invite/veuWUTm).

This plugin was initial developed by [denolehov](https://github.com/denolehov). Since March 2021, it is [Vinzent03](https://github.com/Vinzent03) who is developing on this plugin.

> If you want to support me ([Vinzent03](https://github.com/Vinzent03)) you can support me on Ko-fi
<br>

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F195IQ5)
