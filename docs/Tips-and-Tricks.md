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
