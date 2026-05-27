# 本地测试 Plus webhook（不经过 Creem）
# 用法：先 npm run dev，再：
#   .\scripts\test-plus-webhook.ps1 -Secret "你的BILLING_WEBHOOK_SECRET" -UserId "Supabase用户UUID"

param(
  [string]$Secret,
  [Parameter(Mandatory = $true)]
  [string]$UserId,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OrderId = "test-001"
)

if (-not $Secret) {
  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*BILLING_WEBHOOK_SECRET=(.+)$') {
        $Secret = $Matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }
}
if (-not $Secret) {
  Write-Error "缺少 -Secret，或在 .env.local 配置 BILLING_WEBHOOK_SECRET"
  exit 1
}

$uri = "$BaseUrl/api/billing/webhook"
$body = @{
  user_id           = $UserId
  plan_id           = "monthly"
  provider          = "test"
  external_order_id = $OrderId
} | ConvertTo-Json -Compress

Write-Host "POST $uri"
try {
  $res = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
    Authorization  = "Bearer $Secret"
    "Content-Type" = "application/json; charset=utf-8"
  } -Body $body
  $res | ConvertTo-Json -Compress
} catch {
  if ($_.Exception.Response) {
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
  } else {
    Write-Host $_.Exception.Message
  }
  exit 1
}
