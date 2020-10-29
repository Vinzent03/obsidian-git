# Obsidian Git
Simple plugin that allows you to backup your Obsidian (https://obsidian.md) vault to a remote git repository (e.g. private repo on GitHub).
Synergises well with [GitJournal](https://github.com/GitJournal/GitJournal).

#### Features

- Backup vault repo every X minutes
- Automatically pull changes on Obsidian startup
- Hotkey to pull changes (only `master` branch)
- Hotkey to commit/push changes (with customizable commit message) (only `master` branch)

Built for Obsidian 0.9.7 with Obsidian Plugin API (alpha). But further support is planned.

### Installation

#### Prerequisites

- Obsidian 0.9.7 (Plugin API alpha release) is installed
- Support for 3rd party plugins is enabled in settings (Obsidian > Settings > Third Party plugin > Safe mode - OFF)
- `git` is installed on local machine and repository is initialized in the vault root directory (`master` branch)

To install this plugin, download `zip` archive from [GitHub releases page](https://github.com/denolehov/obsidian-git/releases).
Extract the archive into `<vault>/.obsidian/plugins`.

Alternatively, using bash:
```bash
OBSIDIAN_VAULT_DIR=/path/to/your/obsidian/vault
mkdir -p $OBSIDIAN_VAULT_DIR/.obsidian/plugins
unzip ~/Downloads/obsidian-git_v1.1.0.zip -d $OBSIDIAN_VAULT_DIR/.obsidian/plugins
```

Once done, change hotkeys for pulling/pushing changes from/to remote repository and optionally enable autosave.
