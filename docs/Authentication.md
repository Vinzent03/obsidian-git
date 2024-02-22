---
aliases:
  - "04 Authentication"
---
# Linux

## Recommeded: HTTPS

### Storing

To securely store the username and password permanently without having to reenter it all the time you can use Git's [Credential Helper](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage). `libsecret` stores the password in a secure place. On GNOME it's backed up by [GNOME Keyring](https://wiki.gnome.org/Projects/GnomeKeyring/) and on KDE [KDE Wallet](https://wiki.archlinux.org/title/KDE_Wallet).

```bash
git config --global credential.helper libsecret
```

You have to do one authentication action (clone/pull/push) after setting the helper in the terminal. Ater that you should be able to clone/pull/push in Obsidian without any issues.

In case you get the message `git: 'credential-libsecret' is not a git command`, libsecret is not installed on your system. You may have to install it by yourself.
Here is an example for Ubuntu.

```bash
sudo apt install libsecret-1-0 libsecret-1-dev make gcc

sudo make --directory=/usr/share/doc/git/contrib/credential/libsecret

# NOTE: This changes your global config, in case you don't want that you can omit the `--global` and execute it in your existing git repository.
git config --global credential.helper \
   /usr/share/doc/git/contrib/credential/libsecret/git-credential-libsecret

```

### GUI Support

In case you don't want to store it permanently you can install `ksshaskpass` (it's preinstalled on KDE systems) and set it as binary to ask for the password.

NOTE: This changes your global config, in case you don't want that you can omit the `--global` and execute it in your existing git repository.

```bash
git config --global core.askPass "ksshaskpass"
```

You should get a prompt to enter your username/password in Obsidian now.

## SSH

By installing `ksshaskpass` (it's preinstalled on KDE systems) you can use SSH to authenticate. You have to add your SSH key to the `ssh-agent` and set `ksshaskpass` as binary to ask for the password.
```bash
sudo ln /usr/bin/ksshaskpass /usr/lib/ssh/ssh-askpass
```

# macOS

## HTTPS

Run the following to use the macOS keychain to store your credentials.

```bash
git config --global credential.helper osxkeychain
```

You have to do one authentication action (clone/pull/push) after setting the helper in the terminal. After that you should be able to clone/pull/push in Obsidian without any issues.

## SSH

GitHub provides a great documentation on how to [generate a new SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#generating-a-new-ssh-key) and then on how to [add the SSH key to your ssh-agent](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent).

# Windows

## HTTPS

Ensure you are using Git 2.29 or higher and you are using Git Credential Manager. 
You can verify this by executing the following. It should ouput `manager`.

```bash
git config credential.helper
```

Just execute any authentication command like push/pull/clone and a pop window should come up, allowing your to sign in.