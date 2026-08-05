# 누락된 시크릿 2개 + Issuer ID 보정 (한 번만 실행)
$repo = "baenamedu-bot/handol-arch-vision1"
$certs = "D:\1-younmestudio\android-tools\ios-certs"

function B64($path) { [Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) }

# 1) 배포 인증서 p12 (지난번 등록 실패분)
gh secret set IOS_CERT_P12_BASE64 -R $repo --body (B64 "$certs\dist.p12")
if ($LASTEXITCODE -ne 0) { Write-Error "IOS_CERT_P12_BASE64 실패"; exit 1 }

# 2) ASC API 키 p8 (지난번 등록 실패분)
gh secret set ASC_API_KEY_BASE64 -R $repo --body (B64 "$certs\AuthKey_XFX47C4372.p8")
if ($LASTEXITCODE -ne 0) { Write-Error "ASC_API_KEY_BASE64 실패"; exit 1 }

# 3) Issuer ID 정정 (이메일 아님 — ASC 통합 페이지의 UUID)
gh secret set ASC_API_ISSUER_ID -R $repo --body "d4810ae9-cc8f-4d1f-abf1-3e7c4c1bf62c"

Write-Host "`n=== 최종 시크릿 목록 (6개여야 함) ===" -ForegroundColor Green
gh secret list -R $repo
