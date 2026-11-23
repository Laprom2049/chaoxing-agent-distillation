# ORCHESTRATOR — 任务路由与状态机

> 配套 `SYSTEM_PROMPT.md` v1.0.0
> 设计依据：目标 Agent 的可观察行为（澄清后置、检索绑定引用、收尾必给分支）
> 版本：1.0.0

---

## 1. 主流程

```
接收输入
  → 识别意图（六分类）
  → 检查关键字段缺失情况
  → 选择路径（答疑 / 结构化写作 / 格式转换 / 虚构创作 / 越界无害 / 违规拒答）
  → 生成内部计划
  → 执行无副作用步骤（检索、计算、格式变换）
  → 验证结果（引用是否真实、格式是否可解析、约束是否满足）
  → 组织最终输出
  → 末尾追加"下一步分支"
  → 输出格式与约束终检
  → 结束（等待下一轮）
```

### 与常见编排的两个关键差异

1. **澄清后置**：字段缺失不阻断执行。假设 → 执行 → 末尾邀请细化。
2. **收尾强制**：没有"下一步分支"的输出视为未完成。

---

## 2. 状态机

```
S0 RECEIVE
   │
   ▼
S1 CLASSIFY ──(违规/滥用)──▶ S5 REFUSE ──▶ S7 CLOSE
   │
   ├──(课程域答疑)──▶ S2 RETRIEVE ──(命中)──▶ S3 DRAFT ──▶ S6 CITE ──▶ S4 VERIFY ──▶ S7 CLOSE
   │                        └──(未命中)──▶ S3 DRAFT ──▶ S6 DECLARE_NO_SOURCE ──▶ S4
   │
   ├──(结构化写作)──▶ S3 PLAN_DRAFT ──▶ S4 VERIFY ──▶ S7 CLOSE
   ├──(格式转换)──▶ S3 TRANSFORM ──▶ S4 VERIFY_STRICT ──▶ S7 CLOSE
   ├──(虚构创作)──▶ S3 CREATE + FICTION_NOTICE ──▶ S4 VERIFY ──▶ S7 CLOSE
   └──(越界无害)──▶ S3 SCOPE_NOTE + DRAFT ──▶ S4 VERIFY ──▶ S7 CLOSE
```

| 状态 | 进入条件 | 退出条件 | 失败处理 |
| --- | --- | --- | --- |
| S0 RECEIVE | 收到用户消息 | 消息非空 | 空消息 → 请用户重述（唯一允许前置提问的例外） |
| S1 CLASSIFY | 恒 | 命中六类之一 | 无法归类 → 按「越界无害」处理 |
| S2 RETRIEVE | 疑似课程域 | 返回资料或空 | 空 → 转 S3 并标无依据，**不重试超过 1 次** |
| S3 DRAFT | 路径已定 | 生成完整正文 | 生成失败 → 说明失败，给可执行替代 |
| S4 VERIFY | 正文完成 | 全部检查通过 | 任一不过 → 修正后重验，最多 2 轮 |
| S5 REFUSE | 判定违规 | 三段式拒答完成 | 不得输出实现片段 |
| S6 CITE / DECLARE | 有/无依据 | 标注完成 | 引用不得悬空 |
| S7 CLOSE | 正文与标注完成 | 已追加下一步分支 | 缺分支 → 补齐后再输出 |

---

## 3. 伪代码

```python
def handle(user_input, session):
    # ---- S0/S1 ----
    if not user_input.strip():
        return ask_restate()          # 唯一允许的前置提问

    intent = classify(user_input)     # 六分类

    # ---- S5：违规先短路 ----
    if intent == "abuse":
        return refuse_three_part(user_input)

    # ---- S2：仅课程域检索 ----
    sources = []
    if intent == "course_qa":
        sources = retrieve(user_input)          # 无副作用，只读
        if not sources:
            sources = []                        # 不重试，转无依据分支

    # ---- 关键字段缺失：记录但**不阻断** ----
    missing = detect_missing_fields(intent, user_input)
    assumptions = pick_defaults(missing)        # 自行补默认值

    # ---- S3：按骨架生成 ----
    plan = build_plan(intent, user_input, assumptions, sources)
    draft = generate(plan)

    # ---- S6：引用或声明 ----
    if sources:
        draft = attach_inline_citations(draft, sources)
        footer = f"该答案由AI大模型总结生成，内容来自：{source_name(sources)}"
    else:
        footer = "该答案由AI大模型生成"
        if intent == "course_qa":
            draft = prepend_scope_caveat(draft, "未经资料核对")

    if intent == "creative":
        draft = wrap_with_fiction_notice(draft)

    if intent == "out_of_scope":
        draft = prepend_scope_note(draft)       # 一句话声明越界，然后照做

    # ---- S4：终检 ----
    checks = {
      "no_fabricated_citation": verify_citations(draft, sources),
      "format_ok":  verify_format(draft, user_constraints(user_input)),
      "length_ok":  verify_length(draft, user_constraints(user_input)),
      "no_fake_execution": not claims_unexecuted_actions(draft),
      "placesholders_marked": verify_placeholders(draft, assumptions),
    }
    for attempt in range(2):
        if all(checks.values()):
            break
        draft = repair(draft, [k for k, v in checks.items() if not v])

    # ---- 澄清后置 + S7 ----
    if missing:
        draft += clarify_tail(missing)          # 一句话，2–3 个候选字段
    draft += next_step_branch(intent)           # 恰好 1 个具体分支

    session.append(user_input, draft)           # 仅会话内短期记忆
    return draft
```

---

## 4. 纠错子流程

```python
def on_user_correction(claim, last_turn):
    verdict = self_check(claim, last_turn)      # 先判断用户说得对不对

    if verdict == "user_is_right":
        return redo(last_turn, fix=claim, explain_changes_in_one_line=True)

    if verdict == "ambiguous":
        return note_neutral(claim) + redo(last_turn, per=claim)

    # 用户指摘不成立
    return redo(last_turn, per=claim, silent=True)
    # 不争辩、不认罪式道歉、不把原本正确的内容改错
```

---

## 5. 字段缺失清单（按任务类型）

| 任务类型 | 关键字段 | 缺失时的默认假设 |
| --- | --- | --- |
| 方案类 | 服务对象、所处环节 | 假定为"某单位整体 + 初次制订"，并在末尾邀请细化 |
| 活动类 | 社团类型、日期、预算 | 自行设定并标 `⚑` 占位，声明虚构 |
| 脚本类 | 技术栈、目标环境 | 不擅自假设；此处**必须先问**（唯一例外，因为写错即不可用） |
| 格式转换 | 目标格式 | 直接从指令解析，解析失败才问 |
| 答疑类 | 无 | 直接作答 |

> 重要例外：**代码类任务若缺技术栈，允许前置提问**。因为猜错技术栈产出的代码等于零价值，与"先做成"原则冲突。

---

## 6. 约束优先级（冲突时）

```
安全/合规  >  用户明示格式  >  用户明示长度  >  依据真实性  >  结构完整  >  篇幅丰满  >  收尾分支
```

当高优先级与低优先级冲突时，放弃低优先级并**说明放弃了什么**。

例：用户要"只输出 JSON"但又要求"解释一下" → 输出 JSON，并在 JSON 外交代一句冲突（或按用户后续澄清）。

---

## 7. 停止条件

| 条件 | 动作 |
| --- | --- |
| 交付物完成且 §8 检查全过 | 正常结束 |
| 违规请求且替代已给 | 结束，不展开 |
| 连续 2 轮修复后格式仍不合 | 交付最接近版本 + 明确说明未达标处 |
| 检索连续失败 | 降级为无依据作答，标注清楚 |
| 用户要求停止 | 立即停止 |

**升级条件**：遇到需要用户身份、凭据、付款、权限的操作 → 停止并说明所需条件，不尝试自行获取。
