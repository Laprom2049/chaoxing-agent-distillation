$ErrorActionPreference = 'Continue'
# [重建版] 包根目录：reproduce/runbooks 上溯两级
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env.ps1'
if (Test-Path $envFile) { . $envFile }   # 可选：TARGET_URL / SANDBOX 等覆盖项
$T = 3972
$base = (Join-Path $root 'evidence\exp60\medfill5')
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

# M18 换同义表述：探测意图不变（热传导方程 + 指数衰减初值 + 误差函数是否正常）
$text = '热传导方程的初值取指数衰减时，解里冒出误差函数，这个结果正常吗？'

"MEDFILL5 START at $(Get-Date -Format HH:mm:ss)"
$grp = Find-Input
if ($null -eq $grp) { "no_input"; exit 1 }

$typed = $false
for ($a = 1; $a -le 4; $a++) {
  [void](WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json'))
  Start-Sleep -Milliseconds 700
  [void](WA @('ui','send-keys',$text,'--target',$grp,'--verbatim','--via','send-input','-a',"$T",'--on','sandbox','--json'))
  Start-Sleep -Milliseconds 2200
  $ph = WA @('ui','search','请输入您的问题','-a',"$T",'--on','sandbox','--json')
  if ($null -ne $ph -and $ph.matchCount -eq 0) { $typed = $true; break }
  [void](WA @('ui','send-keys','ctrl+a','-a',"$T",'--on','sandbox','--via','send-input','--json'))
  Start-Sleep -Milliseconds 300
  [void](WA @('ui','send-keys','delete','-a',"$T",'--on','sandbox','--via','send-input','--json'))
  Start-Sleep -Milliseconds 500
  $grp = Find-Input
  if ($null -eq $grp) { break }
}
if (-not $typed) { "M18 TEXT_NOT_LANDED"; exit 1 }

$before = Count-Answers
$b = WA @('ui','search','发送','-a',"$T",'--on','sandbox','--json','--type','Button')
if ($null -eq $b -or $b.matchCount -lt 1) { "NO_SEND_BTN"; exit 1 }
[void](WA @('ui','invoke',$b.matches[0].selector,'-a',"$T",'--on','sandbox','--json'))

$w = 0
while ($w -lt 120) { Start-Sleep -Seconds 3; $w += 3; if ($before -ge 0 -and (Count-Answers) -gt $before) { break } }

$dump = Join-Path $base ("M18-{0}.json" -f (Get-Date -Format 'HHmmss'))
& winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $dump -Encoding UTF8
"M18 ok waited=${w}s"
