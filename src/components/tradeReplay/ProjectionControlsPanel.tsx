import type { ChartRange, ScenarioMode } from '@/types';
import { RANGES, SCENARIOS } from './constants';

interface Props {
  range: ChartRange;
  scenario: ScenarioMode;
  showBaseline: boolean;
  onRangeChange: (range: ChartRange) => void;
  onScenarioChange: (scenario: ScenarioMode) => void;
  onShowBaselineChange: (show: boolean) => void;
}

export function ProjectionControlsPanel({
  range,
  scenario,
  showBaseline,
  onRangeChange,
  onScenarioChange,
  onShowBaselineChange,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }} role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r}
            className={`range-pill${range === r ? ' active' : ''}`}
            aria-pressed={range === r}
            onClick={() => onRangeChange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px' }} role="group" aria-label="Scenario mode">
        {SCENARIOS.map((s) => (
          <button
            key={s.value}
            className={`range-pill${scenario === s.value ? ' active' : ''}`}
            aria-pressed={scenario === s.value}
            onClick={() => onScenarioChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-muted)',
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        <input
          type="checkbox"
          checked={showBaseline}
          onChange={(e) => onShowBaselineChange(e.target.checked)}
          aria-label="Show entry baseline"
          style={{ accentColor: 'var(--color-accent)', width: '16px', height: '16px' }}
        />
        Entry baseline
      </label>
    </div>
  );
}
