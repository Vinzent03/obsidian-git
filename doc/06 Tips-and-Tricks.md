# Tips and Tricks

## Gitignore

To exclude cache files from the repository, create `.gitignore` file in the root of your vault and add the following lines:
```
# to exclude Obsidian's settings (including plugin and hotkey configurations)
.obsidian/

# OR only to exclude workspace cache
.obsidian/workspace.json

# Add below lines to exclude OS settings and caches
.trash/
.DS_Store
```