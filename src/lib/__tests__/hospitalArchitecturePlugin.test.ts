import { describe, it, expect } from 'vitest'
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import hospitalArchitecturePlugin from '../../../eslint-rules/hospital-architecture.mjs'

function createTestLinter() {
  return new Linter()
}

function lintSnippet(code: string, filename = 'src/app/test/sample.tsx') {
  const linter = createTestLinter()
  return linter.verify(
    code,
    [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: { jsx: true },
          },
        },
        plugins: {
          hospital: hospitalArchitecturePlugin as never,
        },
        rules: {
          'hospital/no-raw-sql': 'error',
          'hospital/no-legacy-db-wrappers': 'error',
          'hospital/no-static-exceljs-in-client': 'error',
          'hospital/no-unsafe-innerhtml': 'error',
          'hospital/max-file-lines': ['error', { max: 5 }],
        },
      },
    ],
    filename
  )
}

describe('hospitalArchitecturePlugin (ESLint Custom Guardrails)', () => {
  it('flags raw SQL strings and template literals (hospital/no-raw-sql)', () => {
    const messages = lintSnippet(`const q = "SELECT hn, ptname FROM patient WHERE hn = '0001'"`)
    expect(messages.some((m) => m.ruleId === 'hospital/no-raw-sql')).toBe(true)

    const clean = lintSnippet(`const msg = "กรุณาเลือกข้อมูลจากระบบ"`)
    expect(clean.some((m) => m.ruleId === 'hospital/no-raw-sql')).toBe(false)
  })

  it('flags retired DB wrappers and raw gateway query endpoints (hospital/no-legacy-db-wrappers)', () => {
    const legacyCall = lintSnippet(`queryClinicalDb("test")`)
    expect(legacyCall.some((m) => m.ruleId === 'hospital/no-legacy-db-wrappers')).toBe(true)

    const gatewayRaw = lintSnippet(`apiGateway.clinical.query("/test")`)
    expect(gatewayRaw.some((m) => m.ruleId === 'hospital/no-legacy-db-wrappers')).toBe(true)

    const rawPath = lintSnippet(`const endpoint = "/api/v1/clinical/query"`)
    expect(rawPath.some((m) => m.ruleId === 'hospital/no-legacy-db-wrappers')).toBe(true)

    const cleanNamed = lintSnippet(`apiGateway.clinical.getErInStatus()`)
    expect(cleanNamed.some((m) => m.ruleId === 'hospital/no-legacy-db-wrappers')).toBe(false)
  })

  it('forbids static runtime exceljs imports only in "use client" components (hospital/no-static-exceljs-in-client)', () => {
    const badClient = lintSnippet(`'use client'\nimport ExcelJS from 'exceljs'\nexport const x = ExcelJS`)
    expect(badClient.some((m) => m.ruleId === 'hospital/no-static-exceljs-in-client')).toBe(true)

    const goodClientTypeOnly = lintSnippet(`'use client'\nimport type ExcelJS from 'exceljs'\nexport type W = ExcelJS.Workbook`)
    expect(goodClientTypeOnly.some((m) => m.ruleId === 'hospital/no-static-exceljs-in-client')).toBe(false)

    const goodServer = lintSnippet(`import ExcelJS from 'exceljs'\nexport const x = ExcelJS`)
    expect(goodServer.some((m) => m.ruleId === 'hospital/no-static-exceljs-in-client')).toBe(false)
  })

  it('requires sanitizeRichHtml() or JSON-LD script for dangerouslySetInnerHTML (hospital/no-unsafe-innerhtml)', () => {
    const unsafeDiv = lintSnippet(`export function C({ html }: { html: string }) { return <div dangerouslySetInnerHTML={{ __html: html }} /> }`)
    expect(unsafeDiv.some((m) => m.ruleId === 'hospital/no-unsafe-innerhtml')).toBe(true)

    const safeDiv = lintSnippet(`export function C({ html }: { html: string }) { return <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} /> }`)
    expect(safeDiv.some((m) => m.ruleId === 'hospital/no-unsafe-innerhtml')).toBe(false)

    const safeScript = lintSnippet(`export function S({ ld }: { ld: object }) { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} /> }`)
    expect(safeScript.some((m) => m.ruleId === 'hospital/no-unsafe-innerhtml')).toBe(false)
  })

  it('enforces max-file-lines ceiling (hospital/max-file-lines)', () => {
    const overLimit = lintSnippet('const a = 1\nconst b = 2\nconst c = 3\nconst d = 4\nconst e = 5\nconst f = 6')
    expect(overLimit.some((m) => m.ruleId === 'hospital/max-file-lines')).toBe(true)

    const withinLimit = lintSnippet('const a = 1\nconst b = 2')
    expect(withinLimit.some((m) => m.ruleId === 'hospital/max-file-lines')).toBe(false)
  })
})
