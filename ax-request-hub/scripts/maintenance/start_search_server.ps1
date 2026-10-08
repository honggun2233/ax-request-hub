# Governance search server (port 8700) autostart wrapper
# Waits for pgvector container ready, then starts search_server.py
# Auto-restarts on crash (up to $maxRestarts times)
# Sends Telegram alert on fatal failure

$LogDir       = "C:\project\ax-team\ax-request-hub\logs"
$LogFile      = "$LogDir\search-server.log"
$PythonExe    = "C:\Users\Samsung\AppData\Local\Programs\Python\Python313\python.exe"
$ServerScript = "C:\project\ax-team\ax-request-hub\scripts\governance\search_server.py"
$WorkDir      = "C:\project\ax-team\ax-request-hub"
$PgIsReady    = "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe"

# Telegram (token/chat_id from Jarvis .env)
$TgToken  = "8652632453:AAEELqRsPYreNdmjqwFHtocYwA5GorbaJp0"
$TgChatId = "49017551"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content $LogFile "[$ts] $msg"
}

function TgAlert($msg) {
    try {
        $body = @{ chat_id = $TgChatId; text = $msg } | ConvertTo-Json
        Invoke-RestMethod -Uri "https://api.telegram.org/bot$TgToken/sendMessage" `
            -Method Post -ContentType "application/json; charset=utf-8" `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 10 | Out-Null
    } catch {}
}

# Step 1: wait for pgvector (2s interval, max 30 tries = 1 min)
Log "START: waiting for pgvector port 5438..."
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    & $PgIsReady -h localhost -p 5438 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Log "pgvector ready (attempt $i)"
        $ready = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    $errMsg = "[AX Hub] ALERT: governance search server failed to start - pgvector not ready after 60s"
    Log "ERROR: pgvector not ready after 30 attempts - exit"
    TgAlert $errMsg
    exit 1
}

# Step 2: run search_server.py, restart on crash
Log "Launching search_server.py"
$restartDelay = 5
$maxRestarts  = 10
$failCount    = 0

while ($true) {
    $proc = Start-Process -FilePath $PythonExe `
        -ArgumentList $ServerScript `
        -WorkingDirectory $WorkDir `
        -NoNewWindow -Wait -PassThru

    $exitCode = $proc.ExitCode
    Log "Process exited (code=$exitCode)"

    if ($exitCode -eq 0) {
        Log "Clean exit - not restarting"
        break
    }

    $failCount++
    if ($failCount -ge $maxRestarts) {
        $errMsg = "[AX Hub] ALERT: governance search server gave up after $maxRestarts crashes. Manual intervention needed. Log: $LogFile"
        Log "STOP: $maxRestarts consecutive failures - giving up"
        TgAlert $errMsg
        break
    }

    Log "Restart in ${restartDelay}s (failure $failCount/$maxRestarts)..."
    Start-Sleep -Seconds $restartDelay
    Log "Restarting"
}
