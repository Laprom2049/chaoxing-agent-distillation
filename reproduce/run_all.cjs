// 统一入口：一条命令跑完全部分析链（离线，不访问目标站点）。
// 用法：node reproduce/run_all.cjs
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ROOT, OUT } = require('./lib/env.cjs')

// 顺序有依赖：analyze60 产出 analysis.json，verify_transferable 需要它。
const STEPS = [
  ['analyze60.cjs', '原始 UIA dump → 三组结构化指标（K1–K8 / L1–L5 / T1 / H1–H8）'],
  ['verify_transferable.cjs', '提示词 25 条款逐条命中率（Tier 分层依据）'],
  ['check_prompt_parity.cjs', '课程专用版 v3 ↔ 学科无关版 v1.1 条款对账'],
  ['audit_z_fidelity.cjs', 'Z 组输入保真度（IME 改写审计）'],
  ['audit_input_fidelity.cjs', 'M 组输入保真度（IME 改写审计）'],
]

let failed = 0
const report = []
for (const [script, desc] of STEPS) {
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
fs.writeFileSync(sum, JSON.stringify({ ranAt: new Date().toISOString(), steps: report, failed }, null, 2), 'utf8')
console.log(`\n生成: out/run-summary.json`)
console.log(failed === 0 ? '\n全部步骤成功。' : `\n有 ${failed} 个步骤失败，请查看上面的 stderr。`)
process.exit(failed === 0 ? 0 : 1)
