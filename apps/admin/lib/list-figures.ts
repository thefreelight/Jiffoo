/**
 * The headline figures above a list page.
 *
 * A list of sample rows appears on the demonstration instance only, and comes
 * with sample figures. Everywhere else a figure is the store's own number, or
 * a dash when it could not be read; a fixed number never stands in for it.
 */
export function listFigure(value: number | null | undefined, sample: number, usingDemoRows: boolean): string {
  if (usingDemoRows) return sample.toLocaleString()
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '\u2014'
}

/** The change shown under a sample figure, on the demonstration instance only. */
export function sampleChange(text: string, usingDemoRows: boolean): string | undefined {
  return usingDemoRows ? text : undefined
}
