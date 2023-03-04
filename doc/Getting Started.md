# Desktop

## For existing remote repository

For cloning you have to use an remote url. This can be one of two protocols. Either `https` or `ssh`. This depends on your choosen [[Authentication]] method.
`https`: `https://github.com/<username>/<repo>.git`
`ssh`: `git@github.com:<username>/<repo>.git`

1. Follow the [[Installation]] instructions for your operating system
2. Setup [[Authentication]]
3. Git can only clone a remote repo in a new folder. Thus you have two options
	- Use the "Clone an exising remote repository" command to clone your repo into a subfolder of your vault. You then have again two choices
		- Move all your files from the new folder (including `.git` !) into your vault root.
		- Open your new subfolder as a new vault. You may have to install the plugin again.
	- Run `git clone <your-remote-url>` in the command line wherever you want your vault to be located. 

# Mobile

## For existing remote repository

Follow these instructions for setting up an Obsidian Vault on a mobile device that is already backed up in a remote git repository. 

The instructions assume you are using [GitHub](https://github.com), but can be extrapolated to other providers.

1. Make sure any outstanding changes on all devices are pushed and reconciled with the remote repo.
2. Install Obsidian for Android or iOS.
3. Create a new vault (or point Obsidian to an empty directory). Do NOT select `Store in iCloud` if you are on iOS.
4. If your repo is hosted on GitHub, [authentication must be done with a personal access token](https://github.blog/2020-12-15-token-authentication-requirements-for-git-operations/). Detailed instruction for that process can be found [here](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token). 
	- Minimal permissions required are
		- "Read access to metadata"
		- "Read and Write access to contents and commit status"
1. In Obsidian settings, enable community plugins. Browse plugins to install Obsidian Git.
2. Enable Obsidian Git (on the same screen)
3. Go to Options for the Obsidian Git plugin (bottom of main settings page, under Community Plugins section)
4. Under the "Authentication/Commit Author" section, fill in the username on your git server and your password/personal access token. 
5. Don't touch any settings under "Advanced"
6. Exit plugin settings, open command palette, choose "Obsidian Git: Clone existing remote repo".
7. Fill in repo URL in the text field and press the repo URL button below it. The repo URL is NOT the URL in the browser. You have to append `.git`.
		- `https://github.com/<username>/<repo>.git
		- E.g. `https://github.com/denolehov/obsidian-git.git`
9. Follow instructions to determine the folder to place repo in and whether an `.obsidian` directory already exits.
10. Clone should start. Popup notifications (if not disabled) will display the progress. Do not exit until a popup appears requesting that you "Restart Obsidian".

## New Repo

Similar steps as [existing repo](#existing-repo), except use the `Initialize a new repo` command, followed by `Edit remotes` to add the remote repo to track. This remote repo will need to exist and be empty.



