## Submodules Support

Since version 1.10.0 submodules are supported. While adding/cloning new submodules is still not supported (Might come later), updating existing submodules on the known "Create Backup" and "Pull" commands is supported. This works even recursively. "Create Backup" will cause to add, commit and push (if turned on) all changes in all submodules. This feature needs to be turned on in the settings.

Additional **requirements**:

- Checked out branch (not just a commit as it is when running `git submodule update --init`)
- Tracking branch is set up, so that `git push` works
- Tracking branch needs to be fetched, so that a `git diff` with the branch works