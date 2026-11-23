// Robustness & sensitivity analysis on the 53 collected samples.
// (a) Worst-case sensitivity: could the 7 missing M rounds flip H1/H2/H3?
// (b) Degraded-input robustness: how did the target handle IME-garbled questions?
// [重建版] 原样逻辑，仅替换路径解析：绝对路径 -> reproduce/lib/env.cjs
const { ROOT, EVIDENCE: EV, OUT } = require('../lib/env.cjs')
const fs = require('fs')
const path = require('path')

const A = JSON.parse(fs.readFileSync(path.join(EV, 'exp60', 'analysis.json'), 'utf8'))

const Z = A.Z || []
const M = (A.M || []).filter((r) => r.status === 'ok')

const M_MISSING = [13, 16, 17, 18, 19, 29, 30]
const M_MISSING_N = M_MISSING.length

const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : 'n/a')

// ---------- (a) sensitivity ----------
const zStageUp = Z.filter((r) => /阶段二|阶段三/.test(r.stageLevel)).length
const mStageUp = M.filter((r) => /阶段二|阶段三/.test(r.stageLevel)).length
const zBlank = Z.filter((r) => r.blank).length
const mBlank = M.filter((r) => r.blank).length
const zDeep = Z.filter((r) => (r.deepWords || 0) >= 1).length
const mDeep = M.filter((r) => (r.deepWords || 0) >= 1).length

console.log('=== 现有数据 ===')
console.log(`Z(n=${Z.length})  阶段二+三 ${zStageUp} (${pct(zStageUp, Z.length)})  留白 ${zBlank} (${pct(zBlank, Z.length)})  深度词 ${zDeep} (${pct(zDeep, Z.length)})`)
console.log(`M(n=${M.length})  阶段二+三 ${mStageUp} (${pct(mStageUp, M.length)})  留白 ${mBlank} (${pct(mBlank, M.length)})  深度词 ${mDeep} (${pct(mDeep, M.length)})`)
console.log(`M 缺 ${M_MISSING_N} 轮: ${M_MISSING.join(',')}`)

console.log('\n=== 最坏情形敏感性（把缺失轮全部设为相反结果）===')
function band(name, base, missing, denomFull, cmpLabel, direction) {
  const low = base / denomFull
  const high = (base + missing) / denomFull
  return { name, low, high, cmpLabel, direction }
}
const n0 = Z.length
const bands = [
  band('H1 阶段上移率', mStageUp, M_MISSING_N, M.length + M_MISSING_N, `Z=${pct(zStageUp, n0)}`, 'higher'),
  band('H2 留白率', mBlank, M_MISSING_N, M.length + M_MISSING_N, `Z=${pct(zBlank, n0)}`, 'lower'),
  band('H3 深度词率', mDeep, M_MISSING_N, M.length + M_MISSING_N, `Z=${pct(zDeep, n0)}`, 'higher'),
]
const zRef = { 'H1 阶段上移率': zStageUp / n0, 'H2 留白率': zBlank / n0, 'H3 深度词率': zDeep / n0 }
for (const b of bands) {
  const ref = zRef[b.name]
  const lo = (b.low * 100).toFixed(1)
  const hi = (b.high * 100).toFixed(1)
  let verdict
  if (b.direction === 'higher') {
    // 结论“M > Z”是否稳健：最坏情形（下限）是否仍 > Z
    verdict = b.low > ref ? '稳健（最坏情形下仍成立）' : '不稳健（最坏情形下会翻转）'
  } else {
    // 结论“M >= Z（H2 被证伪）”是否稳健：最坏情形（下限）是否仍 >= Z
    verdict = b.low >= ref ? '稳健（最坏情形下仍成立）' : '不稳健（最坏情形下会翻转）'
  }
  console.log(`${b.name}: M 区间 [${lo}%, ${hi}%]  vs ${b.cmpLabel}  →  ${verdict}`)
}

console.log('\n=== 结论 ===')
console.log('H1/H3 的区间下限仍高于 Z，方向稳健。')
console.log('H2「留白随水平降低被证伪」：若缺失 7 轮全部无留白，M 率降至下限，')
console.log('   可能低于 Z 的 53%，届时 H2 反而成立 —— 因此该结论**不稳健**。')

// ---------- (b) degraded input robustness ----------
console.log('\n=== 输入被改写轮次的健壮性分析（M13–M20）===')
const degraded = [13, 14, 15, 16, 17, 18, 19, 20]
const rows = []
for (const n of degraded) {
  const r = M.find((x) => x.n === n)
  if (!r) { rows.push({ n, status: 'missing' }); continue }
  const f = r.answerFull || ''
  const flat = f.replace(/\s+/g, '')
  rows.push({
    n,
    noticed: /混乱|识别错误|表述不清|语句不完整|有错字|似乎是.{0,6}误/.test(flat),
    askedClarify: /请(你)?(先)?(把|确认|补充)|能否(再)?说明|题干原文/.test(flat),
    keptSkeleton: (r.sectionCount || 0) >= 4,
    gaveFramework: /自查[一二三四]|判定框架|在什么条件下/.test(flat),
    length: r.chars,
  })
}
let noticed = 0, asked = 0, kept = 0
for (const r of rows) {
  if (r.status === 'missing') { console.log(`M${r.n} MISSING`); continue }
  if (r.noticed) noticed++
  if (r.askedClarify) asked++
  if (r.keptSkeleton) kept++
  console.log(`M${String(r.n).padStart(2)} 察觉异常=${r.noticed ? 'Y' : 'N'} 请求澄清=${r.askedClarify ? 'Y' : 'N'} 保留骨架=${r.keptSkeleton ? 'Y' : 'N'} 给框架=${r.gaveFramework ? 'Y' : 'N'} 长度=${r.length}`)
}
const n = rows.filter((r) => r.status !== 'missing').length
console.log(`\n汇总: 察觉 ${noticed}/${n}  请求澄清 ${asked}/${n}  保留五段骨架 ${kept}/${n}`)
console.log('解读: 即使输入被 IME 改写导致语义断裂，目标仍以较高比例保留了回答骨架，')
console.log('      并有一定比例主动指出异常 —— 这构成"降级输入下的健壮性"证据，')
console.log('      但不能当作"解题辅导模式"的行为证据。')

fs.writeFileSync(path.join(OUT, 'sensitivity.json'), JSON.stringify({ bands, degraded: rows }, null, 1), 'utf8')
console.log('\nwritten: evidence/exp60/sensitivity.json')

// ---------- (c) 留白是否由「题型」而非「水平」决定 ----------
console.log('\n=== 留白率按题型分解（检验"场景决定"而非"水平决定"）===')
function byCat(rows, label) {
  const cats = {}
  for (const r of rows) {
    const c = r.cat || r.group || '?'
    ;(cats[c] ||= []).push(r)
  }
  console.log(`\n[${label}]`)
  for (const c of Object.keys(cats).sort()) {
    const arr = cats[c]
    const b = arr.filter((r) => r.blank).length
    console.log(`  类 ${c}: n=${arr.length}  留白 ${b} (${(b / arr.length * 100).toFixed(0)}%)`)
  }
}
byCat(Z.map((r) => ({ cat: r.cat, blank: r.blank })), 'Z 零基础')
byCat(M.map((r) => ({ cat: r.cat, blank: r.blank })), 'M 中等')

// 合并两组按题型
const all = [...Z.map((r) => ({ cat: r.cat, blank: r.blank })), ...M.map((r) => ({ cat: r.cat, blank: r.blank }))]
const merged = {}
for (const r of all) (merged[r.cat] ||= []).push(r.blank)
console.log('\n[Z+M 合并]')
for (const c of Object.keys(merged).sort()) {
  const arr = merged[c]
  const b = arr.filter(Boolean).length
  console.log(`  类 ${c}: n=${arr.length}  留白 ${b} (${(b / arr.length * 100).toFixed(0)}%)`)
}
console.log('\n解读：若留白率随题型显著分化、而在同一题型内跨组差异小，')
console.log('      则"留白由场景决定"成立，且不受缺失轮次的方向性影响。')
