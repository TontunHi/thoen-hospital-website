import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'hr',
  'figure',
  'figcaption',
  'font',
]

/**
 * Sanitizes CMS/ITA rich-text HTML to prevent Stored XSS while preserving
 * safe editorial formatting from the member rich-text editor.
 */
export function sanitizeRichHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return ''

  return sanitizeHtml(dirtyHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': ['class', 'style'],
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
      font: ['color', 'size'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/, /^[a-zA-Z]+$/],
        'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/, /^[a-zA-Z]+$/],
        'font-size': [/^\d+(?:\.\d+)?(?:px|em|rem|%)$/],
        'font-weight': [/^(?:normal|bold|bolder|lighter|\d{3})$/],
        'font-style': [/^(?:normal|italic|oblique)$/],
        'text-decoration': [/^(?:none|underline|line-through)$/],
        'text-align': [/^(?:left|right|center|justify)$/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === '_blank') {
          return {
            tagName,
            attribs: {
              ...attribs,
              rel: 'noopener noreferrer',
            },
          }
        }
        return { tagName, attribs }
      },
    },
  })
}
