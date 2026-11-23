# 重建说明（CHANGELOG）

> 源目录：`%USERPROFILE%\Desktop\gongzuoqu\distilled_agent`（只读，未改动）
> 目标目录：`%USERPROFILE%\Desktop\llm蒸馏器`
> 重建日期：2026-11-23

---

## 一、为什么要重建

原目录内容完整、结论扎实，但**换一台机器就跑不起来**，有三个具体障碍：

| 障碍 | 具体表现 | 后果 |
| --- | --- | --- |
| 路径硬编码 | 9 个分析脚本、23 个采集脚本里写死 `D:\…\Desktop\工作区\distilled_agent\…` | 原目录改名（工作区 → gongzuoqu）后**全部失效**，实测 `ENOENT` |
| 中途产物与原始数据混放 | `analysis.json` 既被脚本写入又被其它脚本读取 | 无法判断某个数字是原始观测还是派生物 |
| 文档状态不同步 | 3 份文档停留在阶段性快照（H 0/30、M 23/30、v0.9） | 读者无法判断哪个是终局 |

重建目标是：**让"数据 → 数字"这一步可以在一台干净机器上用一条命令重跑，并自动比对基线。**

---

## 二、做了什么

### 2.1 结构重排（内容全部保留）

| 新位置 | 内容 | 来源 |
| --- | --- | --- |
| `docs/` | 报告、实验设计、架构验证、工作流、沙箱说明 | 原根目录 7 份 md |
| `prompt/` | 提示词与运行时规格（6 份） | 原根目录 |
| `spec/` | 行为规格、页面地图、探针矩阵 | 原根目录 |
| `verify/` | 验收套件、条款校验、评测集、溯源日志 | 原根目录 |
| `meta/` | 原始 manifest、旧索引、checkpoints、一次性改造脚本 | 原根目录 |
| `evidence/` | 原始证据，**整目录原样拷贝** | 原 `evidence/` |
| `reproduce/` | 路径无关的脚本 + 运行器 + 自检 | 原 `evidence/*.cjs / *.ps1` |

原有 187 个文件，`evidence/` 一个不少；无删除、无内容重写。

### 2.2 路径改造（核心修复）

- 新增 `reproduce/lib/env.cjs`，作为**唯一路径来源**：`ROOT / evidence / out / prompt` 全部由 `__dirname` 推导，可用环境变量覆盖。
- 9 个分析脚本：删除硬编码 `ROOT`/`EV`，改为 `require('../lib/env.cjs')`；**逻辑一行未改**。
- 23 个 PowerShell 采集脚本：绝对路径前缀替换为 `(Join-Path $root 'evidence…')`，`$root` 由 `$PSScriptRoot` 上溯两级得到。
- 写操作全部改到 `out/`，`evidence/` 变成**只读区**。

### 2.3 新增文件

| 文件 | 作用 |
| --- | --- |
| `reproduce/selftest.cjs` | 离线自检：完整性 + **现场重算 20 项指标并逐项比对基线**（23 项断言） |
| `reproduce/run_all.cjs` | 按依赖顺序跑完 5 个分析脚本 |
| `reproduce/gen_manifest.cjs` | 生成全文件 SHA256 清单 |
| `package.json` | `npm run selftest / analyze / manifest / clean` |
| `manifest.json` | 187 → 现清单，可校验文件未被改动 |
| `README.md` / `REPRODUCE.md` | 入口与跨机复现手册 |
| `docs/01-蒸馏结论.md` | 一页纸结论（新写，只汇总不新增结论） |
| `docs/02-方法与证据分级.md` | S0–S7 流程、证据分层、三条噪声控制 |
| `docs/03-一致性核对.md` | 7 处文档/数据不一致及处置 |
| `reproduce/runbooks/README.md` | 采集运行器的使用前提与纪律 |

### 2.4 对原文的改动（仅 2 处，均可追溯）

| 文件 | 改动 | 理由 |
| --- | --- | --- |
| `prompt/TRANSFERABLE_PROMPT.md` | 头部 `v0.9` → `v1.1`，依据行 53 → 90 样本，状态行改写 | 正文已含 v1.1 全部规则，头部是笔误；不改会误导读者为草稿 |
| `meta/README_INDEX.md` | 头部加"历史快照，勿作现状依据"提示 | 该文件正文表格与文件头自相矛盾（H 0/30 vs 30/30） |

其余文档**一字未改**，包括被证伪的假设、失真的数据、语法错误的脚本。

### 2.5 移入 `archive/` 的（19 个 ps1 + 2 个 cjs）

历史一次性脚本：`run-medfill*`、`run-high-priority`、`run-recovery`、`run-batch1`、`run-final7` 等，以及 `sensitivity.cjs`、`analyze_high.cjs`。

保留原因：它们是过程证据。特别是 `sensitivity.cjs` 记录了"为什么放弃跨组比较"。
不列入主线原因：前提已失效（缺失轮已补齐）或覆盖不足（只扫 high2），见 `docs/03-一致性核对.md` §四、§五。

`reproduce/archive/` 已做路径参数化，但**未逐一验证可运行性**——其中一个本来就有语法错误（§七）。

---

## 三、验证结果

```
node reproduce/selftest.cjs
→ 23/23 通过
```

关键比对项（全部与 `docs/EXP60_REPORT.md` 附录 F 一致）：

| 项 | 重算值 |
| --- | --- |
| 覆盖 | Z 30 / M 30 / H 30，无 missing |
| K1 | 83 / 93 / 90 |
| K5 | 53 / 57 / 77 |
| L1 阶段分布 | 19-6-0 / 6-16-6 / 1-19-7 |
| L2 留白 | 53 / 57 / 77 |
| L3 深度词 | 27 / 33 / 70 |
| L4 直接给答案 | 0 / 0 / 0 |
| 条款对账 | 28 条两边在场 |

---

## 四、没做什么

| 项 | 说明 |
| --- | --- |
| 未重跑采集 | 需要授权登录与沙箱交互，非本次任务范围 |
| 未修 `sensitivity.cjs` 逻辑 | 它是历史推理的证据，改了会丢失方法演进痕迹；已明确标注适用范围 |
| 未补做留出盲测（阶段 F） | 前提不变：自有 Agent 未部署为可调服务 |
| 未给 archive 脚本逐个做可用性验证 | 只做语法解析，其中 1 个已知失败 |
| 未压缩 evidence | 283 MB 原始 dump 全留，压缩会损害可回查性 |

---

## 五、如果只用一句话总结这次重建

**原来是一份"可以讲清楚"的成果，现在是一条"可以跑起来"的链条。**

---

## 六、公开发布准备（2026-11-23）

| 动作 | 说明 |
| --- | --- |
| 脱敏 | 课程 URL 的 `courseid/clazzid/cpi/enc/t/unitId/robotId` 全部替换 `<REDACTED>`；账号显示名 `<REDACTED>`；本机路径 → `%USERPROFILE%`。改动 114 个文件，复扫残留 0 |
| 瘦身 | 原始 UIA dump（283 MB）与截图不入库，改为 `.gitignore` 排除；仓库只留派生数据与题库 |
| 双模式自检 | 新增 `reproduce/tools/metrics_from_analysis.cjs`；`selftest` 无原始 dump 时自动切 `derived` 模式，同一套断言 |
| manifest 口径 | 改为只覆盖 `git ls-files`，保证克隆后校验不因未公开文件假失败 |
| 新增 | `LICENSE`（MIT）、`CITATION.cff`、`.gitattributes`、`.gitignore` |
| README 重写 | 增加英文摘要、快速开始、数据与隐私、许可与声明、引用格式 |

**声明**：仓库与超星/学习通运营方无关联；不含账号、密码、验证码、Cookie 或可复用令牌。
