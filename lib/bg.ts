/**
 * Bulgarian language helpers for user-facing copy.
 */

/**
 * The preposition "в" becomes "във" before a word starting with в or ф, because
 * "в Варна" is unpronounceable. Same rule gives "със" for "с".
 *
 * Without this the delivery messages read "В Варна няма офис", which any
 * Bulgarian reader will notice immediately.
 */
export function vCity(cityName: string): string {
  return `${vPreposition(cityName)} ${cityName}`
}

export function vPreposition(word: string): 'в' | 'във' {
  const first = word.trim().charAt(0).toLocaleLowerCase('bg')
  return first === 'в' || first === 'ф' ? 'във' : 'в'
}

/** Sentence-initial form: "Във Варна…" / "В София…". */
export function VCity(cityName: string): string {
  const phrase = vCity(cityName)
  return phrase.charAt(0).toLocaleUpperCase('bg') + phrase.slice(1)
}
