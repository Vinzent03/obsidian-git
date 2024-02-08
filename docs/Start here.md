---
aliases:
  - "01 Start here"
---

# Obsidian-Git Documentation

## Topics
- [[Installation|Installation]]
- [[Getting Started|Getting Started]]
- [[Authentication|Authentication]]
- [[Features|Features]]
- [[Tips-and-Tricks|Tips-and-Tricks]]
- [[Common issues|Common Issues]]
- [[Line Authoring|Line Authoring]]

> [!warning] Obsidian installation on Linux
> Please don't use Flatpak or Snap to install Obsidian on Linux. Learn more [[Installation#Linux|here]]


![[Getting Started#Performance on mobile]]

## What is Git?

Git is a version control system. It allows you to keep track of changes to your notes and revert back to previous versions. It also allows you to collaborate with other people on the same files. You can read more about Git [here](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control).

> [!info] Git/GitHub is not a syncing service!
> Git is not meant to share your changes live to the cloud or another person. Meaning it should not be used to work with someone live on the same note. However it's perfect for async collaboration.

You build your history by batching multiple changes into commits. These can then be reverted or checked out. You can view the difference between version of a note via the [Version History Diff](obsidian://show-plugin?id=obsidian-version-history-diff) plugin.
Git itself only manages a local repository. It becomes really handy in conjunction with an online remote repository. You can push and pull your commits to/from a remote repository to share or backup your vault. The most popular provider is [GitHub](https://github.com). 

Git is primarily used by developers and thus the command line is sometimes needed. Obsidian-Git is a plugin for Obsidian that allows you to use Git from within Obsidian without always having to use the command line or leaving Obsidian.

## Terminology

### Backup
For simplification, the term "Backup" refers to staging everything -> commiting -> pulling -> pushing.