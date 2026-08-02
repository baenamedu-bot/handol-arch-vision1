# 아크비전 iOS CI 시크릿 설정 (한 번만 실행)
# 사전 조건: gh CLI 로그인 상태 (gh auth status)
# 실행: powershell -ExecutionPolicy Bypass -File scripts\set-ios-secrets.ps1

$repo = "baenamedu-bot/handol-arch-vision1"
$certs = "D:\1-younmestudio\android-tools\ios-certs"

function B64($path) { [Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) }

# 1) 배포 인증서 (.p12) — ArchCheck 때 만든 것 재사용
B64 "$certs\dist.p12" | gh secret set IOS_CERT_P12_BASE64 -R $repo
Get-Content "$certs\p12_password.txt" -Raw | ForEach-Object { $_.Trim() } | gh secret set IOS_CERT_PASSWORD -R $repo

# 2) 프로비저닝 프로파일 — ArchVision AppStore (다운로드 후 경로 확인)
$profile = "$certs\ArchVision_AppStore.mobileprovision"
if (-not (Test-Path $profile)) { Write-Error "프로파일 없음: $profile"; exit 1 }
B64 $profile | gh secret set IOS_PROFILE_BASE64 -R $repo

# 3) App Store Connect API 키
B64 "$certs\AuthKey_XFX47C4372.p8" | gh secret set ASC_API_KEY_BASE64 -R $repo
"XFX47C4372" | gh secret set ASC_API_KEY_ID -R $repo

# Issuer ID: App Store Connect > 사용자 및 액세스 > 통합(Integrations) 에서 확인
$issuer = Read-Host "ASC Issuer ID 입력 (App Store Connect > 통합 페이지의 Issuer ID)"
$issuer.Trim() | gh secret set ASC_API_ISSUER_ID -R $repo

Write-Host "`n완료! gh secret list -R $repo 로 확인하세요." -ForegroundColor Green
