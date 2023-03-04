## xcrun: error: invalid developer path

This is an error occurring only on macOS. It's easy to fix though. Just run the following snippet in the terminal. `xcode-select --install` See #64 as an example.

## Error: spansSync git ENOENT

This occurs, when the plugin can't find the git executable. It takes it from the PATH. Head over to [[installation]] to see if everything is properly installed for your platform.

## Infinite pulling/pushing with no error

That's most time caused by authentication problems. Head over to [[Authentication]]