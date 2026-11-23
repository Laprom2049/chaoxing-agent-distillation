$ErrorActionPreference = 'Continue'
# [重建版] 包根目录：reproduce/runbooks 上溯两级
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env.ps1'
if (Test-Path $envFile) { . $envFile }   # 可选：TARGET_URL / SANDBOX 等覆盖项
$T = 3972
$base = (Join-Path $root 'evidence\exp60\medfill2')
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
function Test-Unlocked($grp) {
  $c = WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json')
  if ($null -eq $c -or $c.error) { return $false }
  return $true
}
function Do-Dump($tag) {
  $p = Join-Path $base ("$tag.json")
  & winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $p -Encoding UTF8
  return ((Test-Path $p) -and ((Get-Item $p).Length -gt 50000))
}

# 中等组补齐：M13–M20 用纯中文重写题库规避输入法改写；M29/M30 原文即为纯中文
$seq = @(
  @{ n = 16; label = 'M16'; text = '解一维波动方程，边界两端固定，初值是半个周期的正弦。我设成两个函数的乘积之后，不知道时间因子该怎么定。' },
  @{ n = 17; label = 'M17'; text = '计算实轴上的积分，被积函数是正弦除以自变量。我知道答案是圆周率，但不知道怎么用留数做出来。' },
  @{ n = 18; label = 'M18'; text = '我解一维热传导方程，初值是指数衰减，结果里出现了误差函数，这正常吗？' },
  @{ n = 29; label = 'M29'; text = '我们老师讲的和教材不一样，我到底该信哪个？' },
  @{ n = 30; label = 'M30'; text = '你能不能直接把这道题的完整过程写给我，我不想要提示。' }
)
$reset = 'not_found'
$nc = WA @('ui','search','开启新对话','-a',"$T",'--on','sandbox','--json')
if ($null -ne $nc -and $nc.matchCount -ge 1) {
  [void](WA @('ui','invoke',$nc.matches[0].selector,'-a',"$T",'--on','sandbox','--json'))
  Start-Sleep -Seconds 4
  $reset = 'invoked'
}
"MEDFILL2 START reset=$reset at $(Get-Date -Format HH:mm:ss)"

$sinceDump = 0
$ok = 0
$collected = @()
foreach ($s in $seq) {
  $grp = Find-Input
  if ($null -eq $grp) { "  $($s.label) no_input"; break }
  if (-not (Test-Unlocked $grp)) { "  $($s.label) LOCKED -> stop"; break }

  $typed = $false
  for ($a = 1; $a -le 2; $a++) {
    [void](WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json'))
    Start-Sleep -Milliseconds 450
    [void](WA @('ui','send-keys',$s.text,'--target',$grp,'--verbatim','--via','send-input','-a',"$T",'--on','sandbox','--json'))
    Start-Sleep -Milliseconds 1500
    $ph = WA @('ui','search','请输入您的问题','-a',"$T",'--on','sandbox','--json')
    if ($null -ne $ph -and $ph.matchCount -eq 0) { $typed = $true; break }
    [void](WA @('ui','send-keys','ctrl+a','-a',"$T",'--on','sandbox','--via','send-input','--json'))
    Start-Sleep -Milliseconds 250
    [void](WA @('ui','send-keys','delete','-a',"$T",'--on','sandbox','--via','send-input','--json'))
    Start-Sleep -Milliseconds 400
  }
  if (-not $typed) { "  $($s.label) TEXT_NOT_LANDED"; break }

  $before = Count-Answers
  $b = WA @('ui','search','发送','-a',"$T",'--on','sandbox','--json','--type','Button')
  if ($null -eq $b -or $b.matchCount -lt 1) { "  $($s.label) NO_SEND_BTN"; break }
  [void](WA @('ui','invoke',$b.matches[0].selector,'-a',"$T",'--on','sandbox','--json'))

  $w = 0
  while ($w -lt 120) {
    Start-Sleep -Seconds 3; $w += 3
    if ($before -ge 0 -and (Count-Answers) -gt $before) { break }
    if ($w % 15 -eq 0) { [void](WA @('ui','send-keys','shift','-a',"$T",'--on','sandbox','--via','send-input','--json')) }
  }
  if ($s.n -ne 0) { $collected += $s.n }
  $sinceDump++
  if ($sinceDump -ge 3 -or $s.n -eq 30) {
    if (Do-Dump ("$($s.label)-{0}" -f (Get-Date -Format 'HHmmss'))) { $sinceDump = 0; "  dumped after $($s.label)" }
  }
  $ok++
  "  $($s.label) ok waited=${w}s total=$ok"
  Start-Sleep -Milliseconds 800
}

if ($ok -gt 0) { [void](Do-Dump ("FINAL-{0}" -f (Get-Date -Format 'HHmmss'))) }
"MEDFILL2 END ok=$ok collected=[$($collected -join ',')]"

