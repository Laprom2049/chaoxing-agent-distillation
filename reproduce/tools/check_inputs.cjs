// Validate that every probe input is safe for send-keys under a Chinese IME.
// Rule: only CJK ideographs, ASCII digits, and Chinese punctuation are allowed.
// Any Latin letter or non-ASCII symbol (π, ∫, δ, Λ, ², ⁻) risks IME garbling.
// [重建版] 原样逻辑，仅替换路径解析：绝对路径 -> reproduce/lib/env.cjs
const { ROOT, EVIDENCE: EV, OUT } = require('../lib/env.cjs')
const fs = require('fs')
const path = require('path')

const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: node check_inputs.cjs <bank.json> [...]')
  process.exit(2)
}

// 允许：CJK 统一表意文字、ASCII 数字、中文标点
const SAFE = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9]/
const UNSAFE_CHARS = /[A-Za-z\u0370-\u03ff\u2200-\u22ff\u2070-\u209f\u2080-\u208f\u00b2-\u00b3\u00b9\u207b\u208b\u2190-\u21ff\u2212\u221d-\u221e\u222b\u2202\u2264\u2265\u2260\u221a\u2211\u220f]/

let bad = 0
for (const f of files) {
  const p = path.isAbsolute(f) ? f : path.join(EV, f)
  if (!fs.existsSync(p)) { console.log(`[skip] ${f}`); continue }
  const bank = JSON.parse(fs.readFileSync(p, 'utf8'))
  console.log(`\n=== ${path.basename(p)} (${bank.length} 条) ===`)
  for (const item of bank) {
    const t = item.text || ''
    const hits = [...new Set((t.match(new RegExp(UNSAFE_CHARS.source, 'g')) || []))]
    // 逐字符检查：不在 SAFE 也不在空白内的字符都算风险
    const risky = []
    for (const ch of t) {
      if (SAFE.test(ch)) continue
      if (/[\s]/.test(ch)) continue
      risky.push(ch)
    }
    const uniqRisky = [...new Set(risky)]
    if (uniqRisky.length) {
      bad++
      console.log(`  ⚠ ${item.cat}${String(item.n).padStart(2)} 风险字符: ${uniqRisky.join(' ')}`)
      console.log(`     ${t.slice(0, 80)}`)
    }
  }
  const okCount = bank.length - bank.filter((it) => {
    const risky = []
    for (const ch of (it.text || '')) { if (SAFE.test(ch) || /[\s]/.test(ch)) continue; risky.push(ch) }
    return risky.length > 0
  }).length
  console.log(`  安全 ${okCount}/${bank.length}`)
}
console.log(`\n合计风险条目: ${bad}`)
process.exit(bad > 0 ? 1 : 0)
