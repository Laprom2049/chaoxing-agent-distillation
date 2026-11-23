# 复现手册

> 目标：换一台机器、换一个人，能判断"这份结论是否可信"，并能在需要时重做一遍。
> 三层复现彼此独立，**L1 不需要联网、不需要登录、不需要目标站点仍然存在**。

---

## 〇、三层复现

| 层 | 复现什么 | 需要什么 | 耗时 | 命令 |
| --- | --- | --- | --- | --- |
| **L1 指标复算** | 从原始 dump 重算出报告里的每一个百分比 | Node.js | ~30 秒 | `node reproduce/selftest.cjs` |
| **L2 注入验收** | 提示词注入任意 Agent 后是否复现教学骨架 | 一个可对话的模型 + 人工判分 | 1–2 小时 | 见 §三 |
| **L3 重新采集** | 重新对目标 Agent 做多轮采样 | 授权登录 + Windows Sandbox + winapp | 3–6 小时 | 见 §四 |

只有 L1 是**自动、可判定的**。L2 是判分表，L3 是半自动采集（登录必须人做）。

---

## 一、依赖清单

### 1.1 L1 必需（只此一项）

| 依赖 | 版本 | 检查命令 | 说明 |
| --- | --- | --- | --- |
| Node.js | ≥ 18（实测 24.14.0） | `node -v` | **无任何 npm 依赖**，不需要 `npm install` |

### 1.2 L3 额外需要

| 依赖 | 版本（本次实测） | 检查命令 | 说明 |
| --- | --- | --- | --- |
| PowerShell | 7.x（`pwsh`） | `pwsh -v` | **不能用 Windows PowerShell 5.1**：脚本是 UTF-8 无 BOM，5.1 会按 ANSI 解码，中文与引号解析全崩 |
| winapp CLI | 随 DSH 提供 | `winapp --version` | UI Automation 驱动沙箱内 Edge |
| Windows Sandbox | 功能已启用 | `Get-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM` | 隔离环境 |
| Microsoft Edge | 任意近期版 | — | 沙箱内浏览器 |
| 屏幕保护 | 必须关闭 | 设置 → 个性化 → 锁屏界面 → 屏幕保护程序 → 选「无」 | 屏保锁屏会让交互桌面失效，见 §五 |

### 1.3 一次性的环境自检

```powershell
node -v
pwsh -v
winapp --version
Get-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM | Select State
```

四项都正常再往下走。

---

## 二、L1：指标复算（先做这一步）

```powershell
cd "%USERPROFILE%\Desktop\llm蒸馏器"
node reproduce/selftest.cjs
```

**预期**：末行 `23/23 通过`，退出码 0。它做四件事：

1. 必需文件齐全（15 项）
2. 全部 JSON 可解析（106 个文件）
3. `reproduce/` 下脚本无残留旧绝对路径
4. **现场重算** `evidence/` 原始 dump，把 K1–K8、L1、L2、L3、L4 共 20 项指标与报告终值逐项比对

比对不过会打印 `期望 X，实得 Y`。这不是"文件缺了"，而是**数据或分析逻辑变了**，必须查明后再下结论。

想跳过 283 MB 的哈希校验（约 2 秒）：

```powershell
node reproduce/selftest.cjs --no-hash
```

### 2.1 单独跑某一环

```powershell
node reproduce/run_all.cjs                    # 五个分析脚本依次跑，产物写入 out/
node reproduce/tools/analyze60.cjs            # 只跑三组指标
node reproduce/tools/verify_transferable.cjs  # 只跑 25 条款命中率
node reproduce/tools/check_prompt_parity.cjs  # 只跑两版提示词对账
node reproduce/tools/check_inputs.cjs evidence/exp60/h_q2.json   # 题库 IME 风险校验
```

### 2.2 重算产物在哪

全部写到 `out/`，`evidence/` 只读。删掉 `out/` 重跑即可回到干净状态。

> ⚠️ `evidence/` 里仍保留着**原始版本的脚本**（`evidence/*.cjs`、`evidence/*.ps1`），路径写死在旧目录下，**已经不能直接运行**。
> 那些文件只作历史证据保留；要跑脚本请一律用 `reproduce/tools/` 与 `reproduce/runbooks/` 里的版本。

### 2.3 完整性校验

`manifest.json` 记录每个文件的字节数与 SHA256。文件被改动、截断或丢失时，`selftest` 会报 `改动 xxx` / `缺失 xxx`。
更新内容后重新生成：

```powershell
node reproduce/gen_manifest.cjs
```

---

## 三、L2：注入验收

1. 取 [`prompt/TRANSFERABLE_PROMPT.md`](prompt/TRANSFERABLE_PROMPT.md) 的 **Part A**，整段作为 system prompt 注入被测 Agent。
2. 填 6 个占位符（Part B 对照表）。例：`{{学科名}}`=C 语言程序设计，`{{权威资料源}}`=C11 标准 + 课程讲义，……
3. 按 [`verify/TRANSFERABLE_TESTKIT.md`](verify/TRANSFERABLE_TESTKIT.md) 顺序发 14 条输入，**每类用新会话**（标注"同会话"的除外）。
4. 逐条勾判据。判分口径：每条的复选框全中才算该条满分。

**通过线**：≥12 条满分，且 T8 / T9 / T12 必须满分。

**不要用同一学科复用旧结论**：换学科后，留白位置会从"推导步骤"平移到"最小复现"或"实验步骤"，这是设计预期，不是失败。

---

## 四、L3：重新采集

> 这一段的前提是**你本人拥有该课程的访问授权**。Agent 不代填账号、不代过验证码、不导出 Cookie。

### 4.1 前置：确认目标上确实有对话式 Agent

```powershell
winapp target snapshot sandbox --json
```

先看 `host.ready`、`supportsInteractiveDesktop`。然后在沙箱内打开课程页，**人工登录**，再确认左栏「AI 助教」能打开对话框。
不要靠 URL 猜——`/mooc2-ans/mycourse/stu` 本身是课程页，不是对话框。

### 4.2 取窗口句柄（每次环境都不同，必须重取）

运行器里的 `$T = 3972` 是**上一次环境的窗口句柄**，换机器必然失效。

```powershell
winapp ui search --class-name 'common-rich-input text-div textarea' --on sandbox --json
```

把返回的 app handle 填进运行器的 `$T`，或先创建 `.env.ps1`（运行器会自动加载）：

```powershell
# 包根目录\.env.ps1
$env:DSH_START_AT = 1        # 从第几轮开始（断点续采）
```

### 4.3 三组运行器

| 运行器 | 组 | 画像 | 题库 |
| --- | --- | --- | --- |
| `reproduce/runbooks/run-rounds30.ps1` | Z | 零基础，只会说"我不懂" | 内置 30 轮 |
| `reproduce/runbooks/run-medium-retry.ps1` | M | 中等，带具体卡点与错误尝试 | 内置 |
| `reproduce/runbooks/run-high30v2.ps1` | H | 较高，追问本质/反例，会质疑 | 纯中文 30 题（已过 IME 校验） |
| `reproduce/runbooks/run-high-watch.ps1` | H | 守候式采集：每 20 秒探测解锁，解锁即抢采 | 同 H |

```powershell
pwsh -NoProfile -File reproduce\runbooks\run-high30v2.ps1
```

产物写入 `evidence/exp60/high2|high3/`。采完重跑 L1，指标应回到 §二 的基线。

### 4.4 三条必须遵守的采集纪律

1. **回读校验输入**：中文输入法会把拉丁字符合成汉字。本次实测"M 组含拉丁字符输入完整率仅 11%"。发完先 `get-value` 比对实际送达文本，或只用纯中文题库（`check_inputs.cjs` 前置校验）。
2. **锁屏早退**：`ui click` 返回 `no_interactive_desktop` 就是锁屏。立即存盘退出，不要空等；UIA 读取在锁屏下仍可用。
3. **每轮即存**：会话重置会冲掉未落盘数据。本次因"每 4 轮存一次"丢过轮次。

### 4.5 采完之后的处理链

```powershell
node reproduce/tools/aggregate_all.cjs   # Z 组：dump -> rounds-all-extracted.json
node reproduce/run_all.cjs               # 全量分析
node reproduce/selftest.cjs              # 与基线比对（数据变了就会报差异，这是预期）
```

---

## 五、排错表

| 症状 | 根因 | 处置 |
| --- | --- | --- |
| `Unexpected token '-a'`（PowerShell 5.1 解析 ps1） | 脚本 UTF-8 无 BOM，5.1 按 ANSI 解码 | 改用 `pwsh`（PowerShell 7） |
| `no_interactive_desktop` | 宿主会话锁屏/屏保 | 关掉屏保与"恢复时显示登录屏幕"；或锁屏期只做读取 |
| 输入框有字但没发出去 | ProseMirror 不支持 `set-value`；闲置后 `inputReady=false` | 先 `click` 唤醒，再 `send-keys --verbatim --via send-input`，然后 `get-value` 校验 |
| `ui inspect` 拿不到滚动区外的正文 | `--hide-offscreen` 过滤掉了 | 去掉该参数 |
| 送达文本被改写（拉丁字符变汉字） | 中文输入法合成 | 用纯中文题库；或先回读校验 |
| Node 报 `Cannot find module '../lib/env.cjs'` | 脚本被移出 `reproduce/tools/` | 保持目录结构，或改 `require` 相对路径 |
| `selftest` 报 `改动 xxx` | 文件被编辑过 | 确认是有意修改后重跑 `gen_manifest.cjs` |

---

## 六、换一个目标重做

把本包当模板时，按顺序替换 8 处：

| # | 位置 | 换什么 |
| --- | --- | --- |
| 1 | `spec/site_map.json` | 目标页面地图与入口 |
| 2 | `spec/PROBE_MATRIX.yaml` | 探针计划（按新目标的能力面重写） |
| 3 | `spec/behavior_spec.yaml` | 行为规则与来源探针 |
| 4 | `prompt/SYSTEM_PROMPT.md` | 系统提示词（可从 `behavior_spec` 重写） |
| 5 | `reproduce/runbooks/*.ps1` | 输入框定位、发送方式、dump 方式 |
| 6 | `reproduce/tools/analyze60.cjs` 里的 `M_Q` / `H_Q` | 三组题库 |
| 7 | `reproduce/selftest.cjs` 的 `EXPECT` | 新基线（**先跑一次留基线，再冻结**） |
| 8 | `README.md` §二 | 结论 |

**顺序不能颠倒**：先勘察、后采样；先冻结基线、再做断言。否则"可复现"退化成"可自证"。

---

## 七、复现完成判据

- [ ] `node reproduce/selftest.cjs` 输出 `23/23 通过`
- [ ] `out/analysis.json` 中 Z/M/H 各 30 轮，无 `status: missing`
- [ ] L4 直接给答案率三组均为 0%
- [ ] `check_prompt_parity` 输出 28 条两边在场
- [ ] 能指出报告里任意一个百分比由哪个脚本、哪份 dump 算出

最后一条最重要：**能追到源头，才算复现**。

---

## 八、公开仓库与本地完整包的区别

仓库里的 `evidence/` 只含**派生数据**（每轮指标与回答正文、题库、覆盖率），不含原始 UI Automation dump。
自检因此有两种模式，自动切换：

| 模式 | 触发条件 | 重算来源 |
| --- | --- | --- |
| `raw` | `evidence/exp60/{medium,high2,high3}/` 任一存在 | 原始 dump → `analyze60.cjs` |
| `derived` | 上述目录不存在 | 已发布 `analysis.json` → `metrics_from_analysis.cjs` |

强制指定（用于验证公开仓库的形态）：

```powershell
$env:DISTILL_MODE = "derived"; node reproduce/selftest.cjs
```

两种模式跑的是**同一套断言**，因此"公开仓库能过自检"不等于"原始数据没问题"——
它只证明：已发布的派生数据能推出报告里的数字。原始 dump 那一步需要本地完整证据包。
