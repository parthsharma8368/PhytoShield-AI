export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—';
  if (sec < 0.001) return '< 1 ms';
  if (sec < 1.0) return `${Math.round(sec * 1000)} ms`;
  return `${sec.toFixed(3)} s`;
}

export function parseBulletPoints(text: string): string[] {
  if (!text) return [];
  const items = text
    .split(/(?:\r?\n|•|\d+\.\s+)/)
    .map(s => s.trim())
    .filter(s => s.length > 6);
  if (items.length > 1) return items;
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 6);
}
