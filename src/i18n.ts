import { moment } from "obsidian";

const zhCNTranslations: Record<string, string> = {
    "Edit .gitignore": "编辑 .gitignore",
    "Open source control view": "打开源代码管理视图",
    "Open history view": "打开历史记录视图",
    "Open diff view": "打开差异视图",
    "Open file on GitHub": "在 GitHub 上打开文件",
    "Open file history on GitHub": "在 GitHub 上打开文件历史",
    Pull: "拉取",
    Fetch: "获取远端更新",
    "Switch to remote branch": "切换到远程分支",
    "Add file to .gitignore": "将文件加入 .gitignore",
    "Commit-and-sync": "提交并同步",
    "Commit-and-sync and then close Obsidian": "提交并同步后关闭 Obsidian",
    "Commit-and-sync with specific message": "使用指定信息提交并同步",
    "Commit all changes": "提交全部更改",
    "Commit all changes with specific message": "使用指定信息提交全部更改",
    Commit: "提交",
    "Commit staged": "提交已暂存内容",
    "Amend staged": "修订并提交已暂存内容",
    "Commit with specific message": "使用指定信息提交",
    "Commit staged with specific message": "使用指定信息提交已暂存内容",
    Push: "推送",
    "Stage current file": "暂存当前文件",
    "Unstage current file": "取消暂存当前文件",
    "Edit remotes": "编辑远程仓库",
    "Remove remote": "删除远程仓库",
    "Set upstream branch": "设置上游分支",
    "CAUTION: Delete repository": "警告：删除仓库",
    "Initialize a new repo": "初始化新仓库",
    "Clone an existing remote repo": "克隆现有远程仓库",
    "List changed files": "列出已更改文件",
    "Switch branch": "切换分支",
    "Create new branch": "创建新分支",
    "Delete branch": "删除分支",
    "CAUTION: Discard all changes": "警告：丢弃全部更改",
    "Pause/Resume automatic routines": "暂停或恢复自动任务",
    "Raw command": "运行原始 Git 命令",
    "Toggle line author information": "切换行作者信息",
    "Reset hunk": "重置代码块",
    "Stage hunk": "暂存代码块",
    "Preview hunk": "预览代码块",
    "Go to next hunk": "转到下一个代码块",
    "Go to previous hunk": "转到上一个代码块",
    "Source Control": "源代码管理",
    History: "历史记录",
    "Diff view": "差异视图",
    "Diff View": "差异视图",
    "Commit Message": "提交信息",
    Clear: "清空",
    "Staged Changes": "已暂存的更改",
    Changes: "更改",
    "Recently Pulled Files": "最近拉取的文件",
    "Stage all": "全部暂存",
    "Unstage all": "全部取消暂存",
    Stage: "暂存",
    Unstage: "取消暂存",
    Discard: "丢弃",
    Refresh: "刷新",
    "Change Layout": "切换布局",
    "Open File": "打开文件",
    Save: "保存",
    Cancel: "取消",
    "Select branch to checkout": "选择要检出的分支",
    "Not supported files will be opened by default app!":
        "不受支持的文件将使用系统默认应用打开。",
    "Type your message and select optional the version with the added date.":
        "输入提交信息，并可选择带日期的版本。",
    Automatic: "自动化",
    "Split timers for automatic commit and sync":
        "分别设置自动提交和自动同步计时器",
    "Auto commit interval (minutes)": "自动提交间隔（分钟）",
    "Auto commit-and-sync interval (minutes)": "自动提交并同步间隔（分钟）",
    "Auto push interval (minutes)": "自动推送间隔（分钟）",
    "Auto pull interval (minutes)": "自动拉取间隔（分钟）",
    "Auto commit after stopping file edits": "停止编辑后自动提交",
    "Auto commit-and-sync after stopping file edits":
        "停止编辑后自动提交并同步",
    "Auto commit after latest commit": "上次提交后自动提交",
    "Auto commit-and-sync after latest commit": "上次提交后自动提交并同步",
    "Auto commit only staged files": "自动提交时仅提交已暂存文件",
    "Auto commit-and-sync only staged files":
        "自动提交并同步时仅提交已暂存文件",
    "Commit message on auto commit": "自动提交信息",
    "Commit message on auto commit-and-sync": "自动提交并同步信息",
    "Commit message": "提交信息",
    "Commit message on manual commit": "手动提交信息",
    "Commit message script": "提交信息脚本",
    "{{date}} placeholder format": "{{date}} 占位符格式",
    "{{hostname}} placeholder replacement": "{{hostname}} 占位符替换值",
    "Preview commit message": "预览提交信息",
    "List filenames affected by commit in the commit body":
        "在提交正文中列出受影响的文件名",
    "Merge strategy": "合并策略",
    "Merge strategy on conflicts": "冲突时的合并策略",
    Merge: "合并",
    Rebase: "变基",
    "Other sync service (Only updates the HEAD without touching the working directory)":
        "其他同步服务（仅更新 HEAD，不改动工作目录）",
    "None (git default)": "无（Git 默认）",
    "Our changes": "保留本地更改",
    "Their changes": "保留远程更改",
    "Pull on startup": "启动时拉取",
    "Push on commit-and-sync": "提交并同步时推送",
    "Pull on commit-and-sync": "提交并同步时先拉取",
    "Squash commits before push": "推送前压缩提交",
    "Hunk management": "代码块管理",
    Signs: "变更标记",
    "Hunk commands": "代码块命令",
    "Status bar with summary of line changes": "在状态栏显示行变更摘要",
    Disabled: "禁用",
    Colored: "彩色",
    Monochrome: "单色",
    "Line author information": "行作者信息",
    "History view": "历史记录视图",
    "Show Author": "显示作者",
    "Show Date": "显示日期",
    Hide: "隐藏",
    Full: "完整姓名",
    Initials: "首字母",
    "Source control view": "源代码管理视图",
    "Automatically refresh source control view on file changes":
        "文件变更时自动刷新源代码管理视图",
    "Source control view refresh interval": "源代码管理视图刷新间隔",
    Miscellaneous: "其他",
    "Diff view style": "差异视图样式",
    Split: "分栏",
    Unified: "统一差异",
    "Disable informative notifications": "禁用信息通知",
    "Disable error notifications": "禁用错误通知",
    "Hide notifications for no changes": "无更改时隐藏通知",
    "Show status bar": "显示状态栏",
    "File menu integration": "集成文件菜单",
    "Show branch status bar": "在状态栏显示分支",
    "Show the count of modified files in the status bar":
        "在状态栏显示已修改文件数量",
    "Authentication/commit author": "认证与提交作者",
    "Commit author": "提交作者",
    "Username on your git server. E.g. your username on GitHub":
        "Git 服务器用户名，例如 GitHub 用户名",
    "Password/Personal access token": "密码或个人访问令牌",
    "Author name for commit": "提交作者姓名",
    "Author email for commit": "提交作者邮箱",
    Advanced: "高级",
    "Update submodules": "更新子模块",
    "Submodule recurse checkout/switch": "递归检出或切换子模块",
    "Custom Git binary path": "自定义 Git 可执行文件路径",
    "Additional environment variables": "附加环境变量",
    "Additional PATH environment variable paths": "附加 PATH 路径",
    "Reload with new environment variables": "使用新环境变量重新加载",
    Reload: "重新加载",
    "Custom base path (Git repository path)": "自定义基础路径（Git 仓库路径）",
    "Custom Git directory path (Instead of '.git')":
        "自定义 Git 目录路径（代替 .git）",
    "Disable on this device": "在此设备上禁用",
    Support: "支持",
    Donate: "捐赠",
    "Copy Debug Information": "复制调试信息",
    "Only available on desktop currently.": "目前仅桌面端可用。",
    "Feature guide and quick examples": "功能指南与快速示例",
    "Follow movement and copies across files and commits":
        "跨文件和提交跟踪移动与复制",
    "Do not follow (default)": "不跟踪（默认）",
    "Follow within same commit": "在同一次提交中跟踪",
    "Follow within all commits (maybe slow)": "在全部提交中跟踪（可能较慢）",
    "Show commit hash": "显示提交哈希",
    "Author name display": "作者姓名显示方式",
    "Initials (default)": "首字母（默认）",
    "First name": "名",
    "Last name": "姓",
    "Full name": "完整姓名",
    "Authoring date display": "创作日期显示方式",
    "Date (default)": "日期（默认）",
    "Date and time": "日期和时间",
    "Natural language": "自然语言",
    Custom: "自定义",
    "Custom authoring date format": "自定义创作日期格式",
    "Authoring date display timezone": "创作日期显示时区",
    "My local (default)": "我的本地时区（默认）",
    "Author's local": "作者的本地时区",
    "Oldest age in coloring": "颜色范围中的最早时间",
    "Text color": "文字颜色",
    "Ignore whitespace and newlines in changes": "忽略更改中的空白和换行",
    "Format string": "格式字符串",
    "Git is not ready. When all settings are correct you can configure commit-sync, etc.":
        "Git 尚未就绪。所有设置正确后，才能配置提交与同步等功能。",
    "Enable to use one interval for commit and another for sync.":
        "启用后可分别设置提交与同步的执行间隔。",
    "Commit changes every X minutes. Set to 0 (default) to disable. (See below setting for further configuration!)":
        "每 X 分钟提交一次更改。设为 0（默认值）可禁用；更多行为可在下方设置。",
    "Commit and sync changes every X minutes. Set to 0 (default) to disable. (See below setting for further configuration!)":
        "每 X 分钟提交并同步一次更改。设为 0（默认值）可禁用；更多行为可在下方设置。",
    "Push commits every X minutes. Set to 0 (default) to disable.":
        "每 X 分钟推送一次提交。设为 0（默认值）可禁用。",
    "Pull changes every X minutes. Set to 0 (default) to disable.":
        "每 X 分钟拉取一次更改。设为 0（默认值）可禁用。",
    "You will get a pop up to specify your message.":
        "执行时会弹出窗口，让你填写提交信息。",
    "Available placeholders: {{date}} (see below), {{hostname}} (see below), {{numFiles}} (number of changed files in the commit) and {{files}} (changed files in commit message).":
        "可用占位符：{{date}}（见下方）、{{hostname}}（见下方）、{{numFiles}}（本次提交的文件数量）和 {{files}}（在提交信息中列出已更改文件）。",
    "Available placeholders: {{date}} (see below), {{hostname}} (see below), {{numFiles}} (number of changed files in the commit) and {{files}} (changed files in commit message). Leave empty to require manual input on each commit.":
        "可用占位符：{{date}}（见下方）、{{hostname}}（见下方）、{{numFiles}}（本次提交的文件数量）和 {{files}}（在提交信息中列出已更改文件）。留空后，每次提交都需要手动输入。",
    "A script that is run using 'sh -c' to generate the commit message. May be used to generate commit messages using AI tools. Available placeholders: {{hostname}}, {{date}}.":
        "通过 ‘sh -c’ 运行脚本来生成提交信息，也可用于调用 AI 工具。可用占位符：{{hostname}}、{{date}}。",
    "Moment.js documentation": "Moment.js 文档",
    "for more formats.": "可查看更多格式。",
    "Specify custom hostname for every device. Defaults to the OS hostname if not set on desktop.":
        "可为每台设备指定名称；桌面端留空时使用操作系统主机名。",
    Preview: "预览",
    "Decide how to integrate commits from your remote branch into your local branch.":
        "选择如何把远程分支的提交整合到本地分支。",
    "Decide how to solve conflicts when pulling remote changes. This can be used to favor your local changes or the remote changes automatically.":
        "选择拉取远程更改时如何解决冲突，可自动优先保留本地或远程更改。",
    "Automatically pull commits when Obsidian starts.":
        "Obsidian 启动时自动拉取远程提交。",
    "Commit-and-sync with default settings means staging everything -> committing -> pulling -> pushing. Ideally this is a single action that you do regularly to keep your local and remote repository in sync.":
        "默认情况下，“提交并同步”依次执行：暂存全部更改 → 提交 → 拉取 → 推送。建议定期执行这一操作，使本地与远程仓库保持同步。",
    "On commit-and-sync, squash all local unpushed commits into a single commit right before pushing. Keeps the remote history clean when committing often. Only unpushed commits are rewritten, so no force-push is needed.":
        "执行“提交并同步”时，在推送前把所有尚未推送的本地提交压缩为一个提交。频繁提交时可保持远程历史整洁；只会改写未推送的提交，因此无需强制推送。",
    "Hunks are sections of grouped line changes right in your editor.":
        "代码块是在编辑器中按组显示的行级更改。",
    "This allows you to see your changes right in your editor via colored markers and stage/reset/preview individual hunks.":
        "在编辑器中用彩色标记显示更改，并可分别暂存、重置或预览各个代码块。",
    "Adds commands to stage/reset individual Git diff hunks and navigate between them via 'Go to next/prev hunk' commands.":
        "增加用于暂存、重置单个 Git 差异代码块的命令，并可通过“转到上一个/下一个代码块”进行导航。",
    "Show the author of the commit in the history view.":
        "在历史记录视图中显示提交作者。",
    "Show the date of the commit in the history view. The {{date}} placeholder format is used to display the date.":
        "在历史记录视图中显示提交日期，并使用 {{date}} 占位符的格式。",
    "On slower machines this may cause lags. If so, just disable this option.":
        "在性能较低的设备上可能造成卡顿；如有此情况，请关闭该选项。",
    "Milliseconds to wait after file change before refreshing the Source Control View.":
        "文件更改后，等待多少毫秒再刷新源代码管理视图。",
    'Set the style for the diff view. Note that the actual diff in "Split" mode is not generated by Git, but the editor itself instead so it may differ from the diff generated by Git. One advantage of this is that you can edit the text in that view.':
        "设置差异视图样式。“分栏”模式中的差异由编辑器生成，而非 Git，因此可能与 Git 生成的差异不同；优点是可直接在该视图中编辑文本。",
    "Disable informative notifications for git operations to minimize distraction (refer to status bar for updates).":
        "关闭 Git 操作的信息通知以减少干扰；进度可查看状态栏。",
    "Disable error notifications of any kind to minimize distraction (refer to status bar for updates).":
        "关闭所有错误通知以减少干扰；进度可查看状态栏。",
    "Don't show notifications when there are no changes to commit or push.":
        "没有可提交或推送的更改时不显示通知。",
    'Add "Stage", "Unstage" and "Add to .gitignore" actions to the file menu.':
        "在文件菜单中增加“暂存”“取消暂存”和“加入 .gitignore”操作。",
    "Type in your password. You won't be able to see it again.":
        "输入密码或令牌；保存后将无法再次查看。",
    "These settings usually don't need to be changed, but may be required for special setups.":
        "这些设置通常无需修改，但某些特殊环境可能需要配置。",
    '"Commit-and-sync" and "pull" takes care of submodules. Missing features: Conflicted files, count of pulled/pushed/committed files. Tracking branch needs to be set for each submodule.':
        "“提交并同步”和“拉取”会处理子模块。暂不支持：冲突文件、拉取/推送/提交文件数统计。每个子模块都需要设置跟踪分支。",
    "Whenever a checkout happens on the root repository, recurse the checkout on the submodules (if the branches exist).":
        "根仓库执行检出时，也递归检出子模块中的对应分支（如果存在）。",
    "Specify the path to the Git binary/executable. Git should already be in your PATH. Should only be necessary for a custom Git installation.":
        "指定 Git 可执行文件路径。Git 通常已加入 PATH，仅自定义安装时需要设置。",
    "Use each line for a new environment variable in the format KEY=VALUE .":
        "每行填写一个环境变量，格式为 KEY=VALUE。",
    "Use each line for one path": "每行填写一个路径。",
    "Removing previously added environment variables will not take effect until Obsidian is restarted.":
        "删除此前添加的环境变量后，需要重启 Obsidian 才会生效。",
    "Disables the plugin on this device. This setting is not synced.":
        "仅在当前设备上禁用插件；此设置不会同步。",
    "If you like this Plugin, consider donating to support continued development.":
        "如果你喜欢这个插件，可以捐赠以支持持续开发。",
    "Buy Me a Coffee at ko-fi.com": "在 ko-fi.com 请开发者喝杯咖啡",
    "Debugging and logging:\nYou can always see the logs of this and every other plugin by opening the console with":
        "调试与日志：\n可以使用以下快捷键打开控制台，查看本插件及其他插件的日志：",
    "Show commit authoring information next to each line":
        "在每一行旁显示提交作者信息",
    "The commit hash, author name and authoring date can all be individually toggled.":
        "提交哈希、作者姓名和创作日期均可单独显示或隐藏。",
    "Hide everything, to only show the age-colored sidebar.":
        "全部隐藏后，只显示按时间着色的侧边栏。",
    "By default (deactivated), each line only shows the newest commit where it was changed.":
        "默认（关闭）时，每一行只显示最近一次修改它的提交。",
    With: "使用",
    "same commit": "同一次提交",
    ", cut-copy-paste-ing of text is followed within the same commit and the original commit of authoring will be shown.":
        "时，会跟踪同一次提交内文本的剪切、复制和粘贴，并显示原始创作提交。",
    "all commits": "全部提交",
    ", cut-copy-paste-ing text inbetween multiple commits will be detected.":
        "时，会检测跨多次提交的文本剪切、复制和粘贴。",
    "It uses": "该功能使用",
    "the originating": "原始",
    "commit's information is shown.": "提交的信息。",
    "If and how the author is displayed": "设置是否以及如何显示作者。",
    "If and how the date and time of authoring the line is displayed":
        "设置是否以及如何显示该行的创作日期和时间。",
    "The time-zone in which the authoring date should be shown.\nEither your local time-zone (default),\nthe author's time-zone during commit creation or\n":
        "选择创作日期的显示时区：你的本地时区（默认）、作者创建提交时的本地时区，或\n",
    "The CSS color of the gutter text.": "侧边栏文字的 CSS 颜色。",
    "It is highly recommended to use": "强烈建议使用",
    "CSS variables": "CSS 变量",
    "defined by themes (e.g.": "由主题定义（例如",
    or: "或",
    "), because they automatically adapt to theme changes.":
        "），因为这些变量会自动适应主题变化。",
    "See:": "参见：",
    "List of available CSS variables in Obsidian": "Obsidian 可用 CSS 变量列表",
    "Whitespace and newlines are interpreted as part of the document and in changes by default (hence not ignored). This makes the last line being shown as 'changed' when a new subsequent line is added, even if the previously last line's text is the same.":
        "默认情况下，空白和换行会被视为文档及更改的一部分（不会忽略）。因此，即使原最后一行的文字没有变化，在其后新增一行时也会把它标记为“已更改”。",
    "If you don't care about purely-whitespace changes (e.g. list nesting / quote indentation changes), then activating this will provide more meaningful change detection.":
        "如果不关心纯空白更改（如列表嵌套或引用缩进变化），启用此项可获得更有意义的更改检测。",
    "Supports 'rgb(r,g,b)', 'hsl(h,s,l)', hex (#) and named colors (e.g. 'black', 'purple'). Color preview:":
        "支持 rgb(r,g,b)、hsl(h,s,l)、十六进制（#）和颜色名称（如 black、purple）。颜色预览：",
    "invalid color": "无效颜色",
    "to display the authoring date.": "用于显示创作日期。",
    "No repository found": "未找到 Git 仓库",
    "Too many changes to display": "更改过多，无法显示",
    "Paused automatic routines.": "已暂停自动任务。",
    "Resumed automatic routines.": "已恢复自动任务。",
    "Discarded all changes in tracked files.": "已丢弃所有已跟踪文件的更改。",
    "Discarded all files.": "已丢弃所有文件。",
    "Obsidian must be restarted for the changes to take affect.":
        "必须重启 Obsidian 才能使更改生效。",
    "Debug information copied to clipboard. May contain sensitive information!":
        "调试信息已复制到剪贴板，其中可能包含敏感信息。",
};
type DynamicTranslation = {
    pattern: RegExp;
    translate: (match: RegExpMatchArray) => string;
};

function actionZh(action: string): string {
    return action === "commit" ? "提交" : "提交并同步";
}

function durationZh(duration: string): string {
    const match = duration.match(/^(\d+) minutes?$/);
    return match ? match[1] + " 分钟" : duration;
}

const zhCNPatterns: DynamicTranslation[] = [
    {
        pattern: /^Auto (commit|commit-and-sync) interval \(minutes\)$/,
        translate: (match) => "自动" + actionZh(match[1]) + "间隔（分钟）",
    },
    {
        pattern: /^Auto (commit|commit-and-sync) after stopping file edits$/,
        translate: (match) => "停止编辑后自动" + actionZh(match[1]),
    },
    {
        pattern: /^Auto (commit|commit-and-sync) after latest commit$/,
        translate: (match) => "上次提交后自动" + actionZh(match[1]),
    },
    {
        pattern: /^Auto (commit|commit-and-sync) only staged files$/,
        translate: (match) =>
            "自动" + actionZh(match[1]) + "时仅提交已暂存文件",
    },
    {
        pattern:
            /^Specify custom commit message on auto (commit|commit-and-sync)$/,
        translate: (match) =>
            "自动" + actionZh(match[1]) + "时手动指定提交信息",
    },
    {
        pattern: /^Commit message on auto (commit|commit-and-sync)$/,
        translate: (match) => "自动" + actionZh(match[1]) + "信息",
    },
    {
        pattern:
            /^Requires the (commit|commit-and-sync) interval not to be 0\.\s+If turned on, do auto \1 every (.+?) after stopping file edits\.\s+This also prevents auto \1 while editing a file\. If turned off, it's independent from the last file edit\.$/,
        translate: (match) =>
            "要求" +
            actionZh(match[1]) +
            "间隔不能为 0。启用后，停止编辑文件 " +
            durationZh(match[2]) +
            " 后自动" +
            actionZh(match[1]) +
            "；编辑文件期间不会执行。关闭后，执行时间不受最后编辑时间影响。",
    },
    {
        pattern:
            /^If turned on, sets last auto (commit|commit-and-sync) timestamp to the latest commit timestamp\. This reduces the frequency of auto \1 when doing manual commits\.$/,
        translate: (match) =>
            "启用后，将上次自动" +
            actionZh(match[1]) +
            "时间设为最近一次提交时间，从而减少手动提交后重复自动" +
            actionZh(match[1]) +
            "的频率。",
    },
    {
        pattern:
            /^If turned on, only staged files are committed on (commit|commit-and-sync)\. If turned off, all changed files are committed\.$/,
        translate: (match) =>
            "启用后，" +
            actionZh(match[1]) +
            "时只提交已暂存文件；关闭后提交所有已更改文件。",
    },
    {
        pattern: /^Set to default: "(.+)"$/,
        translate: (match) => "恢复默认值：“" + match[1] + "”",
    },
    {
        pattern: /^Specify custom date format\. E\.g\. "(.+)\. See$/,
        translate: (match) =>
            "指定自定义日期格式，例如“" + match[1] + "”。参见",
    },
    {
        pattern:
            /^Most of the time you want to push after committing\. Turning this off turns a commit-and-sync action into commit (and pull )?only\. It will still be called commit-and-sync\.$/,
        translate: (match) =>
            "通常应在提交后推送。关闭后，“提交并同步”只会" +
            (match[1] ? "提交并拉取" : "提交") +
            "，但命令名称仍显示为“提交并同步”。",
    },
    {
        pattern:
            /^On commit-and-sync, pull commits as well\. Turning this off turns a commit-and-sync action into commit (and push )?only\.$/,
        translate: (match) =>
            "执行“提交并同步”时同时拉取远程提交。关闭后，该操作只会" +
            (match[1] ? "提交并推送" : "提交") +
            "。",
    },
    {
        pattern:
            /^Sets the relative path to the vault from which the Git binary should be executed\.\s+Mostly used to set the path to the Git repository, which is only required if the Git repository is below the vault root directory\. Use "\\\\" instead of "\/" on Windows\.$/,
        translate: () =>
            "设置 Git 命令相对于 Vault 的执行路径。仅当 Git 仓库位于 Vault 根目录下的子目录时通常才需要设置；Windows 上请使用“\\”而不是“/”。",
    },
    {
        pattern:
            /^Corresponds to the GIT_DIR environment variable\. Requires restart of Obsidian to take effect\. Use "\\\\" instead of "\/" on Windows\.$/,
        translate: () =>
            "对应 GIT_DIR 环境变量。重启 Obsidian 后生效；Windows 上请使用“\\”而不是“/”。",
    },
    {
        pattern:
            /^and for matches \(at least (\d+) characters\) within the same \(or all\) commit\(s\),$/,
        translate: (match) =>
            "；对于同一次（或全部）提交中至少 " +
            match[1] +
            " 个字符的匹配，显示",
    },
    {
        pattern: /^Color for newest commits$/,
        translate: () => "最新提交的颜色",
    },
    {
        pattern: /^Color for oldest \((.+) or older\) commits$/,
        translate: (match) => "最早提交（" + match[1] + " 或更早）的颜色",
    },
    {
        pattern: /^abcdef Author Name (.+)$/,
        translate: (match) => "abcdef 作者姓名 " + match[1],
    },
    {
        pattern: /^Currently: (.+)$/,
        translate: (match) => "当前效果：" + match[1],
    },
    {
        pattern:
            /^The oldest age in the line author coloring\. Everything older will have the same color\.\s+Smallest valid age is "1d"\. Currently: (.+)$/,
        translate: (match) =>
            "行作者着色所使用的最早时间；更早的内容将使用相同颜色。最小有效值为“1d”。当前：" +
            match[1]
                .replace(/^(\d+(?:\.\d+)?) days$/, "$1 天")
                .replace("invalid!", "无效"),
    },
];

function translateZhCN(source: string): string {
    const exact = zhCNTranslations[source];
    if (exact !== undefined) return exact;

    for (const { pattern, translate } of zhCNPatterns) {
        const match = source.match(pattern);
        if (match) return translate(match);
    }
    return source;
}

export function isSimplifiedChinese(): boolean {
    const locale = moment.locale().toLowerCase();
    return (
        locale === "zh" || locale === "zh-cn" || locale.startsWith("zh-hans")
    );
}

export function t(
    source: string,
    replacements: Record<string, string | number> = {}
): string {
    let result = isSimplifiedChinese() ? translateZhCN(source) : source;

    for (const [key, value] of Object.entries(replacements)) {
        result = result.split(`{{${key}}}`).join(String(value));
    }
    return result;
}

export function localizeElement(root: HTMLElement): void {
    if (!isSimplifiedChinese()) return;

    const walker = root.ownerDocument.createTreeWalker(root, 4);
    let node: Node | null;
    while ((node = walker.nextNode())) {
        const original = node.nodeValue;
        if (!original) continue;
        const trimmed = original.trim();
        if (!trimmed) continue;
        const translated = t(trimmed);
        if (translated !== trimmed) {
            node.nodeValue = original.replace(trimmed, translated);
        }
    }

    root.querySelectorAll<HTMLElement>("*").forEach((element) => {
        for (const attribute of [
            "aria-label",
            "placeholder",
            "title",
        ] as const) {
            const value = element.getAttribute(attribute);
            if (!value) continue;
            const translated = t(value);
            if (translated !== value)
                element.setAttribute(attribute, translated);
        }
    });
}
