/** A single append-only journal entry. */
export function formatLogEntry(action: string, subject: string, detail: string, today: string): string {
  return `## ${today} - ${action} ${subject}\n\n${detail}\n\n---\n`
}

/** Prepend a new entry to the existing log (newest first). */
export function prependLogEntry(existingLog: string, entry: string): string {
  const trimmed = existingLog.trimStart()
  return trimmed ? `${entry}\n${trimmed}` : entry
}
