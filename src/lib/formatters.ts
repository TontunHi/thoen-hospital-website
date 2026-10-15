/**
 * Common formatting and string utilities for Hospital Staff and UI presentation.
 */

/**
 * Extracts initials or short avatar representation from a person's name or username.
 * Strips common Thai honorifics and titles (e.g. นาย, นางสาว, นาง, นพ., พญ., ทพ., ภก., ภญ., พยาบาล, ดร.).
 *
 * @param name Full name or username string
 * @param uppercase Whether to convert English initials to uppercase (default: false)
 * @returns 1-2 character initials or fallback '?'
 */
export function getInitials(name?: string | null, uppercase: boolean = false): string {
  if (!name || !name.trim()) return '?'
  const clean = name.replace(/^(นาย|นางสาว|นาง|นพ\.|พญ\.|ทพ\.|ภก\.|ภญ\.|พยาบาล|ดร\.)\s*/, '').trim()
  if (!clean) return '?'
  const sliced = clean.slice(0, 2)
  return uppercase ? sliced.toUpperCase() : sliced
}
