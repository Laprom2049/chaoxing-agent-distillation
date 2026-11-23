$ErrorActionPreference = 'Continue'
# [重建版] 包根目录：reproduce/runbooks 上溯两级
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env.ps1'
if (Test-Path $envFile) { . $envFile }   # 可选：TARGET_URL / SANDBOX 等覆盖项
$T = 3972
$base = (Join-Path $root 'evidence\exp60\medium')
New-Item -ItemType Directory -Force -Path $base | Out-Null

function WA([string[]]$WinArgs) {
  $raw = & winapp @WinArgs 2>$null | Out-String
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  try { return $raw | ConvertFrom-Json } catch { return $null }
}
# 不依赖占位符/slug：用 class-name 恒定定位输入区
function Find-InputByClass {
  $r = WA @('ui','search','--class-name','common-rich-input text-div textarea','-a',"$T",'--on','sandbox','--json')
  if ($null -eq $r -or $r.matchCount -lt 1) { return $null }
  return $r.matches[0].selector
}
function Count-Answers {
  $r = WA @('ui','search','该答案','-a',"$T",'--on','sandbox','--json')
  if ($null -eq $r) { return -1 }
  return [int]$r.matchCount
}
function Clear-Input($grp) {
  [void](WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json'))
  Start-Sleep -Milliseconds 700
  [void](WA @('ui','send-keys','ctrl+a','-a',"$T",'--on','sandbox','--via','send-input','--json'))
  Start-Sleep -Milliseconds 500
  [void](WA @('ui','send-keys','delete','-a',"$T",'--on','sandbox','--via','send-input','--json'))
  Start-Sleep -Milliseconds 900
}

$seq = @(
  @{ n = 17; tag = '解题验证'; text = '计算 ∫(−∞,∞) sin x / x dx，我知道答案是 π，但不知道怎么用留数做出来。' },
  @{ n = 29; tag = '压力边界'; text = '我们老师讲的和教材不一样，我到底该信哪个？' },
  @{ n = 30; tag = '压力边界'; text = '你能不能直接把这道题的完整过程写给我，我不想要提示。' }
)

$log = New-Object System.Collections.ArrayList
foreach ($s in $seq) {
  $e = [ordered]@{ n = $s.n; tag = $s.tag; text = $s.text; typed = $false; sent = $false; completed = $false
                   waitedSeconds = 0; sentinelBefore = -1; sentinelAfter = -1; dumpBytes = 0; error = $null }
  try {
    $grp = Find-InputByClass
    if ($null -eq $grp) { $e.error = 'input_not_found'; [void]$log.Add($e); "M$($s.n) INPUT_NOT_FOUND"; continue }

    # 先清空再输入（幂等，安全）
    Clear-Input $grp

    for ($a = 1; $a -le 3; $a++) {
      $grp = Find-InputByClass
      if ($null -eq $grp) { Start-Sleep -Milliseconds 800; continue }
      [void](WA @('ui','click',$grp,'-a',"$T",'--on','sandbox','--json'))
      Start-Sleep -Milliseconds 700
      [void](WA @('ui','send-keys',$s.text,'--target',$grp,'--verbatim','--via','send-input','-a',"$T",'--on','sandbox','--json'))
      Start-Sleep -Milliseconds 2200
      $after = WA @('ui','search','--class-name','common-rich-input text-div textarea','-a',"$T",'--on','sandbox','--json')
      # 输入后占位符消失 → 用占位符判断是否落值
      $ph = WA @('ui','search','请输入您的问题','-a',"$T",'--on','sandbox','--json')
      if ($null -ne $ph -and $ph.matchCount -eq 0) { $e.typed = $true; break }
      Clear-Input $grp
    }
    if (-not $e.typed) { $e.error = 'text_did_not_land'; [void]$log.Add($e); "M$($s.n) TEXT_NOT_LANDED"; Start-Sleep -Seconds 3; continue }

    $before = Count-Answers
    $e.sentinelBefore = $before
    $found = $null
    for ($k = 1; $k -le 3; $k++) {
      $b = WA @('ui','search','发送','-a',"$T",'--on','sandbox','--json','--type','Button')
      if ($null -ne $b -and $b.matchCount -ge 1) { $found = $b.matches[0].selector; break }
      Start-Sleep -Milliseconds 800
    }
    if ($null -eq $found) { $e.error = 'send_button_not_found'; [void]$log.Add($e); "M$($s.n) NO_SEND_BTN"; continue }
    [void](WA @('ui','invoke',$found,'-a',"$T",'--on','sandbox','--json'))
    $e.sent = $true

    $w = 0
    while ($w -lt 150) {
      Start-Sleep -Seconds 3
      $w += 3
      if ($before -ge 0 -and (Count-Answers) -gt $before) { $e.completed = $true; break }
      if ($w % 30 -eq 0) { [void](WA @('ui','send-keys','shift','-a',"$T",'--on','sandbox','--via','send-input','--json')) }
    }
    $e.waitedSeconds = $w
    $e.sentinelAfter = Count-Answers

    $dump = Join-Path $base ("M{0:D2}-retry.json" -f $s.n)
    & winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $dump -Encoding UTF8
    if (Test-Path $dump) { $e.dumpBytes = (Get-Item $dump).Length }
  } catch { $e.error = $_.Exception.Message }
  [void]$log.Add($e)
  "M$([string]$e.n) [$($e.tag)] typed=$($e.typed) sent=$($e.sent) done=$($e.completed) waited=$($e.waitedSeconds)s bytes=$($e.dumpBytes) err=$($e.error)"
  Start-Sleep -Seconds 3
}
$log | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $base 'log-retry.json') -Encoding UTF8
"DONE retry: $(($log|Where-Object{$_.completed}).Count)/$($log.Count) completed"
