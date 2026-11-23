# 历史脚本归档（archive）

> 这里是从原项目 `evidence/` 搬过来的**一次性**脚本。路径已参数化（`$root` 由 `$PSScriptRoot` 上溯两级），
> 但**未逐一验证可运行性**。日常复现不需要它们。

---

## 为什么保留

它们是过程证据。删掉之后，"当时为什么改方案"就只剩结论、没有痕迹。典型两例：

| 脚本 | 保留价值 |
| --- | --- |
| `sensitivity.cjs` | 记录了 M=23 时的最坏情形敏感性检验，是"放弃跨组比较、改用组内按题型分解"的直接依据 |
| `analyze_high.cjs` | 记录了 H 组专项检查逻辑（含文献真实性的启发式修正），但只扫 `high2/`，覆盖 14/30 |

## 为什么不列入主线

| 脚本族 | 原因 |
| --- | --- |
| `run-medfill*.ps1`（7 个） | 补采专用，前提已消失（M 组已 30/30） |
| `run-high-priority / high-watch2 / recovery / final7 / batch1` | 抢采、救援、批处理变体，环境相关 |
| `run-rounds30b–e / rounds40` | Z 组重试与分批，最终由 `run-rounds30.ps1` 代表 |
| `aggregate*.cjs` 旧版 | 已被 `aggregate_all.cjs` 取代 |

## 已知问题

| 脚本 | 问题 |
| --- | --- |
| `run-medfill3.ps1` | 第 39 行 `)$reset = 'not_found'` 缺换行，**语法错误，无法运行**。实际生效的是 `run-medfill3b.ps1`。见 `docs/03-一致性核对.md` §七 |

其余脚本均通过 PowerShell 7 语法解析（`Parser::ParseFile` 零错误），但**语法通过 ≠ 可运行**：它们依赖当时的窗口句柄 `$T`、页面 DOM 状态与会话。

## 如果要复用

1. 读 `../runbooks/README.md` 的运行前提；
2. 重取窗口句柄填入 `$T`；
3. 对照脚本里的题库与实际页面，确认输入框定位类名仍然有效（`common-rich-input text-div textarea`）。
