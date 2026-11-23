// 离线自检：不访问目标站点、不需要登录，验证「包完整 + 指标可重算」。
// 用法：node reproduce/selftest.cjs [--no-hash]
// 退出码 0 = 全部通过；1 = 有失败项。
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const { ROOT, OUT } = require('./lib/env.cjs')

const NO_HASH = process.argv.includes('--no-hash')
const results = []
const fail = (name, detail) => results.push({ name, ok: false, detail })
const pass = (name, detail = '') => results.push({ name, ok: true, detail })

// ---------- 终值基线：与 docs/EXP60_REPORT.md 附录 F 一致 ----------
const EXPECT = {
  rounds: { Z: 30, M: 30, H: 30 },
  K: {
    K1: { Z: 83, M: 93, H: 90 }, K2: { Z: 70, M: 70, H: 80 },
    K3: { Z: 83, M: 93, H: 90 }, K4: { Z: 80, M: 77, H: 80 },
    K5: { Z: 53, M: 57, H: 77 }, K6: { Z: 70, M: 77, H: 77 },
    K7: { Z: 90, M: 80, H: 70 }, K8: { Z: 87, M: 93, H: 93 },
  },
  L1: {
    Z: { 一: 19, 二: 6, 三: 0 }, M: { 一: 6, 二: 16, 三: 6 }, H: { 一: 1, 二: 19, 三: 7 },
  },
  L2: { Z: 53, M: 57, H: 77 },
  L3: { Z: 27, M: 33, H: 70 },
}

// ---------- 1. 必需文件 ----------
const REQUIRED = [
  'README.md', 'REPRODUCE.md', 'docs/01-蒸馏结论.md', 'docs/02-方法与证据分级.md',
  'docs/EXP60_REPORT.md', 'docs/EXPERIMENT_60.md',
  'prompt/TRANSFERABLE_PROMPT.md', 'prompt/RECONSTRUCTION_PROMPT.md',
  'spec/behavior_spec.yaml', 'verify/TRANSFERABLE_TESTKIT.md', 'verify/VERIFY_TRANSFERABLE.md',
  'evidence/rounds-all-extracted.json', 'evidence/exp60/analysis.json',
  'reproduce/tools/analyze60.cjs', 'reproduce/tools/verify_transferable.cjs',
]
const missing = REQUIRED.filter((p) => !fs.existsSync(path.join(ROOT, p)))
missing.length ? fail('必需文件齐全', `缺失 ${missing.length} 个：${missing.join(', ')}`) : pass('必需文件齐全', `${REQUIRED.length} 个`)

// ---------- 2. JSON / JSONL 可解析 ----------
const bad = []
const jsons = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'out' || e.name === 'node_modules' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.json$/.test(e.name)) jsons.push(p)
  }
})(ROOT)
for (const p of jsons) {
  try { JSON.parse(fs.readFileSync(p, 'utf8')) } catch (err) { bad.push(`${path.relative(ROOT, p)}: ${err.message}`) }
}
bad.length ? fail('JSON 全部可解析', bad.slice(0, 3).join(' | ')) : pass('JSON 全部可解析', `${jsons.length} 个文件`)

// ---------- 3. 参数化路径：不允许残留旧绝对路径 ----------
const stale = []
;(function walk2(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'out' || e.name === 'node_modules' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { walk2(p); continue }
    if (!/\.(cjs|ps1|js|mjs)$/.test(e.name)) continue
    const s = fs.readFileSync(p, 'utf8')
    if (/Desktop[\\/]+工作区/.test(s)) stale.push(path.relative(ROOT, p).split('\\').join('/'))
  }
})(path.join(ROOT, 'reproduce'))
stale.length ? fail('脚本无硬编码旧路径', stale.join(', ')) : pass('脚本无硬编码旧路径', 'reproduce/ 全部通过')

// ---------- 4. 重算主指标并逐项比对 ----------
// 两种数据模式：
//   raw     = 本地完整证据包，从原始 UIA dump 重算（analyze60）
//   derived = 公开仓库，从已发布的 analysis.json 重算（metrics_from_analysis）
const HAS_RAW = process.env.DISTILL_MODE !== 'derived' &&
  ['evidence/exp60/medium', 'evidence/exp60/high2', 'evidence/exp60/high3']
    .some((d) => fs.existsSync(path.join(ROOT, d)))
const MODE = HAS_RAW ? 'raw' : 'derived'
console.log(`\n数据模式: ${MODE}${HAS_RAW ? '（原始 dump 在场，从 dump 重算）' : '（原始 dump 未公开，从派生数据重算）'}`)

function run(script) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'reproduce', 'tools', script)], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  return { out: (r.stdout || '') + (r.stderr || ''), status: r.status }
}

const MAIN = HAS_RAW ? 'analyze60.cjs' : 'metrics_from_analysis.cjs'
const a = run(MAIN)
if (a.status !== 0) {
  fail(`${MAIN} 运行`, `退出码 ${a.status}`)
} else {
  pass(`${MAIN} 运行`, `退出码 0，模式 ${MODE}`)
  // 覆盖轮次
  for (const g of ['Z', 'M', 'H']) {
    const m = a.out.match(new RegExp(`^${g}: (\\d+) rounds$`, 'm'))
    const got = m ? Number(m[1]) : -1
    got === EXPECT.rounds[g]
      ? pass(`覆盖 ${g} 组`, `${got} 轮`)
      : fail(`覆盖 ${g} 组`, `期望 ${EXPECT.rounds[g]}，实得 ${got}`)
  }
  // K1–K8
  for (const k of Object.keys(EXPECT.K)) {
    const m = a.out.match(new RegExp(`^${k}\\s+Z:(\\d+)%\\s+M:(\\d+)%\\s+H:(\\d+)%`, 'm'))
    if (!m) { fail(`${k} 通过率`, '输出中未找到该行'); continue }
    const got = { Z: +m[1], M: +m[2], H: +m[3] }
    const ok = ['Z', 'M', 'H'].every((g) => got[g] === EXPECT.K[k][g])
    ok ? pass(`${k} 通过率`, `${got.Z}/${got.M}/${got.H}`)
       : fail(`${k} 通过率`, `期望 ${EXPECT.K[k].Z}/${EXPECT.K[k].M}/${EXPECT.K[k].H}，实得 ${got.Z}/${got.M}/${got.H}`)
  }
  // L1
  for (const g of ['Z', 'M', 'H']) {
    const m = a.out.match(new RegExp(`^\\s+${g}: 一=(\\d+) 二=(\\d+) 三=(\\d+)`, 'm'))
    if (!m) { fail(`L1 阶段分布 ${g}`, '未找到'); continue }
    const got = { 一: +m[1], 二: +m[2], 三: +m[3] }
    const ok = ['一', '二', '三'].every((x) => got[x] === EXPECT.L1[g][x])
    ok ? pass(`L1 阶段分布 ${g}`, `${got.一}/${got.二}/${got.三}`)
       : fail(`L1 阶段分布 ${g}`, `期望 ${EXPECT.L1[g].一}/${EXPECT.L1[g].二}/${EXPECT.L1[g].三}，实得 ${got.一}/${got.二}/${got.三}`)
  }
  // L2 / L3
  const l2 = a.out.match(/^L2 留白率: Z:(\d+)%\s+M:(\d+)%\s+H:(\d+)%/m)
  if (l2) {
    const got = { Z: +l2[1], M: +l2[2], H: +l2[3] }
    const ok = ['Z', 'M', 'H'].every((g) => got[g] === EXPECT.L2[g])
    if (ok) pass('L2 留白率', `${got.Z}/${got.M}/${got.H}`)
    else fail('L2 留白率', `期望 ${EXPECT.L2.Z}/${EXPECT.L2.M}/${EXPECT.L2.H}，实得 ${got.Z}/${got.M}/${got.H}`)
  } else fail('L2 留白率', '未找到')
  const l3 = a.out.match(/^L3 深度词命中率\(≥1\): Z:(\d+)%(?:\([^)]*\))?\s+M:(\d+)%(?:\([^)]*\))?\s+H:(\d+)%/m)
  if (l3) {
    const got = { Z: +l3[1], M: +l3[2], H: +l3[3] }
    const ok = ['Z', 'M', 'H'].every((g) => got[g] === EXPECT.L3[g])
    if (ok) pass('L3 深度词命中', `${got.Z}/${got.M}/${got.H}`)
    else fail('L3 深度词命中', `期望 ${EXPECT.L3.Z}/${EXPECT.L3.M}/${EXPECT.L3.H}，实得 ${got.Z}/${got.M}/${got.H}`)
  } else fail('L3 深度词命中', '未找到')
  // 核心行为断言：直接给答案率恒为 0
  const l4 = a.out.match(/^L4 直接给答案率: Z:(\d+)%\s+M:(\d+)%\s+H:(\d+)%/m)
  if (l4 && [+l4[1], +l4[2], +l4[3]].every((v) => v === 0)) pass('L4 直接给答案率 = 0', '三组均为 0%')
  else fail('L4 直接给答案率 = 0', l4 ? l4[0] : '未找到')
}

// ---------- 5. 条款对账 28/28 ----------
const p = run('check_prompt_parity.cjs')
if (p.status !== 0) fail('提示词条款对账', `退出码 ${p.status}`)
else {
  const rows = (p.out.match(/✓\s+✓/g) || []).length
  rows >= 28 ? pass('提示词条款对账', `${rows} 条两边都在场`) : fail('提示词条款对账', `仅 ${rows} 条`)
}

// ---------- 6. manifest 完整性（可选） ----------
const mp = path.join(ROOT, 'manifest.json')
if (!NO_HASH && fs.existsSync(mp)) {
  const man = JSON.parse(fs.readFileSync(mp, 'utf8'))
  const mism = []
  for (const f of man.files) {
    const abs = path.join(ROOT, f.path)
    if (!fs.existsSync(abs)) { mism.push(`缺失 ${f.path}`); continue }
    const h = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
    if (h !== f.sha256) mism.push(`改动 ${f.path}`)
  }
  mism.length ? fail('manifest 完整性', mism.slice(0, 3).join(' | ') + (mism.length > 3 ? ` …共 ${mism.length} 处` : ''))
              : pass('manifest 完整性', `${man.files.length} 个文件哈希一致`)
} else {
  pass('manifest 完整性', NO_HASH ? '已跳过（--no-hash）' : 'manifest.json 不存在，跳过')
}

// ---------- 汇总 ----------
const okN = results.filter((r) => r.ok).length
console.log('\n自检结果')
console.log('-'.repeat(64))
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  —  ' + r.detail : ''}`)
}
console.log('-'.repeat(64))
console.log(`${okN}/${results.length} 通过`)
fs.writeFileSync(path.join(OUT, 'selftest.json'), JSON.stringify({ at: new Date().toISOString(), okN, total: results.length, results }, null, 2), 'utf8')
process.exit(okN === results.length ? 0 : 1)
