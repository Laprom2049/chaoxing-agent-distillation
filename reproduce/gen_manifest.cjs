// 生成 reproducibility manifest：只覆盖**仓库跟踪的文件**（git ls-files），
// 这样在公开仓库里克隆下来也能完整校验，不会被未公开的原始 dump 拖出假失败。
// 用法：node reproduce/gen_manifest.cjs
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { ROOT } = require('./lib/env.cjs')

function trackedFiles() {
  try {
    const out = execSync('git ls-files -z', { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
    return out.toString('utf8').split('\0').filter(Boolean)
  } catch {
    return null
  }
}

let list = trackedFiles()
if (!list || list.length === 0) {
  console.warn('未检测到 git 跟踪文件，退化为目录遍历（out/ 与 manifest.json 除外）。')
  list = []
  const SKIP = new Set(['out', 'node_modules', '.git'])
  ;(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue
      const p = path.join(dir, e.name)
      const rel = path.relative(ROOT, p).split(path.sep).join('/')
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && rel !== 'manifest.json') list.push(rel)
    }
  })(ROOT)
}

const files = []
for (const rel of list) {
  if (rel === 'manifest.json') continue
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) continue
  const buf = fs.readFileSync(abs)
  // 行尾归一化后再哈希：Windows 检出为 CRLF、Linux 为 LF，但内容应等价。
  const norm = buf.toString('utf8').replace(/\r\n/g, '\n')
  files.push({ path: rel, bytes: buf.length, sha256: crypto.createHash('sha256').update(norm, 'utf8').digest('hex') })
}
files.sort((a, b) => (a.path < b.path ? -1 : 1))

let version = null
const pkg = path.join(ROOT, 'package.json')
if (fs.existsSync(pkg)) version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version

const manifest = {
  name: 'chaoxing-ai-ta-behavior-distillation',
  version,
  generatedAt: new Date().toISOString(),
  scope: 'git 跟踪文件；不含 manifest.json 自身、out/ 与未公开的原始 dump',
  totalFiles: files.length,
  totalBytes: files.reduce((s, f) => s + f.bytes, 0),
  files,
}
fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 1), 'utf8')
console.log(`manifest.json 已生成：${files.length} 个文件，${(manifest.totalBytes / 1048576).toFixed(2)} MB`)
