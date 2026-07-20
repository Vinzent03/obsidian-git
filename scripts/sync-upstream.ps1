# cspell:ignore LASTEXITCODE
[CmdletBinding()]
param(
    [switch]$Push,
    [string]$LocalizationBranch = "agent/chinese-localization"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$upstreamUrl = "https://github.com/Vinzent03/obsidian-git.git"
$upstreamBranch = "master"
$repoRoot = Split-Path -Parent $PSScriptRoot
$startingBranch = ""

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Push-Location -LiteralPath $repoRoot
try {
    $insideWorkTree = (& git rev-parse --is-inside-work-tree 2>$null)
    if ($LASTEXITCODE -ne 0 -or $insideWorkTree -ne "true") {
        throw "脚本必须在 Git 仓库内运行。"
    }

    $changes = @(& git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw "无法读取工作树状态。"
    }
    if ($changes.Count -gt 0) {
        throw "工作树存在未提交更改。请先提交或暂存处理后再同步上游。"
    }

    $startingBranch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($startingBranch)) {
        throw "当前不在本地分支上。"
    }
    if ($startingBranch -ne $LocalizationBranch) {
        throw "请先切换到汉化分支 '$LocalizationBranch'，再运行此脚本。"
    }

    $remoteNames = @(& git remote)
    if ($remoteNames -notcontains "upstream") {
        Invoke-Git remote add upstream $upstreamUrl
    } else {
        $configuredUpstream = (& git remote get-url upstream).Trim()
        if ($configuredUpstream -ne $upstreamUrl) {
            throw "upstream 当前指向 '$configuredUpstream'，与预期的 '$upstreamUrl' 不一致。脚本不会自动覆盖。"
        }
    }

    Invoke-Git fetch upstream --prune
    Invoke-Git switch $upstreamBranch
    Invoke-Git merge --ff-only "upstream/$upstreamBranch"
    if ($Push) {
        Invoke-Git push origin $upstreamBranch
    }

    Invoke-Git switch $LocalizationBranch
    Invoke-Git merge --no-edit $upstreamBranch
    if ($Push) {
        Invoke-Git push --set-upstream origin $LocalizationBranch
    }

    Write-Host "上游同步完成。当前分支：$LocalizationBranch"
    if (-not $Push) {
        Write-Host "本次只更新了本地分支；确认无误后可重新运行并加 -Push 推送到 fork。"
    }
} catch {
    $currentChanges = @(& git status --porcelain 2>$null)
    $currentBranch = (& git branch --show-current 2>$null).Trim()
    if ($startingBranch -and $currentChanges.Count -eq 0 -and $currentBranch -and $currentBranch -ne $startingBranch) {
        & git switch $startingBranch | Out-Null
    }
    throw
} finally {
    Pop-Location
}
