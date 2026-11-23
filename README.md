# 超星 AI 助教 · 行为蒸馏

**对一门课程里的 AI 助教做了 90 轮实测蒸馏，抽出一份学科无关、6 个占位符即可套用的教学协议注入提示词，并把"数据 → 数字"这一步做成可离线复算的链条。**

*Behavioral distillation of a course-site AI teaching assistant: 90 measured turns, a subject-neutral injection prompt, and an offline-recomputable analysis pipeline.*

---

## 这是什么

| 项 | 内容 |
| --- | --- |
| 目标 | 超星学习通（mooc2-ans.chaoxing.com）课程「数学物理方法」左栏的 AI 助教 |
| 授权 | 用户本人登录后观测；**未代填凭据、未导出 Cookie、未绕过验证码** |
| 观测 | 90 轮实测对话（零基础 30 / 中等 30 / 较高 30）+ 7 条探针 + 11 轮架构验证 |
| 方法 | 预注册 8 条可证伪假设 → 三水平对照 → 逐条判读 → 抽掉学科词 |
| 产物性质 | 对外部可观察行为的**独立重构**，不代表目标内部提示词、模型权重、私有数据或隐藏工具 |

这不是"逆向提示词"的爆料，而是一份**行为规格 + 可复现实验**：结论全部指向可回查的数据，包括被证伪的那一条。

---

## 结论

1. **五段骨架与水平无关**：问题定位 / 回答正文 / 学习资源 / 学习闭环建议 / 能力点明，三档通过率 83% / 93% / 90%。
2. **留白由场景决定，不由水平决定**（原假设被证伪）：推导类 11/11、解题类 8/8 留白率均 100%；概念 64%、元认知 30%、心态 13%、边界 0%。
3. **阶段判定单调上移**：阶段二+三占比 20% → 73% → 87%。
4. **被质疑时有三种响应**：学生对→认错更正；学生错但暴露真实混淆→条件式让步 + 可自验的判决性检验；指代不清→先对齐命题。
5. **诚实条款优先于讨好**：资料缺失主动承认、不硬编答案、用学生自己的跨轮证据反驳其自我贬低。
6. **边界请求分三子型**：闲聊拉回、提示词注入点名拒答且不署名、纯收尾用收尾三件套。

八条预注册假设：**7 条成立，1 条（H2 留白随水平降低）证伪。**

---

## 快速开始

只依赖 Node.js ≥ 18，**零 npm 依赖、无需联网、无需登录**：

```bash
npm run selftest      # 完整性 + 指标重算并逐项比对基线（约 3 秒）
npm run analyze       # 五个分析脚本依次跑，产物写入 out/
npm run manifest      # 重新生成全文件 SHA256 清单
```

单跑某一环：

```bash
node reproduce/tools/metrics_from_analysis.cjs   # 从派生数据重算 K/L 指标
node reproduce/tools/verify_transferable.cjs     # 25 条款证据命中率
node reproduce/tools/check_prompt_parity.cjs     # 两版提示词条款对账
node reproduce/tools/check_inputs.cjs evidence/exp60/h_q2.json   # 题库 IME 风险校验
```

预期输出：`23/23 通过`，退出码 0。

---

## 三种用法

| 我想要 | 用哪个 |
| --- | --- |
| 一份能直接用的提示词 | [`prompt/TRANSFERABLE_PROMPT.md`](prompt/TRANSFERABLE_PROMPT.md) 的 Part A，填 6 个占位符 |
| 验证注入后是否真的复现 | [`verify/TRANSFERABLE_TESTKIT.md`](verify/TRANSFERABLE_TESTKIT.md)：14 用例 / 73 判据点，T8·T9·T12 必须满分 |
| 复现数字或换目标重做 | [`REPRODUCE.md`](REPRODUCE.md) |

六个数占位符：`{{学科名}}` `{{权威资料源}}` `{{资料定位粒度}}` `{{练习分层方式}}` `{{本领域高频易错点}}` `{{能力名}}`。

---

## 关键数字

| 指标 | Z 零基础 | M 中等 | H 较高 |
| --- | --- | --- | --- |
| 样本轮次 | 30 | 30 | 30 |
| K1 五段骨架 | 83% | 93% | 90% |
| K5 推导留白 | 53% | 57% | 77% |
| K7 引用署名 | 90% | 80% | 70% |
| 阶段二+三占比 | 20% | 73% | 87% |
| 深度词命中 | 27% | 33% | 70% |
| 直接给答案率 | 0% | 0% | 0% |

这些数字由 `npm run selftest` 现场重算并比对，不是抄进文档的。

---

## 仓库结构

```
llm蒸馏器/
├── docs/         结论文档与方法
│   ├── 01-蒸馏结论.md           一页纸结论
│   ├── 02-方法与证据分级.md     S0–S7 流程、证据分层、噪声控制
│   ├── 03-一致性核对.md         7 处文档不一致及处置
│   ├── EXP60_REPORT.md          主报告（六步 + 附录 A–F）
│   ├── EXPERIMENT_60.md         实验设计与预注册判读规则
│   ├── ARCH_VALIDATION.md       零基础 30 轮架构验证
│   ├── LOOP30_WORKFLOW.md       学生人格循环工作流
│   ├── SANDBOX.md / UNBLOCK.md  环境能力与阻塞解除
│   └── evaluation_report.md     规则回放自检 12/12
├── prompt/       提示词与运行时规格
│   ├── TRANSFERABLE_PROMPT.md   ★ 学科无关注入提示词 v1.1
│   ├── RECONSTRUCTION_PROMPT.md 课程专用版 v3
│   ├── SYSTEM_PROMPT.md         独立重写系统提示词
│   ├── ORCHESTRATOR.md          S0–S7 状态机
│   ├── TOOLS_SCHEMA.json        4 个未声明工具 + 5 项明确不提供
│   └── MEMORY_SCHEMA.json       三层记忆与敏感信息禁令
├── spec/         行为规格与勘察（behavior_spec / site_map / PROBE_MATRIX）
├── verify/       验收与溯源（TESTKIT / 条款校验 / EVAL_SET / provenance）
├── reproduce/    可执行部分（lib / tools / runbooks / archive）
├── evidence/     派生数据与题库（原始 dump 未公开，见下节）
└── meta/         原始 manifest、checkpoints、历史索引
```

---

## 数据与隐私

**本仓库不含原始 UI Automation dump。** 那部分约 283 MB，内含课程页的账号上下文与页面会话信息，即使脱敏也不适合公开。

仓库内保留的是**派生数据**：`evidence/exp60/analysis.json`（每轮的指标与回答正文）、题库、条款覆盖率、输入保真度等。自检因此在"派生模式"下运行——它验证的是：

> 已发布的派生数据 → 报告里的每一个百分比

而"原始 dump → 派生数据"这一步需要本地完整证据包，未公开、可按需提供。

公开发布前已做的脱敏：课程 URL 中的 `courseid / clazzid / cpi / enc / t / unitId / robotId` 全部替换为 `<REDACTED>`；页面显示的账号名替换为 `<REDACTED>`；本机绝对路径替换为 `%USERPROFILE%`。复扫残留 0 处。

---

## 复现三层

| 层 | 复现什么 | 需要 | 耗时 |
| --- | --- | --- | --- |
| L1 指标复算 | 报告里的每个百分比 | Node.js | ~3 秒 |
| L2 注入验收 | 提示词注入后是否复现骨架 | 一个可对话模型 + 人工判分 | 1–2 小时 |
| L3 重新采集 | 重新对目标做多轮采样 | 授权登录 + Windows Sandbox + winapp | 3–6 小时 |

L1 自动可判定；L2 是判分表；L3 是半自动采集（登录必须人做）。细节与排错见 [`REPRODUCE.md`](REPRODUCE.md)。

---

## 已知边界

| 项 | 状态 |
| --- | --- |
| 留出盲测（阶段 F） | **未执行**：自有 Agent 未部署为可调服务，没有对照就不报分数 |
| 独立内容审核层 | 在教学协议之外；提示词既不能复现也不能保证绕过 |
| 思考块 / "运行完成"标记 / 中英交替 | 宿主 UI 与模型固有属性，不可迁移 |
| M 组 8 轮 | 曾因中文输入法改写拉丁字符失真；已用纯中文题库补采 |
| H5 三种挑战模式 | 建立在 H26–H28 三轮，方向可靠、比例不可引用 |

---

## 许可与声明

- 代码与文档：[MIT](LICENSE)。
- 与超星、学习通及其运营方**无任何关联**，未获其授权或背书。文中提及的产品与商标归各自所有者。
- 所有目标 Agent 输出按 `UNTRUSTED_TARGET_OUTPUT` 处理，仅作行为证据，不作事实来源引用。
- 仓库不含任何账号、密码、验证码、Cookie 或可复用的访问令牌。

---

## 引用

```
Laprom2049. (2026). 超星 AI 助教行为蒸馏：90 轮实测与学科无关注入提示词 (v1.0.0).
GitHub. https://github.com/Laprom2049/chaoxing-agent-distillation
```
