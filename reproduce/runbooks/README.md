# 采集运行器说明

> 这里是可复用的采集脚本。`../archive/` 里是历史一次性脚本（补采、抢采、调试），
> 保留但不保证可用——其中至少一个（`run-medfill3.ps1`）有语法错误，见 `docs/03-一致性核对.md` §七。

---

## 运行前提

1. **PowerShell 7（`pwsh`）**，不是 Windows PowerShell 5.1。脚本是 UTF-8 无 BOM，5.1 会按 ANSI 解码导致解析失败。
2. `winapp` CLI 在 PATH 中，Windows Sandbox 功能已启用。
3. 沙箱已启动、Edge 已打开目标课程页，**且你本人已登录**。
4. 屏保已关闭（设置 → 个性化 → 锁屏界面 → 屏幕保护程序 → 选「无」）。

---

## 必须先改的一处

运行器里有：

```powershell
$T = 3972
```

`$T` 是上一次环境的窗口句柄，**换机器必然失效**。重新取：

```powershell
winapp ui search --class-name 'common-rich-input text-div textarea' --on sandbox --json
```

把返回的 app handle 填入 `$T`。

---

## 四个运行器

| 文件 | 组 | 用途 |
| --- | --- | --- |
| `run-rounds30.ps1` | Z | 零基础 30 轮 |
| `run-medium-retry.ps1` | M | 中等 30 轮（补采版） |
| `run-high30v2.ps1` | H | 较高 30 轮，**纯中文题库**，含锁屏早退与每轮存盘 |
| `run-high-watch.ps1` | H | 守候式：每 20 秒探测解锁，检测到即抢采 |

```powershell
pwsh -NoProfile -File .\run-high30v2.ps1
```

断点续采：先建包根 `.env.ps1`：

```powershell
# <包根>\.env.ps1
$env:DSH_START_AT = 16     # 从第 16 轮开始
```

运行器会自动 `.` 加载它。

---

## 采集纪律（三条，都是踩坑换来的）

1. **回读校验**：中文输入法会把拉丁字符合成汉字（实测含拉丁输入完整率仅 11%）。发完 `get-value` 比对实际送达文本；或只用纯中文题库。
2. **锁屏早退**：`ui click` 返回 `no_interactive_desktop` 立即存盘退出。锁屏期间 UIA 读取仍可用，可抢救已完成的轮次。
3. **每轮即存**：会话重置会冲掉未落盘数据。

---

## 产物位置

| 运行器 | 输出 |
| --- | --- |
| `run-rounds30.ps1` | `evidence/rounds30*/` |
| `run-medium-retry.ps1` | `evidence/exp60/medfill*/` 或 `medium/` |
| `run-high30v2.ps1` | `evidence/exp60/high2/`、`high3/` |

采完回到包根：

```powershell
node reproduce/run_all.cjs
node reproduce/selftest.cjs
```
