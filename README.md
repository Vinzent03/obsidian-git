# Obsidian Git
Simple plugin that allows you to backup your Obsidian (https://obsidian.md) vault to a remote git repository (e.g. private repo on GitHub).

##### Features

- Hotkey to pull changes
- Hotkey to commit/push changes (with customizable commit message)
- Autocommit every X minutes

Built for Obsidian 0.9.7 with Obsidian Plugin API (alpha). But further support is planned.

### Prerequisites

- Obsidian 0.9.7 (Plugin API alpha release) is installed
- Support for 3rd party plugins is enabled in settings (Obsidian > Settings > Third Party plugin > Safe mode - OFF)
- `git` is installed on local machine and repository exists in your vault directory

### Installation

To install this plugin, download `zip` archive from [GitHub releases page](https://github.com/denolehov/obsidian-git/releases).
Open the archive, and copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/obsidian-git` (create plugin directory if needed).

Alternatively, using bash:
```bash
OBSIDIAN_VAULT_DIR=/path/to/your/obsidian/vault

# create plugin directory
mkdir -p $OBSIDIAN_VAULT_DIR/.obsidian/plugins/obsidian-git

# unzip `main.js` and `manifest.json` into a plugin directory
unzip -p ~/Downloads/obsidian-git-0.0.2.zip obsidian-git-0.0.2/main.js > $OBSIDIAN_VAULT_DIR/.obsidian/plugins/obsidian-git/main.js
unzip -p ~/Downloads/obsidian-git-0.0.2.zip obsidian-git-0.0.2/manifest.json > $OBSIDIAN_VAULT_DIR/.obsidian/plugins/obsidian-git/manifest.json
```

Once done, change hotkeys for pulling/pushing changes from/to remote repository and optionally enable autosave.
