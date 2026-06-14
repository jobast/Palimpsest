/** Accent-stripped, lowercase, hyphenated slug. Falls back to "chapitre". */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '')           // trim hyphens
  return slug || 'chapitre'
}

function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

/** `001-le-depart.md` from a zero-based index + title. */
export function chapterFileName(index: number, title: string): string {
  return `${pad3(index + 1)}-${slugify(title)}.md`
}

/** Disambiguate `name.md` against a set of already-taken names. */
export function uniqueFileName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  const dot = name.lastIndexOf('.')
  const stem = dot >= 0 ? name.slice(0, dot) : name
  const ext = dot >= 0 ? name.slice(dot) : ''
  let i = 2
  let candidate = `${stem}-${i}${ext}`
  while (taken.has(candidate)) {
    i += 1
    candidate = `${stem}-${i}${ext}`
  }
  return candidate
}
