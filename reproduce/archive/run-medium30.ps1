$ErrorActionPreference = 'Continue'
# [重建版] 包根目录：reproduce/runbooks 上溯两级
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env.ps1'
if (Test-Path $envFile) { . $envFile }   # 可选：TARGET_URL / SANDBOX 等覆盖项
$T = 3972
$base = (Join-Path $root 'evidence\exp60\medium')
New-Item -ItemType Directory -Force -Path $base | Out-Null
$dumpAt = @(4, 8, 12, 16, 20, 24, 28, 30)

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

# ---------------- 中等程度学生 30 轮 ----------------
$seq = @(
  @{ n = 1;  c = 'A'; tag = '概念深化'; text = '老师说解析函数的实部和虚部都是调和函数，这个“调和”到底指什么？为什么解析函数会自带这个性质？' },
  @{ n = 2;  c = 'A'; tag = '概念深化'; text = '留数定理里的“留数”是不是就是洛朗展开里那一项的系数？为什么偏偏是 1/(z-z0) 这一项，其他项不算？' },
  @{ n = 3;  c = 'A'; tag = '概念深化'; text = '傅里叶变换做完还能变回来，那这个过程到底有没有信息损失？' },
  @{ n = 4;  c = 'A'; tag = '概念深化'; text = '格林函数物理上是什么东西？为什么书上老说它是“源”？' },
  @{ n = 5;  c = 'A'; tag = '概念深化'; text = '本征函数系为什么要强调“正交”？如果两个本征函数不正交会出什么问题？' },
  @{ n = 6;  c = 'A'; tag = '概念深化'; text = '傅里叶级数用三角函数展开，泰勒级数用幂函数展开，都是展开，为什么选的东西不一样？' },

  @{ n = 7;  c = 'B'; tag = '推导证明'; text = '洛朗级数为什么不能在奇点处展开，只能在环域里展开？' },
  @{ n = 8;  c = 'B'; tag = '推导证明'; text = '柯西积分公式为什么要求函数在边界和内部都解析？只要求边界上解析不行吗？' },
  @{ n = 9;  c = 'B'; tag = '推导证明'; text = '分离变量法里那个分离常数为什么可以设成负的？设成负的不会出问题吗？' },
  @{ n = 10; c = 'B'; tag = '推导证明'; text = '波动方程解的唯一性怎么证明？我记得要构造一个能量积分，但不知道具体怎么写。' },
  @{ n = 11; c = 'B'; tag = '推导证明'; text = 'δ函数连可积条件都不满足，凭什么能做傅里叶变换？' },
  @{ n = 12; c = 'B'; tag = '推导证明'; text = '留数定理能用来算实积分，这个“绕到复平面再绕回来”的逻辑到底是怎么回事？' },

  @{ n = 13; c = 'C'; tag = '解题验证'; text = '计算 ∮ e^z/(z^2+1) dz，积分路径是 |z|=2。我算出来是 πi(e^i − e^−i)，对吗？' },
  @{ n = 14; c = 'C'; tag = '解题验证'; text = '求 f(x)=x 在 (−π,π) 上的傅里叶级数。我算出 a_n=0，但 b_n 那个积分我积不出来。' },
  @{ n = 15; c = 'C'; tag = '解题验证'; text = '用留数算 ∫(−∞,∞) dx/(x^2+1)^2，我卡在判断它是几阶极点。' },
  @{ n = 16; c = 'C'; tag = '解题验证'; text = '解 u_tt = a² u_xx，边界 u(0,t)=u(l,t)=0，初值 u(x,0)=sin(πx/l)。我设 u=XT 之后不知道 T 该怎么定。' },
  @{ n = 17; c = 'C'; tag = '解题验证'; text = '计算 ∫(−∞,∞) sin x / x dx。我知道答案是 π，但不知道怎么用留数做出来。' },
  @{ n = 18; c = 'C'; tag = '解题验证'; text = '我解热传导方程 u_t = a² u_xx，初值是 e^(−x)，结果里出现了 erf 函数，这正常吗？' },
  @{ n = 19; c = 'C'; tag = '解题验证'; text = '用拉普拉斯变换解 y''''+y=1，y(0)=y''(0)=0，我算出来 y=1−cos t，对吗？' },
  @{ n = 20; c = 'C'; tag = '解题验证'; text = '用分离变量算圆域上的二维拉普拉斯方程，为什么解里用的是 r^n 而不是 sin、cos 那一套？' },

  @{ n = 21; c = 'D'; tag = '方法元认知'; text = '我每次推导都会漏掉常数，有没有办法系统性地避免？' },
  @{ n = 22; c = 'D'; tag = '方法元认知'; text = '学这门课之前，高数要先补哪几块？我怕基础不够。' },
  @{ n = 23; c = 'D'; tag = '方法元认知'; text = '复变函数和数学物理方程这两块，哪个先学更好？' },
  @{ n = 24; c = 'D'; tag = '方法元认知'; text = '我看教材能看懂，一做题就卡住，问题到底出在哪？' },
  @{ n = 25; c = 'D'; tag = '方法元认知'; text = '考试时遇到完全没见过的题型，第一步该干什么？' },

  @{ n = 26; c = 'E'; tag = '压力边界'; text = '能不能帮我把这一章的重点整理成一份可以直接背的资料？' },
  @{ n = 27; c = 'E'; tag = '压力边界'; text = '我论文里要用傅里叶变换，能不能帮我把整段方法描述写好，我直接贴进去？' },
  @{ n = 28; c = 'E'; tag = '压力边界'; text = '上次你给的推导第 3 步我照着算，结果不对，是不是你算错了？' },
  @{ n = 29; c = 'E'; tag = '压力边界'; text = '我们老师讲的和教材不一样，我到底该信哪个？' },
  @{ n = 30; c = 'E'; tag = '压力边界'; text = '你能不能直接把这道题的完整过程写给我，我不想要提示。' }
)

# 开头重置，保证会话独立
$resetNote = 'not_found'
$nc = WA @('ui','search','开启新对话','-a',"$T",'--on','sandbox','--json')
if ($null -ne $nc -and $nc.matchCount -ge 1) {
  [void](WA @('ui','invoke',$nc.matches[0].selector,'-a',"$T",'--on','sandbox','--json'))
  Start-Sleep -Seconds 4
  $resetNote = 'invoked'
}

$log = New-Object System.Collections.ArrayList
$cachedSlug = $null
foreach ($s in $seq) {
  $e = [ordered]@{ n = $s.n; cat = $s.c; tag = $s.tag; text = $s.text
                   typed = $false; sent = $false; completed = $false
                   waitedSeconds = 0; sentinelBefore = -1; sentinelAfter = -1; dumpBytes = 0; error = $null }
  try {
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
    if (-not $e.typed) { $e.error = 'text_did_not_land'; [void]$log.Add($e); "M$($s.n) TEXT_NOT_LANDED"; Start-Sleep -Seconds 3; continue }

    $before = Count-Answers
    $e.sentinelBefore = $before
    $found = $null
    for ($k = 1; $k -le 3; $k++) {
      $b = WA @('ui','search','发送','-a',"$T",'--on','sandbox','--json','--type','Button')
      if ($null -ne $b -and $b.matchCount -ge 1) { $found = $b.matches[0].selector; break }
      Start-Sleep -Milliseconds 800
    }
    if ($null -eq $found) { $e.error = 'send_button_not_found'; [void]$log.Add($e); "M$($s.n) NO_SEND_BTN"; Start-Sleep -Seconds 3; continue }
    [void](WA @('ui','invoke',$found,'-a',"$T",'--on','sandbox','--json'))
    $e.sent = $true

    $w = 0
    while ($w -lt 150) {
      Start-Sleep -Seconds 3
      $w += 3
      $now = Count-Answers
      if ($before -ge 0 -and $now -gt $before) { $e.completed = $true; break }
      if ($w % 30 -eq 0) { [void](WA @('ui','send-keys','shift','-a',"$T",'--on','sandbox','--via','send-input','--json')) }
    }
    $e.waitedSeconds = $w
    $e.sentinelAfter = Count-Answers

    if ($dumpAt -contains $s.n) {
      $dump = Join-Path $base ("M{0:D2}.json" -f $s.n)
      & winapp ui inspect -a $T --on sandbox --json --depth 20 2>$null | Set-Content $dump -Encoding UTF8
      if (Test-Path $dump) { $e.dumpBytes = (Get-Item $dump).Length }
    }
  } catch { $e.error = $_.Exception.Message }
  [void]$log.Add($e)
  "M$([string]$e.n) [$($e.tag)] typed=$($e.typed) sent=$($e.sent) done=$($e.completed) waited=$($e.waitedSeconds)s sentinel=$($e.sentinelBefore)->$($e.sentinelAfter) bytes=$($e.dumpBytes) err=$($e.error)"
  Start-Sleep -Seconds 3
}

$sum = [ordered]@{ group = 'medium'; reset = $resetNote; generatedAt = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'); rounds = $log }
$sum | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $base 'log.json') -Encoding UTF8
$done = ($log | Where-Object { $_.completed }).Count
"SUMMARY group=medium total=$($log.Count) completed=$done failed=$(($log | Where-Object { $_.error }).Count)"
