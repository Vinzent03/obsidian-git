import * as obsidian from "obsidian";

type Translation = readonly [english: string, chinese: string];

const translations: Record<string, string> = {
    "Git is not ready": "Git 尚未就绪",
    "When the repository is ready, automatic routines, commit, sync, and editor settings become available. Check the repository paths and Git configuration under Advanced.":
        "仓库就绪后，自动运行、提交、同步和编辑器设置将可用。请在“高级”中检查仓库路径和 Git 配置。",
    Automatic: "自动运行",
    "Scheduled commit, pull, and push routines.": "定时提交、拉取和推送。",
    "Use separate commit and push intervals": "分别设置提交和推送间隔",
    "Enable to use one interval for commits and another for pushes.":
        "启用后，提交和推送可使用不同间隔。",
    "Auto push interval (minutes)": "自动推送间隔（分钟）",
    "Push commits every X minutes. Set to 0 to disable.":
        "每 X 分钟推送提交。设为 0 可禁用。",
    "Auto pull interval (minutes)": "自动拉取间隔（分钟）",
    "Pull changes every X minutes. Set to 0 to disable.":
        "每 X 分钟拉取更改。设为 0 可禁用。",
    "Exclude leaves matching files unstaged. Include stages only matching files; an empty include list commits staged files only. Configured globs override the vault limit for auto staging.":
        "排除模式会保持匹配文件未暂存。包含模式仅暂存匹配文件；包含列表为空时只提交已暂存文件。配置的 glob 会覆盖库范围限制。",
    "Exclude matches": "排除匹配项",
    "Include matches": "包含匹配项",
    "One repository-relative Git glob per line, with / as the separator. For example, scripts/** matches a folder and **/*.tmp matches files anywhere. An empty include list stages no unstaged files.":
        "每行一个相对于仓库的 Git glob，以 / 分隔。例如 scripts/** 匹配文件夹，**/*.tmp 匹配任意位置的临时文件。包含列表为空时不暂存未暂存文件。",
    "Shows a prompt to specify your message.": "显示提示以输入提交信息。",
    "Placeholders: {{date}}, {{hostname}}, {{numFiles}}, and {{files}}.":
        "占位符：{{date}}、{{hostname}}、{{numFiles}} 和 {{files}}。",
    "List filenames affected by commit in the commit body":
        "在提交正文中列出受影响的文件名",
    Commit: "提交",
    "Commit messages and placeholders.": "提交信息与占位符。",
    "Commit message on manual commit": "手动提交时的提交信息",
    "Placeholders: {{date}}, {{hostname}}, {{numFiles}}, and {{files}}. Leave empty to require manual input.":
        "占位符：{{date}}、{{hostname}}、{{numFiles}} 和 {{files}}。留空则要求手动输入。",
    "Commit message script": "提交信息脚本",
    "Run with 'sh -c' to generate a commit message. Placeholders: {{hostname}}, {{date}}.":
        "通过 'sh -c' 运行以生成提交信息。占位符：{{hostname}}、{{date}}。",
    "{{date}} placeholder format": "{{date}} 占位符格式",
    "{{hostname}} placeholder replacement": "{{hostname}} 占位符替换值",
    "Set a hostname for this device. Defaults to the OS hostname on desktop.":
        "设置此设备的主机名。桌面端默认使用操作系统主机名。",
    "Preview commit message": "预览提交信息",
    Preview: "预览",
    Sync: "同步",
    "Pull, merge, and commit-and-sync behavior.": "拉取、合并及提交并同步行为。",
    Pull: "拉取",
    "Commit-and-sync": "提交并同步",
    "Push on commit-and-sync": "提交并同步时推送",
    "Push after committing. Disabling turns commit-and-sync into a local commit, with an optional pull.":
        "提交后推送。关闭后，提交并同步会变为可选拉取的本地提交。",
    "Squash commits before push": "推送前压缩提交",
    "Combine local unpushed commits into one before pushing. No force-push is needed.":
        "推送前将本地未推送提交合并为一个。无需强制推送。",
    Editor: "编辑器",
    "Merge conflict resolution, hunk controls, and line author information.":
        "合并冲突解决、代码块控制及行作者信息。",
    "Show merge conflict resolution": "显示合并冲突解决",
    "Both editing modes": "两种编辑模式",
    "Live Preview only": "仅实时预览",
    "Source mode only": "仅源码模式",
    Disabled: "已禁用",
    "Choose where conflict highlights and resolution buttons appear.":
        "选择冲突高亮和解决按钮的显示位置。",
    "Hunk management": "代码块管理",
    Signs: "标记",
    "Show colored change markers in the editor and stage, reset, or preview hunks.":
        "在编辑器中显示彩色更改标记，并暂存、重置或预览代码块。",
    "Hunk commands": "代码块命令",
    "Commands to stage and reset hunks and navigate between them.":
        "用于暂存、重置代码块及在代码块间导航的命令。",
    "Show line changes in the status bar": "在状态栏显示行更改",
    Colored: "彩色",
    Monochrome: "单色",
    "Line author information": "行作者信息",
    "Commit hash, author, date, and age coloring next to each line.":
        "在每行旁显示提交哈希、作者、日期及时间着色。",
    Views: "视图",
    "History, source control, and diff views.": "历史、源代码管理和差异视图。",
    "Source control view": "源代码管理视图",
    "Automatically refresh source control view on file changes":
        "文件更改时自动刷新源代码管理视图",
    "Disable on slower machines if this causes lag.": "若在较慢设备上导致卡顿，请禁用。",
    "Source control view refresh interval": "源代码管理视图刷新间隔",
    "Milliseconds to wait after a file change before refreshing. Minimum 500.":
        "文件更改后等待多少毫秒再刷新。最小值为 500。",
    "Diff view": "差异视图",
    "Diff view style": "差异视图样式",
    Split: "拆分",
    Unified: "统一",
    "Split mode creates an editable diff in the editor, which may differ from Git's diff.":
        "拆分模式在编辑器中创建可编辑差异，可能与 Git 的差异不同。",
    "Split diff computation time limit (ms)": "拆分差异计算时间上限（毫秒）",
    "Maximum milliseconds to compute a detailed split diff. Read-only diffs use ten times this value.":
        "计算详细拆分差异的最长毫秒数。只读差异使用此值的十倍。",
    "History view": "历史视图",
    "Show author": "显示作者",
    Hide: "隐藏",
    Full: "完整",
    Initials: "首字母",
    "Show the commit author in the history view.": "在历史视图中显示提交作者。",
    "Show date": "显示日期",
    "Uses the {{date}} placeholder format.": "使用 {{date}} 占位符格式。",
    Interface: "界面",
    "Notifications, status bar, and file menu.": "通知、状态栏和文件菜单。",
    "Show informational notifications": "显示信息通知",
    "Show notices about Git operations. The status bar still shows updates when this is off.":
        "显示 Git 操作通知。关闭后，状态栏仍显示更新。",
    "Show error notifications": "显示错误通知",
    "Show error notices for Git operations.": "显示 Git 操作错误通知。",
    "Show notifications when nothing changed": "无更改时也显示通知",
    "Also notify when a commit or push finds no changes.":
        "提交或推送未发现更改时也通知。",
    "Show status bar": "显示状态栏",
    "Restart Obsidian for this change to take effect.": "重启 Obsidian 后生效。",
    "File menu integration": "文件菜单集成",
    "Add Stage, Unstage, and Add to .gitignore actions to the file menu.":
        "在文件菜单中添加暂存、取消暂存和添加到 .gitignore 操作。",
    "Show branch status bar": "显示分支状态栏",
    "Show the count of modified files in the status bar":
        "在状态栏显示已修改文件数",
    Identity: "身份",
    "Authentication and commit author.": "身份验证和提交作者。",
    "Username on your Git server": "Git 服务器用户名",
    "Git server password or access token": "Git 服务器密码或访问令牌",
    "Select or create a secret stored on this device for this vault.":
        "选择或创建仅存储在此设备、供此库使用的密钥。",
    "Repository author name": "仓库作者名称",
    "Repository author email": "仓库作者邮箱",
    "Changes only this repository's Git config. Leave blank to use the global author name, if configured.":
        "仅更改此仓库的 Git 配置。留空则使用已配置的全局作者名称。",
    "Saved in this repository's Git config. Mobile Git has no global author name fallback.":
        "保存在此仓库的 Git 配置中。移动端 Git 没有全局作者名称回退。",
    "Changes only this repository's Git config. Leave blank to use the global author email, if configured.":
        "仅更改此仓库的 Git 配置。留空则使用已配置的全局作者邮箱。",
    "Saved in this repository's Git config. Mobile Git has no global author email fallback.":
        "保存在此仓库的 Git 配置中。移动端 Git 没有全局作者邮箱回退。",
    Advanced: "高级",
    "Repository paths, Git environment, and device options.":
        "仓库路径、Git 环境和设备选项。",
    "Update submodules": "更新子模块",
    "Commit-and-sync and pull update submodules. Tracking branches must be configured for each submodule.":
        "提交并同步及拉取会更新子模块。必须为每个子模块配置跟踪分支。",
    "Submodule recurse checkout/switch": "递归检出/切换子模块",
    "Recurse checkout on submodules when switching the root repository.":
        "切换根仓库时递归检出子模块。",
    "Limit file operations to the vault": "将文件操作限制在库内",
    "Custom Git binary path": "自定义 Git 可执行文件路径",
    "Path to the Git executable for a custom installation.":
        "自定义安装的 Git 可执行文件路径。",
    "Additional environment variables": "附加环境变量",
    "One KEY=VALUE pair per line.": "每行一个 KEY=VALUE 对。",
    "Additional PATH environment variable paths": "附加 PATH 环境变量路径",
    "One path per line.": "每行一个路径。",
    "Reload with new environment variables": "使用新环境变量重新加载",
    "Removing previous variables requires an Obsidian restart.":
        "移除旧变量需要重启 Obsidian。",
    "Repository folder within the vault": "库内仓库文件夹",
    "Choose the folder containing the Git repository. Leave empty when the repository is at the root.":
        "选择包含 Git 仓库的文件夹。仓库位于根目录时留空。",
    "Custom Git directory path (instead of .git)": "自定义 Git 目录路径（代替 .git）",
    "Resolved from the custom base path or vault root. Restart Obsidian to apply. Use backslashes on Windows.":
        "从自定义基础路径或库根目录解析。重启 Obsidian 后生效。Windows 上使用反斜杠。",
    "Disable on this device": "在此设备上禁用",
    "This setting is not synced.": "此设置不会同步。",
    Debugging: "调试",
    "Copy debug information": "复制调试信息",
    "May contain sensitive settings.": "可能包含敏感设置。",
    "Debugging and logging": "调试与日志",
    Support: "支持",
    Donate: "捐赠",
    "Support continued development of the plugin.": "支持插件的持续开发。",
    "Show commit authoring information next to each line": "在每行旁显示提交作者信息",
    "Only available on desktop currently.": "目前仅在桌面端可用。",
    "Follow movement and copies across files and commits":
        "跟踪跨文件和提交的移动与复制",
    "Do not follow (default)": "不跟踪（默认）",
    "Follow within same commit": "在同一提交内跟踪",
    "Follow within all commits (maybe slow)": "在所有提交内跟踪（可能较慢）",
    "Show commit hash": "显示提交哈希",
    "Author name display": "作者名称显示",
    "If and how the author is displayed": "作者是否以及如何显示",
    "Authoring date display": "作者日期显示",
    "If and how the date and time of authoring the line is displayed":
        "行作者日期和时间是否以及如何显示",
    "Custom authoring date format": "自定义作者日期格式",
    "Authoring date display timezone": "作者日期显示时区",
    "Oldest age in coloring": "着色中的最旧时间",
    "Text color": "文本颜色",
    "Ignore whitespace and newlines in changes": "在更改中忽略空白和换行",
    "Edit .gitignore": "编辑 .gitignore",
    "Open source control view": "打开源代码管理视图",
    "Open history view": "打开历史视图",
    "Open diff view": "打开差异视图",
    "Open file on GitHub": "在 GitHub 上打开文件",
    "Open file history on GitHub": "在 GitHub 上打开文件历史",
    Fetch: "获取",
    "Switch to remote branch": "切换到远程分支",
    "Add file to .gitignore": "将文件添加到 .gitignore",
    "Commit-and-sync and then close Obsidian": "提交并同步后关闭 Obsidian",
    "Commit-and-sync with specific message": "使用指定信息提交并同步",
    "Commit all changes": "提交所有更改",
    "Commit all changes with specific message": "使用指定信息提交所有更改",
    "Commit staged": "提交已暂存内容",
    "Amend staged": "修补已暂存提交",
    "Commit with specific message": "使用指定信息提交",
    "Commit staged with specific message": "使用指定信息提交已暂存内容",
    Push: "推送",
    "Stage current file": "暂存当前文件",
    "Unstage current file": "取消暂存当前文件",
    "Edit remotes": "编辑远程",
    "Remove remote": "移除远程",
    "Set upstream branch": "设置上游分支",
    "CAUTION: Delete repository": "警告：删除仓库",
    "Initialize a new repo": "初始化新仓库",
    "Clone an existing remote repo": "克隆现有远程仓库",
    "List changed files": "列出更改文件",
    "Switch branch": "切换分支",
    "Create new branch": "创建新分支",
    "Delete branch": "删除分支",
    "CAUTION: Discard all changes": "警告：丢弃所有更改",
    "Pause/Resume automatic routines": "暂停/恢复自动运行",
    "Raw command": "原始命令",
    "Toggle line author information": "切换行作者信息",
    "Reset hunk": "重置代码块",
    "Stage hunk": "暂存代码块",
    "Preview hunk": "预览代码块",
    "Go to next hunk": "转到下一个代码块",
    "Go to previous hunk": "转到上一个代码块",
    "Paused automatic routines.": "已暂停自动运行。",
    "Resumed automatic routines.": "已恢复自动运行。",
    "Git: Stage": "Git：暂存",
    "Git: Unstage": "Git：取消暂存",
    "Git: Add to .gitignore": "Git：添加到 .gitignore",
    "Open in default app": "使用默认应用打开",
    "Show in system explorer": "在系统文件管理器中显示",
    "Automatic routines are currently paused.": "自动运行当前已暂停。",
    Aborted: "已中止",
    "No Git repository found.": "未找到 Git 仓库。",
    "Initialize repository": "初始化仓库",
    "Clone repository": "克隆仓库",
    "More commit actions": "更多提交操作",
    "Stage all": "全部暂存",
    "Unstage all": "全部取消暂存",
    "Change Layout": "更改布局",
    Refresh: "刷新",
    "Merge in progress — select for help": "正在合并 — 选择以获取帮助",
    "Commit Message": "提交信息",
    Unstage: "取消暂存",
    Discard: "丢弃",
    Stage: "暂存",
    "Stage all and commit": "全部暂存并提交",
    "Commit staged and sync": "提交已暂存内容并同步",
    Conflicts: "冲突",
    "Staged Changes": "已暂存更改",
    "Staged outside vault": "库外已暂存",
    "Conflicts outside vault": "库外冲突",
    Changes: "更改",
    "Recently Pulled Files": "最近拉取的文件",
    "Open Git source control": "打开 Git 源代码管理",
    "{{count}} conflict(s) left": "剩余 {{count}} 个冲突",
    "And {{count}} more files": "另有 {{count}} 个文件",
    "{{count}} conflict(s) in file": "文件中有 {{count}} 个冲突",
    "Close hunk": "关闭代码块",
    "Open File": "打开文件",
    "Open file at this commit": "打开此提交中的文件",
    "Mark resolved": "标记为已解决",
    "No conflicts left": "没有剩余冲突",
    "Select branch to checkout": "选择要检出的分支",
    "Not supported files will be opened by default app!":
        "不支持的文件将使用默认应用打开！",
    "Type your message and select optional the version with the added date.":
        "输入提交信息，可选择带日期的版本。",
    "Merge in progress": "正在合并",
    "Resolve the conflicts": "解决冲突",
    "Finish the merge": "完成合并",
    "Got it": "知道了",
    Save: "保存",
    Cancel: "取消",
    "It seems like you are not using GitHub": "似乎未使用 GitHub",
    "Git is combining the version in your vault with changes from another version. The merge must be committed before Obsidian Git can push or resume automatic commits.":
        "Git 正在将库中的版本与另一版本的更改合并。必须先提交合并，Obsidian Git 才能推送或恢复自动提交。",
    "Git could not combine some parts automatically. Open each conflicted file and review every highlighted conflict block.":
        "Git 无法自动合并某些部分。请打开每个冲突文件并检查所有高亮的冲突块。",
    "Choose “Keep ours” for your local text, “Keep theirs” for the incoming text, “Keep both”, or edit the block manually.":
        "选择“保留我方”以使用本地文本，“保留对方”以使用传入文本，“保留双方”，或手动编辑该块。",
    "When the file's conflict count reaches zero, select the plus icon next to it to mark it as resolved.":
        "文件冲突数归零后，选择旁边的加号图标将其标记为已解决。",
    "Repeat this for every file in the Conflicts section.":
        "对“冲突”部分中的每个文件重复此操作。",
    "All conflicts have been marked as resolved.": "所有冲突均已标记为已解决。",
    "The merge is still active until you commit the staged changes.":
        "在提交已暂存更改前，合并仍处于活动状态。",
    "After the Conflicts section is empty, enter a commit message and commit the staged changes. This finishes the merge. You can then push normally.":
        "“冲突”部分为空后，输入提交信息并提交已暂存更改。这会完成合并，之后可正常推送。",
    "Copy commit hash": "复制提交哈希",
    "Keep ours": "保留我方",
    "Keep theirs": "保留对方",
    "Keep both": "保留双方",
    "Keep base": "保留基准",
    "Keep all ours": "全部保留我方",
    "Keep all theirs": "全部保留对方",
    "Keep all base": "全部保留基准",
    Cut: "剪切",
    Copy: "复制",
    Paste: "粘贴",
    "Paste as plain text": "粘贴为纯文本",
    "Select all": "全选",
    "File not found: ": "未找到文件：",
    "This takes longer: Getting status": "这可能需要更长时间：正在获取状态",
    "Specify your username": "请输入用户名",
    "Specify your password/personal access token": "请输入密码/个人访问令牌",
    "Authentication failed. Please try with different credentials":
        "身份验证失败。请尝试其他凭据。",
    "ObsidianGit: Base path does not exist": "ObsidianGit：基础路径不存在",
    "No upstream branch is set. Please select one.": "未设置上游分支。请选择一个。",
    "Enter remote URL": "输入远程 URL",
    "Enter directory for clone. It needs to be empty or not existent.":
        "输入克隆目录。目录必须为空或不存在。",
    "Specify depth of clone. Leave empty for full clone.":
        "指定克隆深度。留空以进行完整克隆。",
    "This branch isn't merged into HEAD. Force delete?": "此分支尚未合并到 HEAD。强制删除？",
    "Select a remote": "选择远程",
    "Do you really want to delete the repository (.git directory)? This action cannot be undone.":
        "确定要删除仓库（.git 目录）吗？此操作无法撤销。",
};

export function normalizeLanguage(language?: string): "en" | "zh" {
    if (!language) return "en";
    const normalized = language.replace("_", "-").toLowerCase();
    return normalized === "zh" || normalized.startsWith("zh-")
        ? "zh"
        : "en";
}

export function currentLanguage(): "en" | "zh" {
    const detected =
        obsidian.getLanguage?.() ??
        (typeof obsidian.moment?.locale === "function"
            ? obsidian.moment.locale()
            : "en");
    return normalizeLanguage(detected);
}

/**
 * Look up a Chinese translation by its English source string. English is
 * returned unchanged, so existing UI copy and fallback behavior stay intact.
 */
export function t(english: string, chinese?: string): string {
    if (currentLanguage() !== "zh") return english;
    return translations[english] ?? chinese ?? english;
}

export function translateDynamic(
    english: string,
    chinese: string,
    values: Record<string, string | number>
): string {
    const template = t(english, chinese);
    return Object.entries(values).reduce(
        (text, [key, value]) =>
            text.split(`{{${key}}}`).join(String(value)),
        template
    );
}

import type {
    SettingDefinition,
    SettingDefinitionItem,
    SettingGroupItem,
} from "obsidian";

function translateLeaf(item: SettingDefinition): SettingDefinition {
    const translated = {
        ...item,
        name: t(item.name),
        desc: typeof item.desc === "string" ? t(item.desc) : item.desc,
    };
    if ("control" in item && item.control?.type === "dropdown") {
        return {
            ...translated,
            control: {
                ...item.control,
                options: Object.fromEntries(
                    Object.entries(item.control.options!).map(([key, label]) => [
                        key,
                        t(label),
                    ])
                ),
            },
        } as SettingDefinition;
    }
    return translated as SettingDefinition;
}

function translateGroupItem(item: SettingGroupItem): SettingGroupItem {
    if ("type" in item && item.type === "page") {
        return {
            ...item,
            name: t(item.name),
            desc: typeof item.desc === "string" ? t(item.desc) : item.desc,
            items: item.items?.map(translateDefinitionItem),
        };
    }
    return translateLeaf(item as SettingDefinition);
}

/** Translate display-only fields while retaining Obsidian's definition shape. */
export function translateSettingDefinitions(
    items: SettingDefinitionItem[]
): SettingDefinitionItem[] {
    if (currentLanguage() !== "zh") return items;
    return items.map(translateDefinitionItem);
}

function translateDefinitionItem(
    item: SettingDefinitionItem
): SettingDefinitionItem {
    if ("type" in item && (item.type === "group" || item.type === "list")) {
        return {
            ...item,
            heading: item.heading ? t(item.heading) : item.heading,
            items: item.items?.map(translateGroupItem),
        };
    }
    if ("type" in item && item.type === "page") {
        return {
            ...item,
            name: t(item.name),
            desc: typeof item.desc === "string" ? t(item.desc) : item.desc,
            items: item.items?.map(translateDefinitionItem),
        };
    }
    return translateLeaf(item as SettingDefinition);
}
