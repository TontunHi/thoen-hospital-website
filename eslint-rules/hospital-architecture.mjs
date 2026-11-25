/**
 * Custom ESLint plugin enforcing Thoen Hospital architectural & security guardrails
 * at lint/IDE time (replacing manual comments and AGENTS.md reminders).
 */

const LEGACY_DB_FN_NAMES = new Set([
  'queryClinicalDb',
  'queryMemberDb',
  'querySalaryDb',
  'querySalaryEditDb',
])

const GATEWAY_NAMESPACES = new Set(['clinical', 'app', 'salary'])
const GATEWAY_RAW_METHODS = new Set(['query', 'execute', 'transaction'])
const RAW_SQL_REGEX =
  /\bSELECT\b[\s\S]{0,120}\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+[\w.`]+\s+SET\b|\bDELETE\s+FROM\b/i
const RAW_GATEWAY_PATH_REGEX =
  /\/api\/v1\/(?:clinical|app|salary)\/(?:query|execute|transaction)\b/

function isClientComponentProgram(programNode) {
  for (const stmt of programNode.body) {
    if (stmt.type !== 'ExpressionStatement') break
    const directive =
      stmt.directive ??
      (stmt.expression?.type === 'Literal' && typeof stmt.expression.value === 'string'
        ? stmt.expression.value
        : null)
    if (directive === 'use client') return true
    if (!directive) break
  }
  return false
}

function getCalleeName(node) {
  return node?.type === 'Identifier' ? node.name : null
}

function isAllowedInnerHtmlExpression(expr) {
  if (!expr || expr.type !== 'ObjectExpression') return false
  const htmlProp = expr.properties.find(
    (p) =>
      p.type === 'Property' &&
      ((p.key.type === 'Identifier' && p.key.name === '__html') ||
        (p.key.type === 'Literal' && p.key.value === '__html'))
  )
  if (!htmlProp) return false

  const val = htmlProp.value
  if (val.type === 'CallExpression') {
    if (getCalleeName(val.callee) === 'sanitizeRichHtml') return true
    if (
      val.callee.type === 'MemberExpression' &&
      getCalleeName(val.callee.object) === 'JSON' &&
      getCalleeName(val.callee.property) === 'stringify'
    ) {
      return true
    }
  }
  return false
}

export const hospitalArchitecturePlugin = {
  meta: {
    name: 'hospital-architecture',
    version: '1.0.0',
  },
  rules: {
    'no-raw-sql': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Forbid inline raw SQL statements in application and domain service code (100% Zero-SQL Gateway architecture).',
        },
        schema: [],
      },
      create(context) {
        return {
          Literal(node) {
            if (typeof node.value === 'string' && RAW_SQL_REGEX.test(node.value)) {
              context.report({
                node,
                message:
                  'Raw SQL strings are forbidden under src/ (Zero-SQL Gateway rule). Call a Named Endpoint via @/lib/apiGateway.',
              })
            }
          },
          TemplateElement(node) {
            const raw = node.value?.raw || ''
            if (RAW_SQL_REGEX.test(raw)) {
              context.report({
                node,
                message:
                  'Raw SQL template strings are forbidden under src/ (Zero-SQL Gateway rule). Call a Named Endpoint via @/lib/apiGateway.',
              })
            }
          },
        }
      },
    },

    'no-legacy-db-wrappers': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Forbid retired direct-DB wrappers and raw query gateway endpoints.',
        },
        schema: [],
      },
      create(context) {
        return {
          ImportSpecifier(node) {
            if (node.imported?.type === 'Identifier' && LEGACY_DB_FN_NAMES.has(node.imported.name)) {
              context.report({
                node,
                message: `Legacy DB wrapper "${node.imported.name}" is retired. Use Named Endpoints on @/lib/apiGateway.`,
              })
            }
          },
          CallExpression(node) {
            if (node.callee.type === 'Identifier' && LEGACY_DB_FN_NAMES.has(node.callee.name)) {
              context.report({
                node,
                message: `Legacy DB call "${node.callee.name}()" is retired. Use Named Endpoints on @/lib/apiGateway.`,
              })
              return
            }

            if (node.callee.type === 'MemberExpression') {
              const propName = getCalleeName(node.callee.property)
              const obj = node.callee.object
              if (
                propName &&
                GATEWAY_RAW_METHODS.has(propName) &&
                obj?.type === 'MemberExpression' &&
                getCalleeName(obj.object) === 'apiGateway' &&
                GATEWAY_NAMESPACES.has(getCalleeName(obj.property))
              ) {
                context.report({
                  node,
                  message: `Raw gateway call "apiGateway.${getCalleeName(obj.property)}.${propName}()" is forbidden. Use a Named Gateway Endpoint.`,
                })
              }
            }
          },
          Literal(node) {
            if (typeof node.value === 'string' && RAW_GATEWAY_PATH_REGEX.test(node.value)) {
              context.report({
                node,
                message:
                  'Raw gateway /query, /execute, or /transaction paths are forbidden. Use a Named Gateway Endpoint.',
              })
            }
          },
        }
      },
    },

    'no-static-exceljs-in-client': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Require dynamic import("exceljs") or type-only imports in Client Components to keep initial bundles small.',
        },
        schema: [],
      },
      create(context) {
        let isClient = false
        return {
          Program(node) {
            isClient = isClientComponentProgram(node)
          },
          ImportDeclaration(node) {
            if (!isClient || node.source.value !== 'exceljs') return
            if (node.importKind === 'type') return
            const allSpecifiersAreTypes =
              node.specifiers.length > 0 && node.specifiers.every((s) => s.importKind === 'type')
            if (allSpecifiersAreTypes) return

            context.report({
              node,
              message:
                'Static runtime import of "exceljs" in a "use client" component bloats initial bundles. Use `import type ExcelJS from "exceljs"` + `await import("exceljs")`.',
            })
          },
        }
      },
    },

    'no-unsafe-innerhtml': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Require sanitizeRichHtml() when rendering HTML via dangerouslySetInnerHTML outside <script> tags.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name?.type !== 'JSXIdentifier' || node.name.name !== 'dangerouslySetInnerHTML') {
              return
            }
            const element = node.parent
            if (
              element?.type === 'JSXOpeningElement' &&
              element.name?.type === 'JSXIdentifier' &&
              element.name.name === 'script'
            ) {
              return
            }
            if (
              node.value?.type === 'JSXExpressionContainer' &&
              isAllowedInnerHtmlExpression(node.value.expression)
            ) {
              return
            }

            context.report({
              node,
              message:
                'Unsafe dangerouslySetInnerHTML usage. Sanitize untrusted HTML with sanitizeRichHtml() from @/lib/cms/htmlSanitizer.',
            })
          },
        }
      },
    },

    'max-file-lines': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce the AGENTS.md hard ceiling of lines per source file.',
        },
        schema: [
          {
            type: 'object',
            properties: {
              max: { type: 'integer', minimum: 1 },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const max = context.options[0]?.max ?? 2000
        return {
          Program(node) {
            const lineCount = context.sourceCode.lines.length
            if (lineCount > max) {
              context.report({
                node,
                message: `File has ${lineCount} lines, exceeding the maximum allowed ${max} lines (split into smaller modules/components).`,
              })
            }
          },
        }
      },
    },
  },
}

export default hospitalArchitecturePlugin
