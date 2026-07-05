# Obsidian Git 插件

[English](README.md) | 中文

一款强大的 [Obsidian.md](https://obsidian.md) 社区插件，将 Git 集成到你的 vault 中。自动提交、拉取、推送，查看变更 —— 一切都在 Obsidian 内完成。

## 📚 文档

所有设置说明（包括移动端）、常见问题、技巧和高级配置，请参阅 📖 [完整文档](https://publish.obsidian.md/git-doc)。

> 移动端用户：该插件**非常不稳定 ⚠️！** 请查看下方专门的 [移动端支持](#-移动端支持--实验性) 部分。

## 核心功能

- 🔁 **自动提交并同步**（提交、拉取和推送），支持定时执行
- 📥 **Obsidian 启动时自动拉取**
- 📂 **子模块支持**，管理多个仓库（仅桌面端，需手动开启）
- 🔧 **源代码管理视图**，暂存/取消暂存、提交和查看文件差异 - 使用 `打开源代码管理视图` 命令打开
- 📜 **历史记录视图**，浏览提交日志和变更文件 - 使用 `打开历史记录视图` 命令打开
- 🔍 **Diff 视图**，查看文件的变更内容 - 使用 `打开 diff 视图` 命令打开
- 📝 **编辑器内标记**，在编辑器中显示新增、修改和删除的行/代码块（仅桌面端）
- GitHub 集成，在浏览器中打开文件和历史记录

> 如需详细的文件历史记录，建议配合 [Version History Diff](obsidian://show-plugin?id=obsidian-version-history-diff) 插件使用。

## 界面预览

### 🔧 源代码管理视图

在 Obsidian 内直接管理文件变更，包括暂存/取消暂存单个文件并提交。

![Source Control View](https://raw.githubusercontent.com/Vinzent03/obsidian-git/master/images/source-view.png)

### 📜 历史记录视图

显示仓库的提交历史。可以展示提交消息、作者、日期和变更文件。作者和日期默认关闭（如截图所示），可在设置中启用。

![History View](https://raw.githubusercontent.com/Vinzent03/obsidian-git/master/images/history-view.png)

### 🔍 Diff 视图

使用清晰简洁的差异查看器比较版本。
从源代码管理视图或通过 `打开 diff 视图` 命令打开。

![Diff View](https://raw.githubusercontent.com/Vinzent03/obsidian-git/master/images/diff-view.png)

### 📝 编辑器内标记

在编辑器中直接查看逐行变更，带有新增、修改和删除的行/代码块标记。你可以直接从标记处暂存和重置变更。还有命令可以在代码块之间导航以及暂存/重置光标所在的代码块。需要在插件设置中启用。

![Signs](https://raw.githubusercontent.com/Vinzent03/obsidian-git/master/images/signs.png)

## 可用命令
> 非完整列表 - 这些只是最常用的命令。完整列表请查看 Obsidian 中的命令面板。

- 🔄 变更
  - `列出已更改的文件`：在弹窗中列出所有变更
  - `打开 diff 视图`：为当前文件打开 diff 视图
  - `暂存当前文件`
  - `取消暂存当前文件`
  - `丢弃所有更改`：丢弃仓库中的所有变更
- ✅ 提交
  - `提交`：如果有已暂存的文件则仅提交这些，否则提交所有已暂存的文件
  - `使用指定消息提交`：同上，但使用自定义消息
  - `提交所有更改`：提交所有更改但不推送
  - `使用指定消息提交所有更改`：同上，但使用自定义消息
- 🔀 提交并同步
  - `提交并同步`：使用默认设置，将提交所有更改、拉取并推送
  - `使用指定消息提交并同步`：同上，但使用自定义消息
  - `提交并同步然后关闭`：同 `提交并同步`，但在桌面端会关闭 Obsidian 窗口。移动端不会退出 Obsidian 应用。
- 🌐 远程操作
  - `推送`、`拉取`
  - `编辑远程仓库`：添加新的远程仓库或编辑现有远程仓库
  - `移除远程仓库`
  - `克隆现有远程仓库`：打开对话框，提示输入 URL 和认证信息以克隆远程仓库
  - `在 GitHub 上打开文件`：在浏览器中打开当前文件在 GitHub 上的文件视图。注意：仅桌面端可用
  - `在 GitHub 上打开文件历史`：在浏览器中打开当前文件在 GitHub 上的历史记录。注意：仅桌面端可用
- 🏠 管理本地仓库
  - `初始化新仓库`
  - `创建新分支`
  - `删除分支`
  - `注意：删除仓库`
- 🧪 其他
  - `打开源代码管理视图`：打开侧面板显示[源代码管理视图](#-源代码管理视图)
  - `打开历史记录视图`：打开侧面板显示[历史记录视图](#-历史记录视图)
  - `编辑 .gitignore`
  - `添加文件到 .gitignore`：将当前文件添加到 `.gitignore`

## 💻 桌面端说明

### 🔐 认证

某些 Git 服务可能需要额外设置 HTTPS/SSH 认证。请参阅[认证指南](https://publish.obsidian.md/git-doc/Authentication)。

### Linux 上的 Obsidian

- ⚠️  由于沙盒限制，不支持 Snap。
- ⚠️  不推荐 Flatpak，因为它无法访问所有系统文件。虽然 Flatpak 团队正在积极修复许多问题，但仍存在一些问题，尤其是在更高级的配置中。
- ✅ 请使用 AppImage 或通过系统包管理器进行完整权限安装（[Linux 安装指南](https://publish.obsidian.md/git-doc/Installation#Linux)）。

## 📱 移动端支持（⚠️ 实验性）

移动端的 Git 实现**非常不稳定**！我不建议在移动端使用此插件，建议尝试其他同步服务。

一个替代方案是 [GitSync](https://github.com/ViscousPot/GitSync)，支持 Android 和 iOS。它与此插件无关，但对移动用户来说可能是更好的选择。设置教程可在[这里](https://viscouspotenti.al/posts/gitsync-all-devices-tutorial)找到。

> 🧪 该 Git 插件在移动端能够工作，得益于 [isomorphic-git](https://isomorphic-git.org/) —— 一个基于 JavaScript 的 Git 重新实现 - 但它存在严重的限制和问题。Obsidian 插件无法在 Android 或 iOS 上使用原生 Git 安装。

### ❌ 移动端功能限制

- 不支持 **SSH 认证**（[isomorphic-git issue](https://github.com/isomorphic-git/isomorphic-git/issues/231)）
- 仓库大小受限，因为内存限制
- 不支持 rebase 合并策略
- 不支持子模块

### ⚠️ 性能注意事项

> [!caution]
> 根据你的设备和可用内存，Obsidian 可能会：
>
> - 在克隆/拉取时崩溃
> - 产生缓冲区溢出错误
> - 无限运行。
>
> 这是由移动端底层 Git 实现效率低下导致的。我不知道如何修复这个问题。如果这对你来说是个问题，我不得不承认这个插件不适合你。在任何 issue 上评论或创建新 issue 都无济于事。对此我很抱歉。

### 移动端使用技巧：

如果你有大型仓库/vault，建议暂存单个文件然后仅提交已暂存的文件。

## 🙋 联系方式与致谢

- Line Authoring 功能由 [GollyTicker](https://github.com/GollyTicker) 开发，如有问题最好由她来回答。
- 此插件最初由 [denolehov](https://github.com/denolehov) 开发。自 2021 年 3 月起，由 [Vinzent03](https://github.com/Vinzent03) 维护此插件。因此 GitHub 仓库在 2024 年 7 月转移到了我的账号下。
- 如有任何反馈或问题，欢迎通过 GitHub Issues 联系。

## ☕ 支持

如果你觉得这个插件有用并想支持其开发，可以在 Ko-fi 上支持我。

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F195IQ5)
