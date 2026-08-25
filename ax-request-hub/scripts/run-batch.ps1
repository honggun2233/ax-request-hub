# AX Hub 배치 스케줄러 (자체 호스팅용)
# Windows 작업 스케줄러에서 매일 새벽 1~3시에 실행하도록 등록
#
# 등록 방법 (관리자 PowerShell):
#   Register-ScheduledTask -TaskName "AXHub-Batch" `
#     -Action (New-ScheduledTaskAction -Execute "powershell.exe" `
#       -Argument "-NonInteractive -File C:\project\ax-team\ax-request-hub\scripts\run-batch.ps1") `
#     -Trigger (New-ScheduledTaskTrigger -Daily -At "01:00") `
#     -RunLevel Highest

param(
  [string]$BaseUrl = "http://localhost:3005",
  [string]$CronSecret = $env:CRON_SECRET
)

if (-not $CronSecret) {
  Write-Error "CRON_SECRET 환경변수가 없습니다. .env.local을 확인하세요."
  exit 1
}

$headers = @{ Authorization = "Bearer $CronSecret" }

function Invoke-Batch {
  param([string]$Path, [string]$Label)
  Write-Host "[$Label] 실행 중..."
  try {
    $res = Invoke-RestMethod -Uri "$BaseUrl$Path" -Method POST -Headers $headers -ContentType "application/json"
    Write-Host "[$Label] 완료: $($res | ConvertTo-Json -Compress)"
  } catch {
    Write-Warning "[$Label] 오류: $_"
  }
}

Invoke-Batch "/api/admin/usage/expire-check"    "데이터 만료 처리"
Invoke-Batch "/api/admin/agents/inactive-check" "미사용 에이전트 감가"
Invoke-Batch "/api/admin/agents/retire-check"   "은퇴 예고 처리"

Write-Host "배치 완료"
