import type { ComponentChildren } from 'preact';

export function Tile({ value, unit, label }: { value: ComponentChildren; unit?: string; label: string }) {
  return (
    <div class="tile">
      <div class="value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div class="label">{label}</div>
    </div>
  );
}
