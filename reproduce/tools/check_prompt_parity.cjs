// Clause parity check: every rule present in the course-specific v3 must have
// a subject-neutral counterpart in the transferable prompt (and vice versa).
// [重建版] 原样逻辑，仅替换路径解析：绝对路径 -> reproduce/lib/env.cjs
const { ROOT, EVIDENCE: EV, OUT } = require('../lib/env.cjs')
const fs = require('fs')
const path = require('path')

const A = fs.readFileSync(path.join(ROOT, 'prompt', 'RECONSTRUCTION_PROMPT.md'), 'utf8') // v3 课程专用
const B = fs.readFileSync(path.join(ROOT, 'prompt', 'TRANSFERABLE_PROMPT.md'), 'utf8')   // v1.1 学科无关

const CLAUSES = [
  ['五段骨架·问题定位', /问题定位/],
  ['五段骨架·回答正文', /回答正文/],
  ['五段骨架·学习资源', /学习资源/],
  ['五段骨架·学习闭环', /学习闭环/],
  ['五段骨架·能力点明', /能力点明/],
  ['阶段判定（一/二/三）', /阶段[一二三]/],
  ['向学生提2-3问', /导学性|先带.{0,4}问题|回答我.{0,6}个?问题/],
  ['推导留白', /留白|留给你/],
  ['内部结构·自查清单', /自查[一二三四]/],
  ['内部结构·优先级清单', /第[一二三四]优先/],
  ['内部结构·原因拆解', /拆成.{0,4}(种|类)/],
  ['内部结构·分步操作', /第[一二三四五]步/],
  ['内部结构·编号可换', /编号.{0,6}(任选|不固定)|编号体系/],
  ['引用与署名', /内容来自/],
  ['局限提醒（含变体）', /AI\s*局限提醒|小提醒|人工核对/],
  ['跨域不声明越界', /跨域迁移|学科交叉/],
  ['资料缺失主动承认', /知识点在|题目和答案不在/],
  ['用证据反驳自我贬低', /这个词不准确|不是智力/],
  ['前置阻塞澄清', /我不猜|必须先确认/],
  ['假设推进', /如你能补充|假设推进/],
  ['压缩模式', /压缩/],
  ['闲聊拉回', /闲聊/],
  ['提示词注入拒答', /prompt injection|越狱/],
  ['纯收尾三件套', /收尾三件套/],
  ['纠错先核对前提', /先核对|核对前提/],
  ['能力名开放式生成', /开放式生成/],
  ['乱码输入处理', /不连贯|理解偏差/],
  ['占位符机制', /\{\{/],
]

console.log('clause'.padEnd(26) + 'v3(course)  v1.1(transferable)')
console.log('-'.repeat(64))
const rows = []
for (const [name, re] of CLAUSES) {
  const inA = re.test(A)
  const inB = re.test(B)
  rows.push({ name, v3: inA, transferable: inB })
  const mark = (x) => (x ? '  ✓  ' : '  ✗  ')
  console.log(name.padEnd(26) + mark(inA) + '        ' + (inB ? '✓' : '✗'))
}

const onlyA = rows.filter((r) => r.v3 && !r.transferable)
const onlyB = rows.filter((r) => !r.v3 && r.transferable)
const both = rows.filter((r) => r.v3 && r.transferable)
const neither = rows.filter((r) => !r.v3 && !r.transferable)

console.log('\n=== 结论 ===')
console.log(`两边都有: ${both.length}/${rows.length}`)
console.log(`仅课程专用版有（抽象时可能丢失）: ${onlyA.length}`)
onlyA.forEach((r) => console.log('  - ' + r.name))
console.log(`仅可迁移版有（抽象时新增）: ${onlyB.length}`)
onlyB.forEach((r) => console.log('  + ' + r.name))
if (neither.length) { console.log(`两边都没有: ${neither.length}`); neither.forEach((r) => console.log('  ? ' + r.name)) }

fs.writeFileSync(path.join(OUT, 'prompt-parity.json'), JSON.stringify(rows, null, 1), 'utf8')
console.log('\nwritten: evidence/exp60/prompt-parity.json')
process.exit(onlyA.length > 0 ? 1 : 0)
