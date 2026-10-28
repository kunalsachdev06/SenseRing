$ErrorActionPreference = 'Stop'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$target = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Start-SenseRing-Background.vbs'))
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw 'Extract all companion files before installing startup.' }
$linkPath = [IO.Path]::GetFullPath((Join-Path $startupDirectory 'SenseRing Companion.lnk'))
if ([IO.Path]::GetDirectoryName($linkPath) -ne [IO.Path]::GetFullPath($startupDirectory)) { throw 'Unexpected startup shortcut path.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($linkPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + $target + '"'
$shortcut.WorkingDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$shortcut.Description = 'Start the local SenseRing companion quietly at sign-in'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output 'SenseRing companion will start at your next Windows sign-in. The browser will not open automatically.'
