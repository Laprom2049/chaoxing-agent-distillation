// 统一路径解析：所有脚本都从本文件取路径，禁止再硬编码绝对路径。
// 包根目录 = 本文件上溯两级（reproduce/lib/env.cjs -> 包根）
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const EVIDENCE = path.join(ROOT, 'evidence')   // 只读：原始证据（UIA dump / 截图 / 派生 JSON）
const OUT = path.join(ROOT, 'out')             // 只写：重算产物，每次运行覆盖
const PROMPT = path.join(ROOT, 'prompt')       // 提示词正文

fs.mkdirSync(OUT, { recursive: true })

module.exports = { ROOT, EVIDENCE, EV: EVIDENCE, OUT, PROMPT }
