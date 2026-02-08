---
aliases:
  - 02 Installation
---

> [!important]
> Although the plugin itself is desktop platform independent, an incorrect installation of Obsidian or Git may break the plugin.

## Plugin installation

### From within Obsidian
Go to "Settings" -> "Community plugins" -> "Browse", search for "Git", install and enable it.

### Manual
1. Download `obsidian-git-<latest-version>.zip` from the [latest release](https://github.com/Vinzent03/obsidian-git/releases/latest)
2. Unpack the zip in `<vault>/.obsidian/plugins/obsidian-git`
3. Restart Obsidian
4. Go to settings and disable restricted mode
5. Enable `Git`

# Windows

Installing [GitHub Desktop](https://github.com/apps/desktop) is **not** enough! You need to install regular Git as well.
## Git installation

> [!info] 
> Ensure you are using Git 2.29 or higher. 

Install Git from the official [website](https://git-scm.com/download/win) with all default settings.
Make sure you have `3rd-party software` access enabled.

![[third-party-windows-git.png]]

Enable Git Credential Manager. You can verify this for existing installations by executing the following. It should ouput `manager`.

```bash
git config credential.helper
```

![[credential-manager-windows-git.png]]


# Linux

## Obsidian installation

Known **supported** Obsidian installation methods:
- AppImage

Known **not fully supported** package managers
- Snap (Snap puts Obsidian in a kind of sandbox, so that Obsidian can't access Git)
- [Flatpak](https://flathub.org/apps/details/md.obsidian.Obsidian) can access Git, but not all system files, so it's not recommended.

If you installed Obsidian a while ago via **Flatpak**, and it doesn't work, please run the following snippet.

```
$ flatpak update md.obsidian.Obsidian
$ flatpak override --reset md.obsidian.Obsidian
$ flatpak run md.obsidian.Obsidian
```
[Source of this snippet](https://github.com/flathub/md.obsidian.Obsidian/issues/5#issuecomment-736974662)

# MacOS

Homebrew is an open source package manager for macOS that simplifies installing, updating, and managing software from the command line. This is a highly recommended tool since macOS does not include a built in package manager.

## Prerequisites

1. Ensure you have Apple macOS `Catalina (10.15)` or newer
2. Older macOS releases may work but are not officially supported.
3. Install Xcode Command Line Tools

```zsh
xcode-select --install
```

## Install Homebrew

Run the Homebrew installer script and then execute it

```zsh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

If the installer does not automatically add Homebrew to your PATH, add the appropriate directory for your Mac architecture and then reload your shell.

- Intel Macs

```zsh
export PATH=/usr/local/bin:$PATH
```

- Apple Silicon Macs

```zsh
export PATH=/opt/homebrew/bin:$PATH
```

- Reload the shell

```zsh
source ~/.zprofile
# or
source ~/.zshrc
```

## Install Git

```zsh
brew install git
```

## Install Obsidian

Install Obsidian using Homebrew Cask

```zsh
brew install --cask obsidian
```

