$ErrorActionPreference = 'Stop'
$startupDirectory = [IO.Path]::GetFullPath([Environment]::GetFolderPath('Startup'))
$linkPath = [IO.Path]::GetFullPath((Join-Path $startupDirectory 'SenseRing Companion.lnk'))
if ([IO.Path]::GetDirectoryName($linkPath) -ne $startupDirectory) { throw 'Unexpected startup shortcut path.' }
if (-not (Test-Path -LiteralPath $linkPath -PathType Leaf)) { Write-Output 'No SenseRing startup shortcut was found.'; exit 0 }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($linkPath)
$expected = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Start-SenseRing-Background.vbs'))
if ($shortcut.Arguments -ne ('"' + $expected + '"')) { throw 'Shortcut points to a different installation; no file was removed.' }
Remove-Item -LiteralPath $linkPath
Write-Output 'SenseRing startup shortcut removed. Use Stop-SenseRing.vbs to stop a running companion.'
