let instanceCounter = 0;

export function nextInstanceId(prefix: string): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter}_${Math.random().toString(36).slice(2, 6)}`;
}
