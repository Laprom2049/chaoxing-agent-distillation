// 统一入口：一条命令跑完全部分析链（离线，不访问目标站点）。
// 用法：node reproduce/run_all.cjs
// 自动选择数据模式：有原始 dump 走 raw，没有则走 derived（公开仓库形态）。
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ROOT, OUT, EVIDENCE } = require('./lib/env.cjs')

const HAS_RAW = process.env.DISTILL_MODE !== 'derived' &&
  ['exp60/medium', 'exp60/high2', 'exp60/high3']
    .some((d) => fs.existsSync(path.join(EVIDENCE, d)))
const MODE = HAS_RAW ? 'raw' : 'derived'

// requiresRaw: 只在原始 dump 在场时可运行
const STEPS = [
  [HAS_RAW ? 'analyze60.cjs' : 'metrics_from_analysis.cjs',
    HAS_RAW ? '原始 UIA dump → 三组结构化指标' : '派生数据 → 三组结构化指标', false],
  ['verify_transferable.cjs', '提示词 25 条款逐条命中率（Tier 分层依据）', false],
  ['check_prompt_parity.cjs', '课程专用版 v3 ↔ 学科无关版 v1.1 条款对账', false],
  ['audit_z_fidelity.cjs', 'Z 组输入保真度（IME 改写审计）', true],
  ['audit_input_fidelity.cjs', 'M 组输入保真度（IME 改写审计）', true],
]

console.log(`数据模式: ${MODE}\n`)

let failed = 0
const report = []
for (const [script, desc, requiresRaw] of STEPS) {
  if (requiresRaw && !HAS_RAW) {
    console.log(`[SKIP] ${script} — ${desc}（需原始 dump，本仓库未公开）`)
    report.push({ script, ok: true, skipped: true })
    continue
  }
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [path.join(__dirname, 'tools', script)], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const ok = r.status === 0
  if (!ok) failed++
  const ms = Date.now() - t0
  report.push({ script, ok, ms, status: r.status })
  console.log(`\n${'='.repeat(72)}\n[${ok ? 'OK' : 'FAIL'}] ${script} — ${desc}  (${ms}ms)\n${'='.repeat(72)}`)
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
}

const sum = path.join(OUT, 'run-summary.json')
fs.writeFileSync(sum, JSON.stringify({ ranAt: new Date().toISOString(), mode: MODE, steps: report, failed }, null, 2), 'utf8')
console.log(`\n生成: out/run-summary.json`)
console.log(failed === 0 ? '\n全部步骤成功。' : `\n有 ${failed} 个步骤失败，请查看上面的 stderr。`)
process.exit(failed === 0 ? 0 : 1)
