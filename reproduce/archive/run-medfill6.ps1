$ErrorActionPreference = 'Continue'
# [重建版] 包根目录：reproduce/runbooks 上溯两级
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env.ps1'
if (Test-Path $envFile) { . $envFile }   # 可选：TARGET_URL / SANDBOX 等覆盖项
$T = 3972
$base = (Join-Path $root 'evidence\exp60\medfill6')
New-Item -ItemType Directory -Force -Path $base | Out-Null

function WA([string[]]$WinArgs) {
  $raw = & winapp @WinArgs 2>$null | Out-String
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  try { return $raw | ConvertFrom-Json } catch { return $null }
}
function Find-InputByPlaceholder {
  $r = WA @('ui','search','请输入您的问题','-a',"$T",'--on','sandbox','--json')
  if ($null -eq $r -or $r.matchCount -lt 1) { return $null }
  $anc = $r.matches[0].invokableAncestor
  if ($null -eq $anc) { return $null }
  return $anc.selector
}
function Count-Answers {
  $r = WA @('ui','search','该答案','-a',"$T",'--on','sandbox','--json')
  if ($null -eq $r) { return -1 }
  return [int]$r.matchCount
}

# 先重置会话，把 1.7GB 的重页面换成轻页面
$nc = WA @('ui','search','开启新对话','-a',"$T",'--on','sandbox','--json')
if ($null -ne $nc -and $nc.matchCount -ge 1) {
  [void](WA @('ui','invoke',$nc.matches[0].selector,'-a',"$T",'--on','sandbox','--json'))
  "reset invoked"
  Start-Sleep -Seconds 6
}

$text = '我解一维热传导方程，初值是 e 的负 x 次方，结果里出现了误差函数，这正常吗？'

"MEDFILL6 START at $(Get-Date -Format HH:mm:ss)"
$typed = $false
for ($a = 1; $a -le 4; $a++) {
  $grp = Find-InputByPlaceholder
  if ($null -eq $grp) { "  attempt $a : no_input"; Start-Sleep -Seconds 3; continue }
  [void](WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json'))
  Start-Sleep -Milliseconds 800
  [void](WA @('ui','send-keys',$text,'--target',$grp,'--verbatim','--via','send-input','-a',"$T",'--on','sandbox','--json'))
  Start-Sleep -Milliseconds 2500
  $ph = WA @('ui','search','请输入您的问题','-a',"$T",'--on','sandbox','--json')
  if ($null -ne $ph -and $ph.matchCount -eq 0) { $typed = $true; break }
  [void](WA @('ui','send-keys','ctrl+a','-a',"$T",'--on','sandbox','--via','send-input','--json'))
  Start-Sleep -Milliseconds 300
  [void](WA @('ui','send-keys','delete','-a',"$T",'--on','sandbox','--via','send-input','--json'))
  Start-Sleep -Milliseconds 600
}
if (-not $typed) { "M18 TEXT_NOT_LANDED after 4 attempts"; exit 1 }

$before = Count-Answers
$b = WA @('ui','search','发送','-a',"$T",'--on','sandbox','--json','--type','Button')
if ($null -eq $b -or $b.matchCount -lt 1) { "NO_SEND_BTN"; exit 1 }
[void](WA @('ui','invoke',$b.matches[0].selector,'-a',"$T",'--on','sandbox','--json'))

$w = 0
while ($w -lt 120) { Start-Sleep -Seconds 3; $w += 3; if ($before -ge 0 -and (Count-Answers) -gt $before) { break } }

$dump = Join-Path $base ("M18-{0}.json" -f (Get-Date -Format 'HHmmss'))
& winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $dump -Encoding UTF8
"M18 ok waited=${w}s saved=$dump"
