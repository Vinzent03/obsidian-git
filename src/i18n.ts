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
    let result = isSimplifiedChinese()
        ? zhCNTranslations[source] ?? source
        : source;

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
