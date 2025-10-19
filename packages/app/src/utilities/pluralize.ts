export function pluralize (count: number, singular: string, plural = singular.at(-1) === 's' ? `${singular}es` : `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
