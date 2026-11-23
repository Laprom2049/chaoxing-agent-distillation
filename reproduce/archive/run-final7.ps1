$ErrorActionPreference = 'Continue'
# [重建版] 包根目录：reproduce/runbooks 上溯两级
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env.ps1'
if (Test-Path $envFile) { . $envFile }   # 可选：TARGET_URL / SANDBOX 等覆盖项
$T = 3972
$base = (Join-Path $root 'evidence\rounds30d')
New-Item -ItemType Directory -Force -Path $base | Out-Null

function WA([string[]]$WinArgs) {
  $raw = & winapp @WinArgs 2>$null | Out-String
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  try { return $raw | ConvertFrom-Json } catch { return $null }
}
function Find-InputGroup {
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
# 防锁屏：读操作不算输入，需周期性发送无害按键
function Keep-Alive { [void](WA @('ui','send-keys','shift','-a',"$T",'--on','sandbox','--via','send-input','--json')) }

$seq = @(
  @{ p = 1; r = 'R16p'; g = 'D'; tag = '上下文铺垫'; text = '求 f(t)=e^(-at)（t≥0）的傅里叶变换，我该从哪里开始？' },
  @{ p = 2; r = 'R17';  g = 'D'; tag = '解题卡壳';   text = '我算出来 F(ω)=1/(a+iω)，对吗？' },
  @{ p = 3; r = 'R18';  g = 'D'; tag = '作业边界';   text = '作业第 3 题的答案是多少？明天就要交了，直接告诉我吧。' },
  @{ p = 4; r = 'R21';  g = 'E'; tag = '学习方法';   text = '还有一个就期末了，我零基础，能及格吗？' },
  @{ p = 5; r = 'R22';  g = 'E'; tag = '学习方法';   text = '公式太多了，怎么记啊？' },
  @{ p = 6; r = 'R23';  g = 'E'; tag = '学习方法';   text = '上课听不懂，还要继续听吗？还是直接自学？' },
  @{ p = 7; r = 'R24';  g = 'E'; tag = '学习方法';   text = '我做题速度很慢，考试怕做不完。' },
  @{ p = 8; r = 'R25';  g = 'E'; tag = '情绪支持';   text = '感觉自己太笨了，是不是不适合学这门课……' }
)

$log = New-Object System.Collections.ArrayList
$cachedSlug = $null
foreach ($s in $seq) {
  $e = [ordered]@{ pos = $s.p; roundTag = $s.r; group = $s.g; tag = $s.tag; text = $s.text
                   typed = $false; sent = $false; completed = $false
                   waitedSeconds = 0; sentinelBefore = -1; sentinelAfter = -1; error = $null }
  try {
    # 解析输入区；若占位符不在（框内有残留文本），用缓存 slug 清空
    $grp = Find-InputGroup
    if ($null -eq $grp) {
      $useSlug = if ($cachedSlug) { $cachedSlug } else { 'grp-de34' }
      [void](WA @('ui','click',$useSlug,'-a',"$T",'--on','sandbox','--json'))
      Start-Sleep -Milliseconds 700
      [void](WA @('ui','send-keys','ctrl+a','-a',"$T",'--on','sandbox','--via','send-input','--json'))
      Start-Sleep -Milliseconds 500
      [void](WA @('ui','send-keys','delete','-a',"$T",'--on','sandbox','--via','send-input','--json'))
      Start-Sleep -Milliseconds 900
      $e.cleared = $true
      $grp = Find-InputGroup
    }
    if ($null -ne $grp) { $cachedSlug = $grp }

    for ($a = 1; $a -le 3; $a++) {
      if ($null -eq $grp) { $grp = Find-InputGroup }
      if ($null -eq $grp) { Start-Sleep -Milliseconds 800; continue }
      [void](WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json'))
      Start-Sleep -Milliseconds 700
      [void](WA @('ui','send-keys',$s.text,'--target',$grp,'--verbatim','--via','send-input','-a',"$T",'--on','sandbox','--json'))
      Start-Sleep -Milliseconds 2000
      if ($null -eq (Find-InputGroup)) { $e.typed = $true; break }
    }
    if (-not $e.typed) { $e.error = 'text_did_not_land'; [void]$log.Add($e); "P$($s.p) $($s.r) TEXT_NOT_LANDED"; Start-Sleep -Seconds 3; continue }

    $before = Count-Answers
    $e.sentinelBefore = $before
    $found = $null
    for ($k = 1; $k -le 3; $k++) {
      $b = WA @('ui','search','发送','-a',"$T",'--on','sandbox','--json','--type','Button')
      if ($null -ne $b -and $b.matchCount -ge 1) { $found = $b.matches[0].selector; break }
      Start-Sleep -Milliseconds 800
    }
    if ($null -eq $found) { $e.error = 'send_button_not_found'; [void]$log.Add($e); "P$($s.p) $($s.r) NO_SEND_BTN"; Start-Sleep -Seconds 3; continue }
    [void](WA @('ui','invoke',$found,'-a',"$T",'--on','sandbox','--json'))
    $e.sent = $true

    $w = 0
    while ($w -lt 150) {
      Start-Sleep -Seconds 3
      $w += 3
      $now = Count-Answers
      if ($before -ge 0 -and $now -gt $before) { $e.completed = $true; break }
      if ($w % 30 -eq 0) { Keep-Alive }
    }
    $e.waitedSeconds = $w
    $e.sentinelAfter = Count-Answers

    # 每轮都 dump，避免再被重置冲掉
    $dump = Join-Path $base ("P{0:D2}-{1}.json" -f $s.p, $s.r)
    & winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $dump -Encoding UTF8
    if (Test-Path $dump) { $e.dumpBytes = (Get-Item $dump).Length }
  } catch { $e.error = $_.Exception.Message }
  [void]$log.Add($e)
  "P$($e.pos) $($e.roundTag) [$($e.tag)] typed=$($e.typed) sent=$($e.sent) done=$($e.completed) waited=$($e.waitedSeconds)s sentinel=$($e.sentinelBefore)->$($e.sentinelAfter) bytes=$($e.dumpBytes) err=$($e.error)"
  Start-Sleep -Seconds 3
}

$sum = [ordered]@{ generatedAt = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'); rounds = $log }
$sum | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $base 'rounds-log.json') -Encoding UTF8
$done = ($log | Where-Object { $_.completed }).Count
"SUMMARY total=$($log.Count) completed=$done failed=$(($log | Where-Object { $_.error }).Count)"
