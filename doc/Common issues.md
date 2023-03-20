## xcrun: error: invalid developer path

This is an error occurring only on macOS. It's easy to fix though. Just run the following snippet in the terminal. `xcode-select --install` See #64 as an example.

## Error: spansSync git ENOENT/ Cannot run Git command

This occurs, when the plugin can't find the Git executable. It takes it from the PATH. Head over to [[installation]] to see if everything is properly installed for your platform.
If you think everything is correctly set up and the error still occurs try the following:

In case you know where Git is installed, you can set the path under "Custom Git binary path" in the settings. If you don't know where Git is installed, you can try to find it by running the following in the terminal:

### Windows

Run `where git` in the terminal. It should return the path to the Git executable. If it fails, Git is not properly installed.

### Linux/MacOS

Run `which git` in the terminal. It should return the path to the Git executable. If it fails, Git is not properly installed.

## Infinite pulling/pushing with no error

That's most time caused by authentication problems. Head over to [[Authentication]]

## Bad owner or permissions on /home/<user>/.ssh/config

Run `chmod 600 ~/.ssh/config` in the terminal.