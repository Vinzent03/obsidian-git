# Obsidian Git
Simple plugin that allows you to backup your [Obsidian.md](https://obsidian.md) vault to a remote git repository (e.g. private repo on GitHub).
This plugin assumes you have existing git repository initialized locally and credentials are setup.

On advantages of backing up your vault with git I suggest reading this [amazing article](https://medium.com/analytics-vidhya/how-i-put-my-mind-under-version-control-24caea37b8a5) by [@tallguyjenks](https://github.com/tallguyjenks). You can find a "how-to" on git repository setup there as well, this plugin does not expose an interface to initialize git repository (yet).

Synergises well with [GitJournal](https://github.com/GitJournal/GitJournal) mobile markdown note taking app.

## How to use

### Requirements
- initialized git repository
- credentials are set up
- remote repository
- upstream/tracking branch (run `git push`. Git should prompt you a command)
- at least one pushed commit

[How to create a local repo and push it to GitHub](https://docs.github.com/en/github/importing-your-projects-to-github/adding-an-existing-project-to-github-using-the-command-line)

### Features

- Automatic vault backup every X minutes
- Pull changes from remote repository on Obsidian startup
- Assign hotkeys for pulling/pushing changes to a remote repository

**Note:** it is recommended to exclude obsidian workspace cache files from the repository 
(or even whole `.obsidian` directory) due to potential noise in the git history.

If you'd like to do that, scroll to the bottom for a short guide.

## Compatibility
Custom plugins are only available for Obsidian v0.9.7+.

# Installation
## From within Obsidian
If you have Obsidian 0.9.8+, you can install this plugin from "Settings > Third Party Plugins > Obsidian Git".

## Manual installation
Download zip archive from [GitHub releases page](https://github.com/denolehov/obsidian-git/releases).
Extract the archive into `<vault>/.obsidian/plugins`.

Alternatively, using bash:
```bash
OBSIDIAN_VAULT_DIR=/path/to/your/obsidian/vault
mkdir -p $OBSIDIAN_VAULT_DIR/.obsidian/plugins
unzip ~/Downloads/obsidian-git_v1.1.0.zip -d $OBSIDIAN_VAULT_DIR/.obsidian/plugins
```

## SSH Authentication
> This is a typical example of a trade-off between security and convenience. [...] The most appropriate solution depends on the usage scenario and desired level of security.

If you want to use SSH and have a passphrase for your ssh-key, you have to add it to the ssh-agent so that Obsidian can access it. Read more at this [summary](https://unix.stackexchange.com/questions/90853/how-can-i-run-ssh-add-automatically-without-a-password-prompt/90869#90869) to start `ssh-agent` on system startup.

## Windows installation
Make sure you have `3rd-party software` access enabled.

<img
    src = https://raw.githubusercontent.com/denolehov/obsidian-git/master/windows-installation.png
    width = 400>

**For additional advice on using Obsidian Git for the tech unfamiliar take a look at `foreveryone#6438`'s great [tutorial](https://github.com/gitobsidiantutorial/obsidian-git-tut-windows/blob/main/README.md)**

## Linux installation
Some users reported issues with Obsidian installed via Snap, because Obsidian runs in a kind of sandbox and can't access git.

Installation via [Flatpak](https://flathub.org/apps/details/md.obsidian.Obsidian) or AppImage works.

# Tips
## Excluding Obsidian cache files from repository
To exclude cache files from the repository, create `.gitignore` file in the root of your vault and add the following lines:
```
# to exclude Obsidian workspace settings (including plugin and hotkey configurations)
.obsidian/  
# OR only to exclude workspace cache
.obsidian/workspace 

# Add below lines to exclude OS settings and caches
.trash/
.DS_Store
```
---

If you have any kind of feedback or questions, feel free to reach out via GitHub issues or `@evrwhr` on [Obsidian Discord server](https://discord.com/invite/veuWUTm).

This plugin was initial developed by [denolehov](https://github.com/denolehov). Since March, it's mainly [Vinzent03](https://github.com/Vinzent03) who is developing on this plugin.

> If you want to support me ([Vinzent03](https://github.com/Vinzent03)) you can consider [buying me a coffee](https://www.buymeacoffee.com/Vinzent03).

<br>

<a href="https://www.buymeacoffee.com/Vinzent03"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=Vinzent03&button_colour=5F7FFF&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"></a>