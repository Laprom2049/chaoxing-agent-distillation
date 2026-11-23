// Input-fidelity audit: compare the user message actually seen in the DOM
// against the intended probe text, to detect IME garbling of Latin/math characters.
// [重建版] 原样逻辑，仅替换路径解析：绝对路径 -> reproduce/lib/env.cjs
const { ROOT, EVIDENCE: EV, OUT } = require('../lib/env.cjs')
const fs = require('fs')
const path = require('path')


const M_Q = JSON.parse(fs.readFileSync(path.join(EV, 'exp60', 'm_q.json'), 'utf8'))
const H_Q = JSON.parse(fs.readFileSync(path.join(EV, 'exp60', 'h_q.json'), 'utf8'))

const cjk = (s) => (s.match(/[\u4e00-\u9fa5]/g) || '').join('')
const grams = (s, n = 3) => {
  const c = cjk(s); const g = new Set()
  for (let i = 0; i + n <= c.length; i++) g.add(c.slice(i, i + n))
  return g
}
function recall(intended, observed) {
  const gi = grams(intended); const go = grams(observed)
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
  return runIdx.map((a) => {
    for (let i = a - 1; i >= Math.max(0, a - 10); i--) {
      const t = texts[i]
      if (!t) continue
      if ((t.match(/[\u4e00-\u9fa5A-Za-z0-9]/g) || []).length < 6) continue
      if (['展开', '重新回答'].includes(t)) continue
      return t
    }
    return null
  }).filter(Boolean)
}

function audit(group, bank, dumpDir, prefix) {
  const files = fs.readdirSync(dumpDir).filter((f) => /\.json$/.test(f) && !/log/.test(f))
  const seen = []
  for (const f of files) {
    const t = loadTexts(path.join(dumpDir, f))
    if (t) seen.push(...userMsgs(t))
  }
  const rows = []
  for (const item of bank) {
    const intended = item.text
    let best = null, bs = -1
    for (const s of seen) {
      const r = recall(intended, s)
      if (r > bs) { bs = r; best = s }
    }
    const hasLatin = /[A-Za-z]/.test(intended)
    rows.push({
      group, n: item.n, intended, observed: best,
      recall: Number(bs.toFixed(2)),
      hasLatin,
      verdict: bs >= 0.95 ? 'intact' : bs >= 0.7 ? 'partial' : bs >= 0.3 ? 'garbled' : 'unmatched',
    })
  }
  return rows
}

const medDir = path.join(EV, 'exp60', 'medium')
const highDir = path.join(EV, 'exp60', 'high')

const rows = []
if (fs.existsSync(medDir)) rows.push(...audit('M', M_Q, medDir))
if (fs.existsSync(highDir)) rows.push(...audit('H', H_Q, highDir))

fs.writeFileSync(path.join(OUT, 'input-fidelity.json'), JSON.stringify(rows, null, 1), 'utf8')

const byV = {}
rows.forEach((r) => { byV[r.verdict] = (byV[r.verdict] || 0) + 1 })
console.log('=== 输入保真度汇总 ===')
console.log(JSON.stringify(byV))

const latin = rows.filter((r) => r.hasLatin)
const nonLatin = rows.filter((r) => !r.hasLatin)
const rate = (arr, ok) => arr.length ? (arr.filter((r) => r.recall >= ok).length / arr.length * 100).toFixed(0) + '%' : 'n/a'
console.log(`含拉丁字符 ${latin.length} 条: 完整率=${rate(latin, 0.95)}  部分+=${rate(latin, 0.7)}`)
console.log(`纯中文     ${nonLatin.length} 条: 完整率=${rate(nonLatin, 0.95)}  部分+=${rate(nonLatin, 0.7)}`)

console.log('\n=== 需注意的轮次（recall < 0.95）===')
rows.filter((r) => r.recall < 0.95).forEach((r) => {
  console.log(`${r.group}${String(r.n).padStart(2)} recall=${r.recall} [${r.verdict}] latin=${r.hasLatin}`)
  console.log(`   期望: ${r.intended.slice(0, 70)}`)
  console.log(`   实得: ${(r.observed || 'NONE').slice(0, 70)}`)
})
