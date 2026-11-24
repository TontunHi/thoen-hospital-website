import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

function walkFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate))
    } else if (predicate(fullPath)) {
      results.push(fullPath)
    }
  }
  return results
}

describe('Hospital Architecture & Build Guardrails', () => {
  const srcRoot = path.resolve(process.cwd(), 'src')
  const apiRoot = path.join(srcRoot, 'app', 'api')

  it('forbids raw Node.js fs / fs/promises imports in API route handlers (use DocumentStorage seam)', () => {
    const routeFiles = walkFiles(apiRoot, (f) => f.endsWith('route.ts'))
    const violations: string[] = []

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf8')
      if (/from\s+['"](node:)?fs(\/promises)?['"]/.test(content)) {
        violations.push(path.relative(process.cwd(), file))
      }
    }

    expect(violations).toEqual([])
  })

  it('forbids static top-level runtime ExcelJS imports in Client Components (use dynamic import("exceljs"))', () => {
    const clientFiles = walkFiles(srcRoot, (f) => /\.(ts|tsx)$/.test(f) && !f.includes('.test.'))
    const violations: string[] = []

    for (const file of clientFiles) {
      const content = fs.readFileSync(file, 'utf8')
      if (!/^\s*['"]use client['"]/.test(content)) continue

      // Allow `import type ExcelJS from 'exceljs'`, forbid runtime static import
      const hasStaticRuntimeExcelJs =
        /^\s*import\s+(?!type\b)[^;\n]*from\s+['"]exceljs['"]/m.test(content)
      if (hasStaticRuntimeExcelJs) {
        violations.push(path.relative(process.cwd(), file))
      }
    }

    expect(violations).toEqual([])
  })

  it('forbids direct mysql2 imports inside src/app routes and pages (Zero-DB Gateway rule)', () => {
    const appFiles = walkFiles(path.join(srcRoot, 'app'), (f) => /\.(ts|tsx)$/.test(f))
    const violations: string[] = []

    for (const file of appFiles) {
      const content = fs.readFileSync(file, 'utf8')
      if (/from\s+['"]mysql2(\/promise)?['"]/.test(content)) {
        violations.push(path.relative(process.cwd(), file))
      }
    }

    expect(violations).toEqual([])
  })

  it('forbids raw SQL queries (SELECT/INSERT/UPDATE/DELETE) directly inside API route handlers (Thin Route Adapter rule)', () => {
    const routeFiles = walkFiles(apiRoot, (f) => f.endsWith('route.ts'))
    const violations: string[] = []

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf8')
      if (/\bSELECT\b[\s\S]{0,120}\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b[\s\S]{0,80}\bSET\b/i.test(content)) {
        violations.push(path.relative(process.cwd(), file))
      }
    }

    expect(violations).toEqual([])
  })

  it('forbids raw SQL or direct queryMemberDb/queryClinicalDb calls inside page.tsx Server Components', () => {
    const pageFiles = walkFiles(path.join(srcRoot, 'app'), (f) => f.endsWith('page.tsx'))
    const violations: string[] = []

    for (const file of pageFiles) {
      const content = fs.readFileSync(file, 'utf8')
      if (/\b(queryMemberDb|queryClinicalDb)\b/.test(content)) {
        violations.push(path.relative(process.cwd(), file))
      }
    }

    expect(violations).toEqual([])
  })

  it('enforces Thin Route Adapter size limit (<= 200 lines) across all API route handlers', () => {
    const routeFiles = walkFiles(apiRoot, (f) => f.endsWith('route.ts'))
    const violations: string[] = []

    for (const file of routeFiles) {
      const lineCount = fs.readFileSync(file, 'utf8').split(/\r?\n/).length
      if (lineCount > 200) {
        violations.push(`${path.relative(process.cwd(), file)} (${lineCount} lines)`)
      }
    }

    expect(violations).toEqual([])
  })

  it('enforces file size guardrail (0 files > 2,000 lines across src/)', () => {
    const allSrcFiles = walkFiles(srcRoot, (f) => /\.(ts|tsx)$/.test(f))
    const violations: string[] = []

    for (const file of allSrcFiles) {
      const lineCount = fs.readFileSync(file, 'utf8').split(/\r?\n/).length
      if (lineCount > 2000) {
        violations.push(`${path.relative(process.cwd(), file)} (${lineCount} lines)`)
      }
    }

    expect(violations).toEqual([])
  })

  it('enforces Strict Zero-SQL architecture across src/lib (0 raw SQL strings or /api/v1/*/query usages)', () => {
    const libRoot = path.join(srcRoot, 'lib')
    const libFiles = walkFiles(
      libRoot,
      (f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__') && !f.includes('.test.')
    )
    const violations: string[] = []

    for (const file of libFiles) {
      const rel = path.relative(process.cwd(), file).split(path.sep).join('/')
      const content = fs.readFileSync(file, 'utf8')
      const strippedComments = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const hasRawCall =
        /\b(queryClinicalDb|queryMemberDb|querySalaryDb|querySalaryEditDb)\b|apiGateway\.(clinical|app|salary)\.(query|execute|transaction)\b|['"]\/api\/v1\/(clinical|app|salary)\/(query|execute|transaction)['"]/.test(
          strippedComments
        )
      const hasSql =
        /\bSELECT\b[\s\S]{0,120}\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+[\w.`]+\s+SET\b|\bDELETE\s+FROM\b/i.test(
          strippedComments
        )

      if (hasRawCall || hasSql) {
        violations.push(rel)
      }
    }

    expect(violations).toEqual([])
  })
})
