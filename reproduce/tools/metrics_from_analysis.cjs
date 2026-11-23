// 派生数据模式：公开仓库不含原始 UIA dump（含账号上下文），
// 因此从已发布的 evidence/exp60/analysis.json 重算同一批指标。
// 输出行格式与 tools/analyze60.cjs 完全一致，便于 selftest 复用同一套断言。
// 用法：node reproduce/tools/metrics_from_analysis.cjs
const fs = require('fs')
const path = require('path')
const { EVIDENCE } = require('../lib/env.cjs')

const p = path.join(EVIDENCE, 'exp60', 'analysis.json')
if (!fs.existsSync(p)) {
  console.error('缺少 evidence/exp60/analysis.json，无法做派生重算。')
  process.exit(1)
}
const j = JSON.parse(fs.readFileSync(p, 'utf8'))
const groups = { Z: j.Z || [], M: j.M || [], H: j.H || [] }
const KEYS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8']
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(0) + '%' : 'n/a')

console.log('=== 派生重算（来源 evidence/exp60/analysis.json，非原始 dump）===')
console.log('')
console.log('=== COVERAGE ===')
for (const g of ['Z', 'M', 'H']) {
  const a = groups[g]
  console.log(`${g}: ${a.length} rounds`)
  const miss = a.filter((r) => r.status !== 'ok').map((r) => `${g}${r.n}`)
  console.log(`${g} missing: ${miss.length ? miss.join(',') : ''}`)
}

console.log('')
console.log('=== K1-K8 pass rate by group ===')
for (const k of KEYS) {
  const row = ['Z', 'M', 'H'].map((g) => {
    const a = groups[g]
    const ok = a.filter((r) => r.checks && r.checks[k]).length
    return `${g}:${pct(ok, a.length)}`
  })
  console.log(`${k}  ${row.join('  ')}`)
}

console.log('')
console.log('=== L-indicators ===')
console.log('L1 阶段判定分布 (阶段一/二/三/none)')
for (const g of ['Z', 'M', 'H']) {
  const a = groups[g]
  const c = { 阶段一: 0, 阶段二: 0, 阶段三: 0, none: 0 }
  a.forEach((r) => { if (c[r.stageLevel] !== undefined) c[r.stageLevel]++; else c.none++ })
  const qual = a.filter((r) => r.stageQualifier).length
  console.log(`  ${g}: 一=${c.阶段一} 二=${c.阶段二} 三=${c.阶段三} none=${c.none} | 修饰语(一末/二初/二末)=${qual}`)
}
const rate = (g, pred) => {
  const a = groups[g]
  return pct(a.filter(pred).length, a.length)
}
console.log('L2 留白率: ' + ['Z', 'M', 'H'].map((g) => `${g}:${rate(g, (r) => r.blank)}`).join('  '))
console.log('L3 深度词命中率(≥1): ' + ['Z', 'M', 'H'].map((g) => {
  const a = groups[g]
  const avg = (a.reduce((s, r) => s + (r.deepWords || 0), 0) / (a.length || 1)).toFixed(1)
  return `${g}:${rate(g, (r) => (r.deepWords || 0) >= 1)}(均${avg})`
}).join('  '))
console.log('L4 直接给答案率: ' + ['Z', 'M', 'H'].map((g) => `${g}:${rate(g, (r) => r.directAnswer)}`).join('  '))
console.log('')
console.log('注：本模式验证的是「已发布的派生数据 → 报告数字」这一步。')
console.log('    从原始 dump 重算需本地完整证据包（未公开，见 README「数据与隐私」）。')
