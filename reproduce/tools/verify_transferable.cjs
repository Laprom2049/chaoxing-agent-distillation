// Verify TRANSFERABLE_PROMPT clauses against the 53 collected samples.
// For each clause: find a matching signature and report hit rate per group.
// Also flag clauses with zero evidence (over-specification).
// [重建版] 原样逻辑，仅替换路径解析：绝对路径 -> reproduce/lib/env.cjs
const { ROOT, EVIDENCE: EV, OUT } = require('../lib/env.cjs')
const fs = require('fs')
const path = require('path')


function loadZ() {
  const pOut = path.join(OUT, 'rounds-all-extracted.json')
  const p = fs.existsSync(pOut) ? pOut : path.join(EV, 'rounds-all-extracted.json')
  if (!fs.existsSync(p)) return []
  return JSON.parse(fs.readFileSync(p, 'utf8'))
    .filter((r) => r.status === 'ok')
    .map((r) => ({ group: 'Z', n: r.round,
                   flat: (r.answerFull || '').replace(/\s+/g, ''),
                   thought: (r.thoughtHead || '') }))
}

function loadM() {
  const pOut = path.join(OUT, 'analysis.json')
  const p = fs.existsSync(pOut) ? pOut : path.join(EV, 'exp60', 'analysis.json')
  if (!fs.existsSync(p)) return []
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  return (j.M || []).filter((r) => r.status === 'ok')
    .map((r) => ({ group: 'M', n: r.n,
                   flat: (r.answerFull || '').replace(/\s+/g, ''),
                   thought: r.thoughtHead || '' }))
}

const Z = loadZ()
const M = loadM()
const ALL = [...Z, ...M]

// 条款探针：id -> {clause, re, scope}
const CLAUSES = [
  ['P01', '问题定位段', /问题定位/],
  ['P02', '场景判定（属于…类/场景）', /属于.{0,12}(场景|类|问题)|这属于/],
  ['P03', '学习阶段判定', /阶段[一二三]/],
  ['P04', '向学生提 2–3 个问题', /请你(先)?回答我|先带.{0,4}问题|带着.{0,4}问题|顺带回答我|回答我[一二三四五]?个?问题|回答三个问题/],
  ['P05', '五段齐全（至少 4 段）', null],
  ['P06', '第2段内部结构标记', /第[一二三四五]层|自查[一二三四]|第[一二三四]优先|拆成[一二三四五](种|类)|[①②③④⑤]/],
  ['P07', '推导留白', /留白|留给你|你自己先|请你亲自|请你先自己|自己走完/],
  ['P08', '学习资源精确到章节', /学习资源/],
  ['P09', '学习闭环三段', /学习闭环建议/],
  ['P10', '能力点明收尾', /锻炼了你的.{2,6}力/],
  ['P11', 'AI 局限提醒', /AI\s*结论需人工验证|AI\s*局限性|AI\s*局限提醒|需人工验证|请以教材为准|请回到教材|人工核对|AI\s*的局限/],
  ['P12', '来源署名', /该答案由AI大模型/],
  ['P13', '跨域不声明越界', /学科交叉/],
  ['P14', '资料缺失主动承认', /资料(里|中)?(并没有|没有|也没有)|题目和答案不在|知识点在/],
  ['P15', '用证据反驳自我贬低', /这个词不准确|不是智力问题|几乎从不是|真正.{0,6}零基础是/],
  ['P16', '补充内容附加标注', /教材未明写|属补充理解|请以教材为准|请自行核实/],
  ['P17', '前置阻塞澄清', /必须先确认|我不猜|请你先(告诉我|确认)|先把.{0,12}(抄|告诉)我/],
  ['P18', '假设推进 + 末尾邀请', /如你(能|可以)补充|如您能|我可以进一步细化|告诉我.{0,10}(就|可以)/],
  ['P19', '纠错先核对前提', /先核对|要先核对|有个细节|请先回去确认|你写的?是/],
  ['P20', '压缩模式（行内标签）', /学习资源[:：]|能力点明[:：]|⚠️\s*AI\s*局限提醒[:：]/],
  ['P21', '闲聊拉回 + 重申协议', /按课程学习协议|按学习协议|想聊点什么|回到课程/],
  ['P22', '拒答不署名 + 点名手法', /越狱|prompt\s*injection|指令覆盖|忽略.{0,6}指令/],
  ['P23', '收尾三件套', /开始动作|今天就做一件事|顺手给你/],
  ['P24', '学科史小注', /格林|华罗庚|欧拉|世纪|数学家|学科史/],
  ['P25', '解题类自查清单', /自查[一二三四]/],
]

function hasFive(r) {
  const s = r.flat
  return ['问题定位', '回答正文', '学习资源', '学习闭环建议', '能力点明'].filter((k) => s.includes(k)).length >= 4
}

console.log(`samples: Z=${Z.length} M=${M.length} total=${ALL.length}\n`)
console.log('=== 条款证据覆盖 ===')
const rows = []
for (const [id, clause, re] of CLAUSES) {
  const test = re ? (r) => re.test(r.flat) : hasFive
  const zHit = Z.filter(test).length
  const mHit = M.filter(test).length
  const tot = zHit + mHit
  rows.push({ id, clause, z: zHit, m: mHit, tot, rate: (tot / ALL.length * 100).toFixed(0) + '%' })
  console.log(`${id} ${clause.padEnd(24)} Z:${String(zHit).padStart(2)}/${Z.length}  M:${String(mHit).padStart(2)}/${M.length}  合计 ${String(tot).padStart(2)} (${(tot / ALL.length * 100).toFixed(0)}%)`)
}

const zero = rows.filter((r) => r.tot === 0)
console.log('\n=== 零证据条款（过度规定，需降级或标注为设计推断） ===')
if (zero.length === 0) console.log('无')
else zero.forEach((r) => console.log(`- ${r.id} ${r.clause}`))

const weak = rows.filter((r) => r.tot > 0 && r.tot / ALL.length < 0.05)
console.log('\n=== 弱证据条款（<5% 命中，按个案处理） ===')
if (weak.length === 0) console.log('无')
else weak.forEach((r) => console.log(`- ${r.id} ${r.clause}  命中 ${r.tot}/${ALL.length}`))

console.log('\n=== 强证据条款（>=50%） ===')
rows.filter((r) => r.tot / ALL.length >= 0.5).forEach((r) => console.log(`- ${r.id} ${r.clause}  ${r.rate}`))

// 反向：统计高频结构标记，检查是否都有对应条款
const marks = ['问题定位', '回答正文', '学习资源', '学习闭环建议', '能力点明', '先带三个问题', '自查一', '第一层', '①']
console.log('\n=== 高频结构标记出现率（反向检查是否遗漏） ===')
for (const m of marks) {
  const z = Z.filter((r) => r.flat.includes(m)).length
  const mm = M.filter((r) => r.flat.includes(m)).length
  console.log(`  ${m.padEnd(10)} Z:${z}  M:${mm}`)
}

fs.writeFileSync(path.join(OUT, 'prompt-coverage.json'),
  JSON.stringify({ samples: { Z: Z.length, M: M.length }, rows }, null, 1), 'utf8')
console.log('\nwritten: evidence/exp60/prompt-coverage.json')
