$ErrorActionPreference = 'Stop'
$port = 3199
if ($env:BRIDGE_PORT) { $port = [int]$env:BRIDGE_PORT }
if ($port -lt 1 -or $port -gt 65535) { throw 'Invalid companion port.' }
$baseUrl = 'http://127.0.0.1:' + $port
try { $health = Invoke-RestMethod -Uri ($baseUrl + '/health') -TimeoutSec 2 }
catch { exit 0 }
if ($health.name -ne 'SenseRing Bridge' -or -not $health.sessionToken) { throw 'The port is not a verified SenseRing companion.' }
Invoke-RestMethod -Uri ($baseUrl + '/shutdown') -Method Post -ContentType 'application/json' -Headers @{ 'X-SenseRing-Token' = $health.sessionToken } -Body '{}' -TimeoutSec 3 | Out-Null
