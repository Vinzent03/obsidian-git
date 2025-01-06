# Tips and Tricks

## Gitignore

To exclude cache files from the repository, create `.gitignore` file in the root of your vault and add the lines in the snippet below.
There's also the `Edit .gitignore` command that will open the file in a modal.

```
# to exclude Obsidian's settings (including plugin and hotkey configurations)
.obsidian/

# to only exclude plugin configuration. Might be useful to prevent some plugin from exposing sensitive data
.obsidian/plugins

# OR only to exclude workspace cache
.obsidian/workspace.json

# to exclude workspace cache specific to mobile devices
.obsidian/workspace-mobile.json

# Add below lines to exclude OS settings and caches
.trash/
.DS_Store
```


## Usage with Obsidian Sync

A common use case for using git and Obsidian Sync is to use Obsidian Sync to actually sync between all your devices and Git as a form of backup and version history.

### Use Git plugin only on one device

In case you are syncing your enabled plugins and their settings, the Git plugin is enabled and running even though the `.git` directory doesn't exist or you don't want to run automatics on that device. To fix this, you can enable the "Disable on this device" option under "Advanced" in the plugin settings. That setting is not synced to other devices.

### Use Git plugin, but not to pull your files

Another use case might be that you don't want to update your files on pull, because Obsidian Sync already updated your files. You can still commit/push/commit-and-sync. To accomplish this use "Other sync service" as "Merge strategy" under "Pull". This only updates the HEAD to the latest commit on pull, but doesn't change your files at all.
