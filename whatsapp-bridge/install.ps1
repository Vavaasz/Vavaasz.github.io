$ErrorActionPreference = "Stop"

$BridgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 18991
$RhPort = 18992
$ConfigDir = Join-Path $BridgeRoot "data"
$ConfigPath = Join-Path $ConfigDir "config.json"
$LogDir = Join-Path $ConfigDir "logs"
$InstallLog = Join-Path $LogDir "install.log"
$RhConfigDir = Join-Path $BridgeRoot "data-rh"
$RhConfigPath = Join-Path $RhConfigDir "config.json"
$RhLogDir = Join-Path $RhConfigDir "logs"
$OverlayConfigDir = Join-Path $env:APPDATA "TKA Relatorio Horario Overlay"
$OverlayConfigPath = Join-Path $OverlayConfigDir "whatsapp-config.json"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartupCmd = Join-Path $StartupDir "TKA WhatsApp Bridge.cmd"
$RhStartupCmd = Join-Path $StartupDir "TKA WhatsApp RH Bridge.cmd"
$DesktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "TKA WhatsApp Bridge Status.url"
$RhDesktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "TKA WhatsApp RH Status.url"

function New-BridgeToken {
  $Bytes = New-Object byte[] 32
  $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $Rng.GetBytes($Bytes)
  [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Write-InstallLog {
  param([string]$Message)
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  Add-Content -Encoding UTF8 -Path $InstallLog -Value "$((Get-Date).ToString("o")) $Message"
}

function Get-BridgeNodePath {
  $RuntimeNode = Join-Path $BridgeRoot "runtime\node.exe"
  if (Test-Path $RuntimeNode) {
    return $RuntimeNode
  }
  $SystemNode = Get-Command node -ErrorAction SilentlyContinue
  if ($SystemNode) {
    return $SystemNode.Source
  }
  return $RuntimeNode
}

function Stop-BridgeProcesses {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.ProcessId -ne $PID -and
      $_.CommandLine -and
      $_.CommandLine -like "*$BridgeRoot*" -and
      ($_.CommandLine -like "*server.js*" -or $_.CommandLine -like "*run-hidden.ps1*" -or $_.CommandLine -like "*run-watchdog.cmd*")
    } |
    ForEach-Object {
      Write-InstallLog "Stopping process $($_.ProcessId): $($_.CommandLine)"
      try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
    }
}

function Start-BridgeWatchdog {
  $WatchdogCmd = Join-Path $BridgeRoot "run-watchdog.cmd"
  if (Test-Path $WatchdogCmd) {
    Write-InstallLog "Starting CMD watchdog: $WatchdogCmd"
    Start-Process -FilePath "cmd.exe" `
      -ArgumentList "/c", "`"$WatchdogCmd`"" `
      -WorkingDirectory $BridgeRoot `
      -WindowStyle Hidden
    return
  }

  Write-InstallLog "Starting PowerShell watchdog fallback"
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", "$BridgeRoot\run-hidden.ps1" `
    -WorkingDirectory $BridgeRoot `
    -WindowStyle Hidden
}

function Start-RhBridgeWatchdog {
  $WatchdogCmd = Join-Path $BridgeRoot "run-rh-watchdog.cmd"
  Write-InstallLog "Starting RH CMD watchdog: $WatchdogCmd"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "`"$WatchdogCmd`"" `
    -WorkingDirectory $BridgeRoot `
    -WindowStyle Hidden
}

function Get-BridgeHealth {
  param(
    [int]$TargetPort = $Port,
    [int]$Attempts = 1,
    [int]$TimeoutSec = 5,
    [int]$DelaySec = 2
  )

  $Health = $null
  for ($Attempt = 1; $Attempt -le $Attempts; $Attempt += 1) {
    try {
      $Health = Invoke-RestMethod -Uri "http://127.0.0.1:$TargetPort/health" -TimeoutSec $TimeoutSec
      return $Health
    } catch {
      $Health = [pscustomobject]@{ ok = $false; error = $_.Exception.Message; attempt = $Attempt }
      Start-Sleep -Seconds $DelaySec
    }
  }
  return $Health
}

function Get-LogTail {
  param(
    [string]$Path,
    [int]$Count = 30
  )
  if (-not (Test-Path $Path)) {
    return ""
  }
  return ((Get-Content -Path $Path -Tail $Count -ErrorAction SilentlyContinue) -join "`n")
}

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $RhConfigDir | Out-Null
New-Item -ItemType Directory -Force -Path $RhLogDir | Out-Null
Write-InstallLog "Installing bridge from $BridgeRoot"

$Config = $null
if (Test-Path $ConfigPath) {
  try {
    $Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
  } catch {
    $Config = $null
  }
}

if (-not $Config) {
  $Config = [pscustomobject]@{
    token = New-BridgeToken
    port = $Port
    host = "127.0.0.1"
    historyBackfill = [pscustomobject]@{
      enabled = $true
      maxRoundsPerGroup = 200
      messagesPerRound = 20
      requestDelayMs = 10000
      groupsPerRun = 1
    }
    monitoring = [pscustomobject]@{
      enabled = $true
      graceMinutes = 15
      missingAfterMinutes = 45
      recentHours = 8
      activeHours = [pscustomobject]@{
        dayStart = 6
        dayEnd = 18
        nightStart = 18
        nightEnd = 6
      }
    }
    maxStoredReports = 10000
    historyImportVersion = 3
    createdAt = (Get-Date).ToString("o")
  }
} else {
  if (-not $Config.token) {
    $Config | Add-Member -NotePropertyName token -NotePropertyValue (New-BridgeToken) -Force
  }
  $Config | Add-Member -NotePropertyName port -NotePropertyValue $Port -Force
  $Config | Add-Member -NotePropertyName host -NotePropertyValue "127.0.0.1" -Force
  $Config | Add-Member -NotePropertyName historyBackfill -NotePropertyValue ([pscustomobject]@{
    enabled = $true
    maxRoundsPerGroup = 200
    messagesPerRound = 20
    requestDelayMs = 10000
    groupsPerRun = 1
  }) -Force
  if (-not $Config.monitoring) {
    $Config | Add-Member -NotePropertyName monitoring -NotePropertyValue ([pscustomobject]@{
      enabled = $true
      graceMinutes = 15
      missingAfterMinutes = 45
      recentHours = 8
      activeHours = [pscustomobject]@{
        dayStart = 6
        dayEnd = 18
        nightStart = 18
        nightEnd = 6
      }
    }) -Force
  } else {
    if ($null -eq $Config.monitoring.enabled) { $Config.monitoring | Add-Member -NotePropertyName enabled -NotePropertyValue $true -Force }
    if (-not $Config.monitoring.graceMinutes) { $Config.monitoring | Add-Member -NotePropertyName graceMinutes -NotePropertyValue 15 -Force }
    if (-not $Config.monitoring.missingAfterMinutes) { $Config.monitoring | Add-Member -NotePropertyName missingAfterMinutes -NotePropertyValue 45 -Force }
    if (-not $Config.monitoring.recentHours) { $Config.monitoring | Add-Member -NotePropertyName recentHours -NotePropertyValue 8 -Force }
    if (-not $Config.monitoring.activeHours) {
      $Config.monitoring | Add-Member -NotePropertyName activeHours -NotePropertyValue ([pscustomobject]@{
        dayStart = 6
        dayEnd = 18
        nightStart = 18
        nightEnd = 6
      }) -Force
    } else {
      if ($null -eq $Config.monitoring.activeHours.dayStart) { $Config.monitoring.activeHours | Add-Member -NotePropertyName dayStart -NotePropertyValue 6 -Force }
      if ($null -eq $Config.monitoring.activeHours.dayEnd) { $Config.monitoring.activeHours | Add-Member -NotePropertyName dayEnd -NotePropertyValue 18 -Force }
      if ($null -eq $Config.monitoring.activeHours.nightStart) { $Config.monitoring.activeHours | Add-Member -NotePropertyName nightStart -NotePropertyValue 18 -Force }
      if ($null -eq $Config.monitoring.activeHours.nightEnd) { $Config.monitoring.activeHours | Add-Member -NotePropertyName nightEnd -NotePropertyValue 6 -Force }
    }
  }
  $Config | Add-Member -NotePropertyName maxStoredReports -NotePropertyValue 10000 -Force
  $Config | Add-Member -NotePropertyName historyImportVersion -NotePropertyValue 3 -Force
}

$Config | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $ConfigPath

$RhConfig = $null
if (Test-Path $RhConfigPath) {
  try {
    $RhConfig = Get-Content $RhConfigPath -Raw | ConvertFrom-Json
  } catch {
    $RhConfig = $null
  }
}

if (-not $RhConfig) {
  $RhConfig = [pscustomobject]@{
    token = New-BridgeToken
    mode = "rh"
    port = $RhPort
    host = "127.0.0.1"
    historyBackfill = [pscustomobject]@{
      enabled = $false
      maxRoundsPerGroup = 0
      messagesPerRound = 50
      requestDelayMs = 1500
    }
    maxStoredRhMessages = 10000
    createdAt = (Get-Date).ToString("o")
  }
} else {
  if (-not $RhConfig.token) {
    $RhConfig | Add-Member -NotePropertyName token -NotePropertyValue (New-BridgeToken) -Force
  }
  $RhConfig | Add-Member -NotePropertyName mode -NotePropertyValue "rh" -Force
  $RhConfig | Add-Member -NotePropertyName port -NotePropertyValue $RhPort -Force
  $RhConfig | Add-Member -NotePropertyName host -NotePropertyValue "127.0.0.1" -Force
  $RhConfig | Add-Member -NotePropertyName historyBackfill -NotePropertyValue ([pscustomobject]@{
    enabled = $false
    maxRoundsPerGroup = 0
    messagesPerRound = 50
    requestDelayMs = 1500
  }) -Force
  $RhConfig | Add-Member -NotePropertyName maxStoredRhMessages -NotePropertyValue 10000 -Force
}

$RhConfig | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $RhConfigPath

if (-not (Test-Path (Join-Path $BridgeRoot "node_modules"))) {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "node_modules is missing and npm is not available. Use the release package, which includes dependencies."
  }
  Push-Location $BridgeRoot
  try {
    npm install --omit=dev
  } finally {
    Pop-Location
  }
}

New-Item -ItemType Directory -Force -Path $OverlayConfigDir | Out-Null
[pscustomobject]@{
  enabled = $true
  feedUrl = "http://127.0.0.1:$Port/reports"
  token = $Config.token
  timeoutMs = 10000
} | ConvertTo-Json | Set-Content -Encoding UTF8 $OverlayConfigPath

New-Item -ItemType Directory -Force -Path $StartupDir | Out-Null
@"
@echo off
cd /d "$BridgeRoot"
start "" /min "$BridgeRoot\run-watchdog.cmd"
"@ | Set-Content -Encoding ASCII $StartupCmd

@"
@echo off
cd /d "$BridgeRoot"
start "" /min "$BridgeRoot\run-rh-watchdog.cmd"
"@ | Set-Content -Encoding ASCII $RhStartupCmd

@"
[InternetShortcut]
URL=http://127.0.0.1:$Port/status
"@ | Set-Content -Encoding ASCII $DesktopShortcut

@"
[InternetShortcut]
URL=http://127.0.0.1:$RhPort/rh/status
"@ | Set-Content -Encoding ASCII $RhDesktopShortcut

Stop-BridgeProcesses
Start-Sleep -Seconds 1

$Existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $Existing) {
  Start-BridgeWatchdog
  Start-Sleep -Seconds 3
}

$RhExisting = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $RhPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $RhExisting) {
  Start-RhBridgeWatchdog
  Start-Sleep -Seconds 3
}

$Health = Get-BridgeHealth -TargetPort $Port -Attempts 20 -TimeoutSec 3 -DelaySec 1
$RhHealth = Get-BridgeHealth -TargetPort $RhPort -Attempts 20 -TimeoutSec 3 -DelaySec 1

if (-not $Health.ok) {
  Write-InstallLog "Health failed after watchdog start: $($Health.error)"
  $Node = Get-BridgeNodePath
  $NodeVersion = ""
  $NodeCheck = ""
  try {
    $NodeVersion = (& $Node --version 2>&1 | Out-String).Trim()
  } catch {
    $NodeVersion = $_.Exception.Message
  }
  try {
    $NodeCheck = (& $Node --check (Join-Path $BridgeRoot "server.js") 2>&1 | Out-String).Trim()
  } catch {
    $NodeCheck = $_.Exception.Message
  }

  Write-InstallLog "Node version: $NodeVersion"
  Write-InstallLog "Node check: $NodeCheck"

  $Processes = Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$BridgeRoot*" } |
    Select-Object ProcessId, ParentProcessId, Name, CommandLine

  $Health = [pscustomobject]@{
    ok = $false
    error = $Health.error
    node = $Node
    nodeVersion = $NodeVersion
    nodeCheck = $NodeCheck
    watchdogLog = Get-LogTail (Join-Path $LogDir "watchdog.log") 20
    stderr = Get-LogTail (Join-Path $LogDir "bridge-stderr.log") 40
    stdout = Get-LogTail (Join-Path $LogDir "bridge-stdout.log") 20
    directStderr = Get-LogTail (Join-Path $LogDir "bridge-direct-stderr.log") 40
    processes = $Processes
  }
}

Write-Host "TKA WhatsApp Bridge installed."
Write-Host "Status URL: http://127.0.0.1:$Port/status"
Write-Host "RH Status URL: http://127.0.0.1:$RhPort/rh/status"
Write-Host "Overlay config: $OverlayConfigPath"
Write-Host "Startup shortcut: $StartupCmd"
Write-Host "RH startup shortcut: $RhStartupCmd"
Write-Host "Install log: $InstallLog"
Write-Host "Health: $($Health | ConvertTo-Json -Compress -Depth 8)"
Write-Host "RH Health: $($RhHealth | ConvertTo-Json -Compress -Depth 8)"
if ($Health.ok) {
  Start-Process "http://127.0.0.1:$Port/status"
}
if ($RhHealth.ok) {
  Start-Process "http://127.0.0.1:$RhPort/rh/status"
}
