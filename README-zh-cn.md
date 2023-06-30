# Obsidian Git

这个插件可以让你备份自己 的[Obsidian.md](https://obsidian.md) vault（Obsidian库）到一个远程的Git仓库上。（例如 一个私人的github仓库）。

要求和安装步骤（包括移动端的安装步骤）技巧和窍门，常见的问题和讨论可以在 [documentation](https://publish.obsidian.md/git-doc) 这里找到。

移动用户请参阅下面的选项 [Mobile](#mobile)。

## 重要特性

-   每隔X分钟自动备份库
-   在Obsidian启动时从远程存储库拉出更改
-   为从从远程代码库拉取或更改任务分配快捷键。
-   通过Git子模块管理不同的仓库（在启用此功能之后）。
-   通过使用“打开源代码控制视图”命令，您可以在源代码控制视图中对单个文件进行暂存和提交。
-   历史视图显示了提交和其更改的文件，可以说是一个集成的 `git log`。您可以使用“打开历史视图”命令来打开它。
-   要查看文件的历史记录，我强烈推荐您使用 [版本历史差异](obsidian://show-plugin?id=obsidian-version-history-diff) 插件。

### 源代码视图

![Source Control View](https://raw.githubusercontent.com/denolehov/obsidian-git/master/images/source-view.png)

### History View

![History View](https://raw.githubusercontent.com/denolehov/obsidian-git/master/images/history-view.png)

## 可用的命令列表

- Changes
  - `List changed files`：以模态窗口的方式列出所有更改的文件。
  - `Open diff view`：打开当前文件的差异视图。
  - `Stage current file`：暂存当前文件。
  - `Unstage current file`：取消暂存当前文件。

- Commit
  - `Commit all changes`：仅提交所有更改而不进行推送。
  - `Commit all changes with specific message`：与上面相同，但使用自定义消息。
  - `Commit staged`：仅提交已暂存的文件。
  - `Commit staged with specific message`：与上面相同，但使用自定义消息。

- Backup
  - `Create Backup`：提交所有更改。如果启用了“在备份时推送”选项，还会推送该提交。
  - `Create Backup with specific message`：与上述相同，但使用自定义消息。
  - `Create backup and close`：与“Create Backup”相同，但如果在桌面上运行，则会关闭 Obsidian 窗口。在移动设备上不会退出 Obsidian 应用。

- Remote
  - `Push`：推送更改到远程仓库。
  - `Pull`：从远程仓库拉取最新的更改。
  - `Edit remotes`：编辑远程仓库设置。
  - `Remove remote`：移除远程仓库。
  - `Clone an existing remote repo`：打开对话框，提示输入URL和认证信息以克隆远程仓库。
  - `Open file on GitHub`：在浏览器窗口中打开当前文件在 GitHub 上的文件视图。注意：仅限桌面版可用。
  - `Open file history on GitHub`：在浏览器窗口中打开当前文件在 GitHub 上的历史记录视图。注意：仅限桌面版可用。

- Local
  - `Initialize a new repo`：初始化一个新的仓库。
  - `Create new branch`：创建新的分支。
  - `Delete branch`：删除分支。
  - `CAUTION: Delete repository`：谨慎操作：删除仓库。

- Source Control View
  - `Open source control view`：打开侧边窗格，显示源代码控制视图。
  - `Edit .gitignore`：编辑 `.gitignore` 文件。
  - `Add file to .gitignore`：将当前文件添加到 `.gitignore` 中。

## 桌面

## 身份验证

要在Obsidian中设置Git操作的身份验证，您可以参考身份验证文档中的详细说明。该文档将提供逐步指南，教您如何配置身份验证设置。

### Linux的Obsidian

- ⚠ Snap 不受支持。
- ⚠ 不建议使用 Flatpak，因为它无法访问所有系统文件。

请参考Linux安装指南。 ([Linux 安装指南](https://publish.obsidian.md/git-doc/Installation#Linux))

## 移动端

### Obsidian移动版相对于桌面版有一些限制

我使用的是 [isomorphic-git](https://isomorphic-git.org/)，这是一个使用JavaScript重新实现的Git库，因为在Android或iOS上无法使用原生的Git。

- SSH身份验证不受支持（参考：[isomorphic-git问题链接](https://github.com/isomorphic-git/isomorphic-git/issues/231)）
- 由于内存限制，仓库大小受到限制
- 不支持rebase合并策略
- 不支持子模块

这些限制是isomorphic-git在移动设备上的特点。它可能无法提供与原生Git相同的完整功能和兼容性。请注意以上限制，并根据您的需求和场景进行选择。如果这些限制不符合您的要求，您可能需要考虑其他适用于移动设备的Git解决方案。

### 在移动设备上的性能

> **警告**
> 根据您的设备和可用的空闲RAM，Obsidian在克隆/拉取操作时可能会崩溃。我不知道如何解决这个问题。如果您遇到此问题，我必须承认此插件对您无效。因此，对任何问题进行评论或创建新问题都无法提供帮助。非常抱歉。

**设置：** 使用搭载iPad Pro M1的设备，使用[3000个文件的仓库](https://github.com/Vinzent03/obsidian-git-stress-test)，该仓库是从[10000个Markdown文件](https://github.com/Zettelkasten-Method/10000-markdown-files)精简而来。

初始克隆耗时 0 分 25 秒。之后，最耗时的部分是检查整个工作目录中的文件变更。在这个设置中，检查所有文件的变更以进行暂存需要花费 03 分 40 秒。其他命令，如拉取（pull）、推送（push）和提交（commit），非常快速（1-5秒）。

如果您的仓库/笔记库很大，在移动设备上快速工作的方法是逐个暂存文件，并只提交已经暂存的文件。

## 联系方式

Line Authoring 功能由[GollyTicker](https://github.com/GollyTicker)开发，因此任何问题最好向他咨询。

如果您有任何反馈或疑问，请随时通过GitHub问题或Obsidian Discord服务器上的`@Vinadon`联系。

此插件最初由[denolehov](https://github.com/denolehov)开发。自2021年3月以来，[Vinzent03](https://github.com/Vinzent03)一直在开发该插件。

如果您想支持我（[Vinzent03](https://github.com/Vinzent03)），可以在Ko-fi上赞助我。

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F195IQ5)
