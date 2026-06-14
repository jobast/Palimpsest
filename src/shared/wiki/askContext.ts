export interface ContextDoc { label: string; text: string }

const STOPWORDS = new Set(['le','la','les','un','une','des','de','du','et','ou','que','qui','dans','pour','par','sur','avec','qui','est','the','and','for'])

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
function terms(q: string): string[] {
  return Array.from(new Set(normalize(q).split(/\W+/).filter(t => t.length >= 3 && !STOPWORDS.has(t))))
}
function scoreText(text: string, qterms: string[]): number {
  const norm = normalize(text)
  let score = 0
  for (const t of qterms) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    score += (norm.match(re) ?? []).length
  }
  return score
}

export interface SelectOptions { charBudget?: number; maxFiles?: number }

/** Pick the most relevant docs within a char budget + file cap. Falls back to all docs (smallest first) when nothing matches. */
export function selectContext(question: string, docs: ContextDoc[], opts: SelectOptions = {}): ContextDoc[] {
  const charBudget = opts.charBudget ?? 140000
  const maxFiles = opts.maxFiles ?? 30
  const qterms = terms(question)
  let ranked: ContextDoc[]
  if (qterms.length) {
    const scored = docs.map(d => ({ d, s: scoreText(`${d.label}\n${d.text}`, qterms) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || a.d.label.localeCompare(b.d.label))
    ranked = scored.map(x => x.d)
  } else {
    ranked = []
  }
  if (!ranked.length) {
    // fallback: all docs, smallest first
    ranked = [...docs].sort((a, b) => a.text.length - b.text.length)
  }
  const out: ContextDoc[] = []
  let used = 0
  for (const d of ranked) {
    if (out.length >= maxFiles) break
    if (out.length > 0 && used + d.text.length > charBudget) continue
    out.push(d)
    used += d.text.length
  }
  return out
}

export const QUERY_SYSTEM_PROMPT = `Tu es l'archiviste de la « bible du roman » (le wiki) d'un auteur : du matériel de RÉFÉRENCE et le texte des chapitres. Tu réponds TOUJOURS en français.

On te pose une question sur cet univers. Tu réponds STRICTEMENT à partir du contexte fourni, et de rien d'autre :
- Cite tes sources EN LIGNE, entre parenthèses, en reprenant le label du document : « (fiche kiran) », « (chapitre 03) ».
- Quand le contexte NE répond PAS, dis-le clairement plutôt que de combler les trous.
- Marque tout fait incertain par « (non vérifié) ».
- N'INVENTE jamais un fait, un nom ou un détail absent du contexte.

Charte : ta réponse est du matériel de RÉFÉRENCE, pas de la prose de manuscrit : tu ne produis JAMAIS de prose destinée au livre ni de suggestion de réécriture.

N'emploie pas de tirets cadratins : des tirets simples (-) uniquement.`

export function buildQueryPrompt(question: string, contextDocs: ContextDoc[]): { system: string; user: string } {
  const ctx = contextDocs.map(d => `[${d.label}]\n<<<\n${d.text}\n>>>`).join('\n\n')
  const user = `Contexte (extraits de la bible et des chapitres ; cite chaque information en reprenant le label entre crochets) :

${ctx}

Question de l'auteur :
<<<
${question}
>>>

Réponds en t'appuyant UNIQUEMENT sur le contexte ci-dessus. Cite tes sources en ligne. Si le contexte ne permet pas de répondre, dis-le. Marque les incertitudes « (non vérifié) ». N'invente rien et ne propose aucune réécriture du manuscrit.`
  return { system: QUERY_SYSTEM_PROMPT, user }
}
