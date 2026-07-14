import { useState } from 'react';
import { inputStyle, labelStyle } from './strategyFormStyles';

export function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'var(--color-surface2)',
        color: 'var(--color-muted)',
        fontSize: '0.7rem',
        cursor: 'help',
        marginLeft: '6px',
        position: 'relative',
        border: '1px solid var(--color-border)',
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      aria-label="More information"
    >
      ?
      {show && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-surface2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: 'var(--color-text)',
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: 'var(--shadow-md)',
          marginBottom: '6px',
          minWidth: '200px',
          lineHeight: 1.4,
        }}
        >
          {text}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '6px solid transparent',
            borderTopColor: 'var(--color-border)',
          }}
          />
        </span>
      )}
    </span>
  );
}

export function ValidationIndicator({ valid, message }: { valid: boolean; message?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '6px',
        fontSize: '0.75rem',
        color: valid ? 'var(--color-green)' : 'var(--color-red)',
      }}
      title={message}
    >
      {valid ? '✓' : '✗'}
    </span>
  );
}

interface FieldProps {
  label: string;
  labelTooltip?: string;
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  type?: string;
  validate?: (v: number) => boolean;
  validationMessage?: string;
  suffix?: string;
}

export function Field({
  label, labelTooltip, value, onChange, min, max, step, type = 'number',
  validate, validationMessage, suffix,
}: FieldProps) {
  const numValue = parseFloat(value as string);
  const isValid = !isNaN(numValue) && (!validate || validate(numValue));

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>
        {label}
        {labelTooltip && <TooltipIcon text={labelTooltip} />}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputStyle,
            borderColor: value && !isValid ? 'var(--color-red)' : 'var(--color-border)',
            paddingRight: suffix ? '30px' : '12px',
          }}
        />
        {suffix && (
          <span style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-muted)',
            fontSize: '0.85rem',
          }}
          >
            {suffix}
          </span>
        )}
        {value && validate && (
          <ValidationIndicator valid={isValid} message={validationMessage} />
        )}
      </div>
    </div>
  );
}
