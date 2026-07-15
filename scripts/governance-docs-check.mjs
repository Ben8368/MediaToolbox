import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const budgets = [
  { file: 'AGENTS.md', lines: 85, characters: 4500 },
  { file: 'CONTEXT.md', lines: 45, characters: 2600 },
  { file: 'LESSONS.md', lines: 20, characters: 1800 },
  { file: 'CLAUDE.md', lines: 20, characters: 1000 },
  { file: '.cursorrules', lines: 20, characters: 1000 }
]

const errors = []
const contents = new Map()

for (const budget of budgets) {
  const content = await readFile(resolve(root, budget.file), 'utf8')
  contents.set(budget.file, content)
  const lines = content.trimEnd().split('\n').length
  const characters = [...content].length

  if (lines > budget.lines || characters > budget.characters) {
    errors.push(`${budget.file}: ${lines}/${budget.lines} 行，${characters}/${budget.characters} 字符`)
  }
}

const context = contents.get('CONTEXT.md')
const priorities = [...context.matchAll(/^\d+\. /gm)].length
if (priorities > 3) {
  errors.push(`CONTEXT.md: 近期优先级不得超过 3 项，当前为 ${priorities} 项`)
}

for (const forbidden of ['当前分支', '最近更新', '## 常用命令', '## 常用文档']) {
  if (context.includes(forbidden)) {
    errors.push(`CONTEXT.md: 不应包含“${forbidden}”`)
  }
}

const requiredSections = {
  'AGENTS.md': ['## 开局与按需读取', '## 治理文档自治理', 'docs/GOVERNANCE.md'],
  'CONTEXT.md': ['## 当前决策', '## 近期优先级', '## 按需入口'],
  'LESSONS.md': ['docs/lessons/governance.md', 'docs/lessons/runtime.md', 'docs/lessons/frontend.md', 'docs/lessons/windows.md']
}

for (const [file, sections] of Object.entries(requiredSections)) {
  const content = contents.get(file)
  for (const section of sections) {
    if (!content.includes(section)) errors.push(`${file}: 缺少必需路由或章节“${section}”`)
  }
}

for (const file of ['docs/GOVERNANCE.md', 'docs/lessons/governance.md', 'docs/lessons/runtime.md', 'docs/lessons/frontend.md', 'docs/lessons/windows.md']) {
  try {
    await readFile(resolve(root, file), 'utf8')
  } catch {
    errors.push(`缺少路由目标：${file}`)
  }
}

if (errors.length > 0) {
  console.error('治理文档检查失败：')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('治理文档检查通过。')
}
