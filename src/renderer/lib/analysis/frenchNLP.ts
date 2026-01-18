// French NLP utilities for text analysis

// Common French words to ignore in repetition detection
export const COMMON_WORDS = new Set([
  // Articles
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
  // Prepositions
  'à', 'de', 'en', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par',
  'contre', 'entre', 'vers', 'chez', 'depuis', 'pendant', 'avant', 'après',
  // Conjunctions
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi',
  'dont', 'où', 'si', 'comme', 'quand', 'lorsque', 'puisque', 'parce',
  // Pronouns
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'lui', 'leur', 'nous', 'vous',
  'ce', 'ceci', 'cela', 'ça',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'celui', 'celle', 'ceux', 'celles',
  'ce', 'cette', 'ces', 'cet',
  // Common verbs (conjugated forms)
  'est', 'suis', 'es', 'sommes', 'êtes', 'sont', 'était', 'étais', 'étaient',
  'a', 'ai', 'as', 'avons', 'avez', 'ont', 'avait', 'avais', 'avaient',
  'fait', 'fais', 'faisons', 'faites', 'font', 'faisait',
  'va', 'vais', 'vas', 'allons', 'allez', 'vont', 'allait',
  'dit', 'dis', 'disons', 'dites', 'disent', 'disait',
  'peut', 'peux', 'pouvons', 'pouvez', 'peuvent', 'pouvait',
  'veut', 'veux', 'voulons', 'voulez', 'veulent', 'voulait',
  'doit', 'dois', 'devons', 'devez', 'doivent', 'devait',
  // Other common words
  'être', 'avoir', 'faire', 'aller', 'dire', 'voir', 'savoir', 'pouvoir',
  'vouloir', 'devoir', 'falloir', 'prendre', 'donner', 'mettre',
  'pas', 'plus', 'ne', 'bien', 'tout', 'tous', 'toute', 'toutes',
  'même', 'aussi', 'encore', 'jamais', 'toujours', 'déjà', 'très',
  'peu', 'trop', 'assez', 'beaucoup', 'moins', 'tant', 'autant',
  'rien', 'personne', 'quelque', 'quelques', 'chaque', 'autre', 'autres',
  'y', 'en', 'là', 'ici', 'puis', 'alors', 'ainsi', 'donc',
])

// Weak verbs that writers should consider replacing
export const WEAK_VERBS = [
  'être', 'avoir', 'faire', 'aller', 'dire', 'voir', 'savoir',
  'pouvoir', 'vouloir', 'devoir', 'falloir', 'sembler', 'paraître'
]

// Common weak verb conjugations to detect
export const WEAK_VERB_FORMS = new Set([
  // être
  'suis', 'es', 'est', 'sommes', 'êtes', 'sont',
  'étais', 'était', 'étions', 'étiez', 'étaient',
  'serai', 'seras', 'sera', 'serons', 'serez', 'seront',
  'serais', 'serait', 'serions', 'seriez', 'seraient',
  'été',
  // avoir
  'ai', 'as', 'a', 'avons', 'avez', 'ont',
  'avais', 'avait', 'avions', 'aviez', 'avaient',
  'aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront',
  'aurais', 'aurait', 'aurions', 'auriez', 'auraient',
  'eu',
  // faire
  'fais', 'fait', 'faisons', 'faites', 'font',
  'faisais', 'faisait', 'faisions', 'faisiez', 'faisaient',
  // aller
  'vais', 'vas', 'va', 'allons', 'allez', 'vont',
  'allais', 'allait', 'allions', 'alliez', 'allaient',
  // dire
  'dis', 'dit', 'disons', 'dites', 'disent',
  'disais', 'disait', 'disions', 'disiez', 'disaient',
])

// Adjective suffix patterns
export const ADJECTIVE_SUFFIXES: RegExp[] = [
  /eux$/i,    // heureux, dangereux
  /euse$/i,   // heureuse, dangereuse
  /if$/i,     // actif, positif
  /ive$/i,    // active, positive
  /able$/i,   // capable, aimable
  /ible$/i,   // visible, possible
  /al$/i,     // normal, final
  /ale$/i,    // normale, finale
  /el$/i,     // naturel, cruel
  /elle$/i,   // naturelle, cruelle
  /ique$/i,   // fantastique, magique
  /eur$/i,    // meilleur, supérieur (careful: also nouns)
  /eux$/i,    // merveilleux
]

// Adverb pattern (ending in -ment)
export const ADVERB_PATTERN = /ment$/i

// French abbreviations to handle in sentence segmentation
export const ABBREVIATIONS = [
  'M.', 'Mme.', 'Mlle.', 'Dr.', 'Prof.', 'Me.',
  'etc.', 'ex.', 'cf.', 'vol.', 'chap.', 'p.',
  'av.', 'apr.', 'env.', 'min.', 'max.',
  'St.', 'Ste.', 'fig.', 'n°'
]

// Create regex to match abbreviations
const abbreviationPattern = ABBREVIATIONS
  .map(abbr => abbr.replace('.', '\\.'))
  .join('|')
export const ABBREVIATION_REGEX = new RegExp(`\\b(${abbreviationPattern})`, 'gi')

/**
 * Normalize a French word for comparison
 * - Lowercase
 * - Remove accents
 * - Handle common variations
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/['']/g, "'")             // Normalize apostrophes
}

/**
 * Check if a word is a common word that should be ignored
 */
export function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word.toLowerCase())
}

/**
 * Check if a word is likely an adjective (based on suffix)
 */
export function isLikelyAdjective(word: string): boolean {
  if (word.length < 4) return false
  return ADJECTIVE_SUFFIXES.some(pattern => pattern.test(word))
}

/**
 * Check if a word is likely an adverb (ending in -ment)
 */
export function isLikelyAdverb(word: string): boolean {
  if (word.length < 6) return false
  return ADVERB_PATTERN.test(word)
}

/**
 * Check if a word is a weak verb form
 */
export function isWeakVerb(word: string): boolean {
  return WEAK_VERB_FORMS.has(word.toLowerCase())
}

/**
 * Tokenize text into words with their positions
 */
export function tokenize(text: string): Array<{ word: string; from: number; to: number }> {
  const tokens: Array<{ word: string; from: number; to: number }> = []
  // Match words (including French characters and apostrophes)
  const wordRegex = /[\wÀ-ÿ]+(?:[''][\wÀ-ÿ]+)?/g
  let match

  while ((match = wordRegex.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      from: match.index,
      to: match.index + match[0].length
    })
  }

  return tokens
}

/**
 * Count words in a text
 */
export function countWords(text: string): number {
  const words = text.match(/[\wÀ-ÿ]+(?:[''][\wÀ-ÿ]+)?/g)
  return words ? words.length : 0
}
