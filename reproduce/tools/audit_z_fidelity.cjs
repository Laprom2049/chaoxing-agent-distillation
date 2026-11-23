// Audit input fidelity for the Z group (30 rounds) using its scattered dumps.
// Compares the user message actually present in the DOM against the designed text.
// [重建版] 原样逻辑，仅替换路径解析：绝对路径 -> reproduce/lib/env.cjs
const { ROOT, EVIDENCE: EV, OUT } = require('../lib/env.cjs')
const fs = require('fs')
const path = require('path')


const BANK = JSON.parse(fs.readFileSync(path.join(EV, 'exp60', 'z_q.json'), 'utf8'))

const DUMPS = [
  path.join(EV, 'rounds30', 'R12.json'),
  path.join(EV, 'rounds30b', 'T06.json'),
  path.join(EV, 'rounds30c', 'T04-salvage.json'),
  path.join(EV, 'rounds30b', 'T16.json'),
  path.join(EV, 'rounds30b', 'T20.json'),
  path.join(EV, 'rounds30d', 'P01-R16p.json'),
  path.join(EV, 'rounds30d', 'P02-R17.json'),
  path.join(EV, 'rounds30d', 'P03-R18.json'),
  path.join(EV, 'rounds30d', 'P04-R21.json'),
  path.join(EV, 'rounds30d', 'P05-R22.json'),
  path.join(EV, 'rounds30d', 'P06-R23.json'),
  path.join(EV, 'rounds30d', 'P07-R24.json'),
  path.join(EV, 'rounds30d', 'P08-R25.json'),
]

const cjk = (s) => (s.match(/[\u4e00-\u9fa5]/g) || '').join('')
function grams(s, n = 3) { const c = cjk(s); const g = new Set(); for (let i = 0; i + n <= c.length; i++) g.add(c.slice(i, i + n)); return g }
function recall(intended, observed) {
  const gi = grams(intended), go = grams(observed)
  if (!gi.size) return 1
  let hit = 0
  for (const g of gi) if (go.has(g)) hit++
  return hit / gi.size
}

function loadTexts(file) {
  if (!fs.existsSync(file)) return null
  const j = JSON.parse(fs.readFileSync(file, 'utf8'))
  const texts = []
  ;(function w(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(w)
    if (n.type === 'Text') { const t = (n.name || '').replace(/\s+/g, ' ').trim(); if (t) texts.push(t) }
    if (n.children) w(n.children)
    if (n.elements) w(n.elements)
  })(j.windows)
  return texts
}

function userMsgs(texts) {
  const runIdx = []
  for (let i = 0; i < texts.length; i++) if (texts[i].includes('运行完成')) runIdx.push(i)
  const out = []
  for (const a of runIdx) {
    for (let i = a - 1; i >= Math.max(0, a - 10); i--) {
      const t = texts[i]
      if (!t) continue
      if ((t.match(/[\u4e00-\u9fa5A-Za-z0-9]/g) || []).length < 6) continue
      if (['展开', '重新回答'].includes(t)) continue
      out.push(t); break
    }
  }
  return out
}

const seen = []
for (const f of DUMPS) {
  const t = loadTexts(f)
  if (!t) { console.log(`[skip] ${path.basename(f)}`); continue }
  const msgs = userMsgs(t)
  console.log(`[${path.basename(f)}] turns=${msgs.length}`)
  seen.push(...msgs)
}
console.log(`\n去重前候选用户消息 ${seen.length} 条`)

const rows = []
for (const item of BANK) {
  let best = null, bs = -1
  for (const s of seen) { const r = recall(item.text, s); if (r > bs) { bs = r; best = s } }
  const hasLatin = /[A-Za-z\u0370-\u03ff\u2200-\u22ff]/.test(item.text)
  rows.push({ n: item.n, intended: item.text, observed: best, recall: Number(bs.toFixed(2)), hasLatin,
              verdict: bs >= 0.95 ? 'intact' : bs >= 0.7 ? 'partial' : bs >= 0.3 ? 'garbled' : 'unmatched' })
}

const byV = {}
rows.forEach((r) => { byV[r.verdict] = (byV[r.verdict] || 0) + 1 })
console.log('\n=== Z 组输入保真度 ===')
console.log(JSON.stringify(byV))
const latin = rows.filter((r) => r.hasLatin)
const pure = rows.filter((r) => !r.hasLatin)
const rate = (a, k) => a.length ? (a.filter((r) => r.recall >= k).length / a.length * 100).toFixed(0) + '%' : 'n/a'
console.log(`含拉丁/希腊字符 ${latin.length} 条: 完整 ${rate(latin, 0.95)}  部分+ ${rate(latin, 0.7)}`)
console.log(`纯中文       ${pure.length} 条: 完整 ${rate(pure, 0.95)}  部分+ ${rate(pure, 0.7)}`)

const bad = rows.filter((r) => r.recall < 0.95)
console.log(`\n=== recall < 0.95 的轮次 (${bad.length}) ===`)
bad.forEach((r) => {
  console.log(`Z${String(r.n).padStart(2)} recall=${r.recall} [${r.verdict}] latin=${r.hasLatin}`)
  console.log(`   期望: ${r.intended.slice(0, 72)}`)
  console.log(`   实得: ${(r.observed || 'NONE').slice(0, 72)}`)
})

fs.writeFileSync(path.join(OUT, 'z-input-fidelity.json'), JSON.stringify(rows, null, 1), 'utf8')
console.log('\nwritten: evidence/exp60/z-input-fidelity.json')

