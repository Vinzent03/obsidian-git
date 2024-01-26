# Quick User Guide

A quick showcase of all functionality. This feature is based on [git-blame](https://git-scm.com/docs/git-blame).

ℹ️ The line author view only works in Live-Preview and Source mode - not in Reading mode.

ℹ️ Currently, only Obsidian on desktop is supported.

ℹ️ The recently released Obsidian v1.0 is fully supported. The images and GIFs in this document are however not yet updated.

## Activate

![](assets/line-author-activate.png)

It can also be activated via Command Palette `Git: Toggle line author information`.

## Default line author information

![](assets/line-author-default.png)

Shows the initials of the author as well as the authoring date in `YYYY-MM-DD` format.

The `*` indicates, that the author and committer (or their timestamps) are different - i.e., due to a rebase.

## Commit hash and full name

![](assets/line-author-commit-hash-full-name.png)

via config

![](assets/line-author-commit-hash-full-name-config.png)

## Natural language dates

![](assets/line-author-natural-language-dates.png)

## Custom date formats

![](assets/line-author-custom-dates.png)

via config

![](assets/line-author-custom-dates-config.png)

## Commit time in local/author/UTC time-zone

**UTC+0000/Z**

The simplest option to start with is showing the time in `UTC+00:00/Z` time-zone.
This is independent of both your local and the author's time-zone.
It is shown with a suffix `Z` to avoid confusion with local time.

![](assets/line-author-tz-utc0000.png)

This is the time displayed in the guter is the same for all users.

**My local (default)**

By default, the times are shown in your local time-zone - i.e., `What was the clock-time at my wall showing, when the commit was made?` This depends on your local time-zone. For instance, this is the view for a user in the `UTC+01:00` time-zone.

![](assets/line-author-tz-viewer-plus0100.png)

Note, how the displayed time is `1h` ahead of the above `UTC+0000` time.

**Author's local**

Alternatively, it can show it in the author's time-zone with explicit `UTC` offset - i.e., `What was clock-time at the author's wall and their explicit UTC offset, when the commit was made?`

This is independent of your local time-zone and the same time is displayed for all users.

![](assets/line-author-tz-author-local.png)

**Configuration**

![](assets/line-author-tz-config.png)

## Age-based gutter colors

The line gutter color is based on the age of the commit. It adapts to the dark/light mode automatically.

![](assets/line-author-dark-light.gif)

Red-ish means newer and blue-ish means older. All commits at and above a certain maximum coloring
age (configurable; default `1 year`) get the same strongest blue-ish color.

The colors are configurable and the defaults are chosen to be accessible.

![](assets/line-author-color-config.png)

## Adjust text color CSS based on theme

By default, the gutter text color uses `var(--text-muted)` which
is whatever is defined by your theme. You can however, change it to a different CSS
color or variable.

![](assets/line-author-text-color.png)

Example:
| `var(--text-muted)` | `var(--text-normal)` |
|----------------------------------------------|-----------------------------------------------|
| ![](assets/line-author-text-color-muted.png) | ![](assets/line-author-text-color-normal.png) |

## Copy commit hash

![](assets/line-author-copy-commit-hash.png)

## Quick configure gutter

![](assets/line-author-quick-configure-gutter.gif)

## New/uncommitted lines and files show `+++`

![](assets/line-author-untracked.png)

## Follow lines across cut-copy-paste-ing within same commit / all commits

By default, each line shows the last commit, where it was changed.
This means, that cut-copy-paste-ing lines will show the new commit,
even though it was not originally written in that commit.

![](assets/line-author-follow-no-follow.png)

However, if for instance following is set to `all commits`, then this is the result:

![](assets/line-author-follow-all-commits.png)

Configuration:

![](assets/line-author-follow-config.png)

## Soft and unintrusive ansynchronous view updates

Since computing the line author information takes time (due to a `git blame` shell invocation)
the result appears delayed. To minimize distraction and improve user experience,
the view is updated in a soft and unintrusive manner.

When opening a file, a placeholder is shown meanwhile:

![](assets/line-author-soft-unintrusive-ux.gif)

While editing, a placeholder is shown as well until the file is saved and the line author information is computed.

![](assets/line-author-soft-unintrusive-ux-editing.gif)

## Multi-line block support

The markdown rendering of multiple lines as a combined block is also supported.
In this case the newest of all lines is shown in the gutter.

![](assets/line-author-multi-line-newest.gif)

## Ignore whitespace and newlines

This can be activated in the settings.

| **Original**                                         | **Changed with preserved whitespace**                   | **Changed with ignored whitespace**                   |
| ---------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| ![](assets/line-author-ignore-whitespace-before.png) | ![](assets/line-author-ignore-whitespace-preserved.png) | ![](assets/line-author-ignore-whitespace-ignored.png) |

Note, how ignoring the whitespace does not mark the indented
lines as changes, as only additional whitespace was added.

## Submodules support

Line author information is fully supported in submodules.
