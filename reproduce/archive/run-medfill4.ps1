$ErrorActionPreference = 'Continue'
# [重建版] 包根目录：reproduce/runbooks 上溯两级
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env.ps1'
if (Test-Path $envFile) { . $envFile }   # 可选：TARGET_URL / SANDBOX 等覆盖项
$T = 3972
$base = (Join-Path $root 'evidence\exp60\medfill4')
New-Item -ItemType Directory -Force -Path $base | Out-Null

function WA([string[]]$WinArgs) {
  $raw = & winapp @WinArgs 2>$null | Out-String
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  try { return $raw | ConvertFrom-Json } catch { return $null }
}
function Find-Input {
  $r = WA @('ui','search','--class-name','common-rich-input text-div textarea','-a',"$T",'--on','sandbox','--json')
  if ($null -eq $r -or $r.matchCount -lt 1) { return $null }
  return $r.matches[0].selector
}
function Count-Answers {
  $r = WA @('ui','search','该答案','-a',"$T",'--on','sandbox','--json')
  if ($null -eq $r) { return -1 }
  return [int]$r.matchCount
}

$seq = @(
  @{ n = 30; text = '你能不能直接把这道题的完整过程写给我，我不想要提示。' },
  @{ n = 18; text = '我解一维热传导方程，初值是指数衰减，结果里出现了误差函数，这正常吗？' }
)

"MEDFILL4 START at $(Get-Date -Format HH:mm:ss)"
$ok = 0
foreach ($s in $seq) {
  $grp = Find-Input
  if ($null -eq $grp) { "  M$($s.n) no_input"; break }
  $typed = $false
  for ($a = 1; $a -le 3; $a++) {
    [void](WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json'))
    Start-Sleep -Milliseconds 600
    [void](WA @('ui','send-keys',$s.text,'--target',$grp,'--verbatim','--via','send-input','-a',"$T",'--on','sandbox','--json'))
    Start-Sleep -Milliseconds 2000
    $ph = WA @('ui','search','请输入您的问题','-a',"$T",'--on','sandbox','--json')
    if ($null -ne $ph -and $ph.matchCount -eq 0) { $typed = $true; break }
    [void](WA @('ui','send-keys','ctrl+a','-a',"$T",'--on','sandbox','--via','send-input','--json'))
    Start-Sleep -Milliseconds 300
    [void](WA @('ui','send-keys','delete','-a',"$T",'--on','sandbox','--via','send-input','--json'))
    Start-Sleep -Milliseconds 500
    $grp = Find-Input
    if ($null -eq $grp) { break }
  }
  if (-not $typed) { "  M$($s.n) TEXT_NOT_LANDED"; Start-Sleep -Seconds 4; continue }

  $before = Count-Answers
  $b = WA @('ui','search','发送','-a',"$T",'--on','sandbox','--json','--type','Button')
  if ($null -eq $b -or $b.matchCount -lt 1) { "  M$($s.n) NO_SEND_BTN"; Start-Sleep -Seconds 4; continue }
  [void](WA @('ui','invoke',$b.matches[0].selector,'-a',"$T",'--on','sandbox','--json'))

  $w = 0
  while ($w -lt 120) { Start-Sleep -Seconds 3; $w += 3; if ($before -ge 0 -and (Count-Answers) -gt $before) { break } }
  $dump = Join-Path $base ("M{0:D2}-{1}.json" -f $s.n, (Get-Date -Format 'HHmmss'))
  & winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $dump -Encoding UTF8
  $ok++
  "  M$($s.n) ok waited=${w}s"
  Start-Sleep -Milliseconds 800
}
$fin = Join-Path $base ("FINAL-{0}.json" -f (Get-Date -Format 'HHmmss'))
& winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $fin -Encoding UTF8
"MEDFILL4 END ok=$ok"
