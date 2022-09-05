# Obsidian Git
Simple plugin that allows you to back up your [Obsidian.md](https://obsidian.md) vault to a remote Git repository (e.g. private repo on GitHub).

On advantages of backing up your vault with git I suggest reading this [amazing article](https://medium.com/analytics-vidhya/how-i-put-my-mind-under-version-control-24caea37b8a5) by [@tallguyjenks](https://github.com/tallguyjenks).

# ⚠ Mobile

## Restrictions of the mobile version

I am using [isomorphic-git](https://isomorphic-git.org/), which is a re-implementation of git in JavaScript, because you cannot use native git on Android or iOS.

- SSH authentication is not supported ([isomorphic-git issue](https://github.com/isomorphic-git/isomorphic-git/issues/231))
- Repo size is limited, because of memory restrictions
- Rebase merge strategy is not supported
- Submodules are not supported

## Performance on **Mobile**
**Setup:** iPad Pro M1 with a [repo](https://github.com/Vinzent03/obsidian-git-stress-test) of 3000 files reduced from [10000 markdown files](https://github.com/Zettelkasten-Method/10000-markdown-files)

The only really time consuming part is to check the whole working directory for file changes. So checking all files for changes to stage takes 03:40 min. Other commands like pull, push and commit are very fast (1-5 seconds). So the best way is to stage individual directories in which you have worked and commit only staged files after it.
The initial clone took 00:25 min.

### Installation on Desktop

⚠ Installing Obsidian via Snap on Linux is not supported. Please use AppImage or Flatpak instead ([Linux installation guide](https://github.com/denolehov/obsidian-git/wiki/Installation#linux))

See the [installation guide](https://github.com/denolehov/obsidian-git/wiki/Installation) for further instructions.


<details>
<summary>Installation and clone a repo on Mobile</summary>

1. Create new vault
2. Change config directory in Settings -> About
3. Install Obsidian Git plugin from community plugins
5. If cloning private repo, set password/personal access token and username in Settings -> Obsidian Git Mobile
6. Execute clone repo command
7. Reload plugin
</details>
<br>

# Desktop

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
