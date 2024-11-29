Most issues with the integration of other installable tools are that their installation path is not added to the `PATH` environment variable. The `PATH` environment variable contains the directories where to search for executable programs. You probably don't have issues with executing your tools from the terminal, because you edited the `PATH` in your  `.bashrc`,`.zshrc`, but those files only apply to your shell and not to desktop applications like Obsidian. So some installation directories are missing in the `PATH` and the plugin can't find them.

# Git Large File Storage
Git Large File Storage is supported, but may need a bit configuration for the plugin to find the `git-lfs` executable.

## MacOS

1. Make sure to install [git-lfs](https://git-lfs.com/) using `brew install git-lfs`.
	- This will install `git-lfs` to `/opt/homebrew/bin/`, which is probably not in your `PATH` environment variable when using Obsidian.
2. To make `/opt/homebrew/bin/` available in Obsidian, add `/opt/homebrew/bin/` to the "Additional PATH environment variables paths" setting under "Advanced".
3. Restart Obsidian.

## Linux
1. Make sure to install [git-lfs](https://git-lfs.com/).
	- The place where `git-lfs` is installed to varies by package manager and distribution. Usually there is no need to manually add it to your `PATH`, but if the plugin can't find `git-lfs`follow the next steps.
2. Run `which git-lfs` in your terminal to get the installation path. It should output something of the form `<some-path>/git-lfs.
2. Add the `<some-path>` part of the previous step to the "Additional PATH environment variables paths" setting under "Advanced".
3. Restart Obsidian.

## Windows
There is no need to change anything for the plugin, because git-lfs is installed with Git for Windows and should be available if Git is available as well.

# GPG Signing

GitHub provides a great [documentation about GPG](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key), which should work with Obsidian as well.
One issue you might encounter though is the following:
```
Error: error: cannot run gpg: No such file or directory
error: gpg failed to sign the data
fatal: failed to write commit object
```

This means there is no `gpg`  binary in your PATH, which you may have only properly configured for your shell. But since Obsidian is started in a different way, these PATH modifications don't affect Obsidian. To get the binary path of your `gpg` installation, run `which gpg` on Linux and Mac-OS and `where gpg` on Windows. A common location may be `/usr/local/bin/gpg`.

- You can either add that to the "Additional PATH environment variables" plugin setting to provide the gpg binary to your  plugin installation only.
- Or set it in your Git config via `git config --global gpg.program <your previous output>` to set the gpg binary globally for all git repositories.

Please create an issue if you encounter any issues and the documentation needs to be improved.