param([switch]$OpenWebsite)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$entry = Join-Path $projectRoot 'local-media-bridge.js'
$runtime = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$port = 3199
if ($env:BRIDGE_PORT) { $port = [int]$env:BRIDGE_PORT }
if ($port -lt 1 -or $port -gt 65535) { throw 'Invalid companion port.' }
$baseUrl = 'http://127.0.0.1:' + $port

function Read-Companion {
    try {
        $health = Invoke-RestMethod -Uri ($baseUrl + '/health') -TimeoutSec 1
    } catch { return $null }
    if ($health.name -eq 'SenseRing Bridge' -and $health.ok) { return $health }
    throw 'Another application is using the companion port.'
}

try {
    if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'Companion files are missing. Extract the complete ZIP first.' }
    $health = Read-Companion
    if (-not $health) {
        $bundledNode = Join-Path $projectRoot 'runtime\node.exe'
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        $node = if (Test-Path -LiteralPath $bundledNode -PathType Leaf) { $bundledNode } elseif ($nodeCommand) { $nodeCommand.Source } else { $null }
        if (-not $node) {
            $candidates = @(
                (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
                (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
                (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
            )
            $node = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        }
        if (-not $node) { throw 'The companion runtime is missing. Download the complete companion and extract all files again.' }
        $nodeVersion = & $node --version
        if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { throw 'SenseRing needs its included runtime or Node.js 22 or later.' }
        Start-Process -FilePath $node -ArgumentList @('"' + $entry + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'bridge.log') -RedirectStandardError (Join-Path $runtime 'bridge-error.log') | Out-Null
        for ($attempt = 0; $attempt -lt 24 -and -not $health; $attempt++) {
            Start-Sleep -Milliseconds 250
            $health = Read-Companion
        }
        if (-not $health) { throw 'Companion did not start. See .runtime\bridge-error.log.' }
    }
    if ($OpenWebsite) { Start-Process -FilePath ($baseUrl + '/') | Out-Null }
} catch {
    $_.Exception.Message | Set-Content -LiteralPath (Join-Path $runtime 'launcher-error.log') -Encoding UTF8
    throw
}
