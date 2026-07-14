export type AccordionSection = 'account' | 'exchange' | 'api' | 'risk' | 'auto' | 'alerts' | null;

export interface SectionHeaderProps {
  section: AccordionSection;
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: (section: AccordionSection) => void;
}

const accordionBodyStyle = {
  padding: '16px',
  border: '1px solid var(--color-border)',
  borderTop: 'none',
  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
} as const;

export function SectionHeader({ section, title, icon, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      className="accordion-header touch-target"
      onClick={() => onToggle(section)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: isOpen ? 'var(--color-surface2)' : 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      aria-expanded={isOpen}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{
          fontWeight: 600,
          color: 'var(--color-text)',
          fontSize: '0.95rem',
        }}>
          {title}
        </span>
      </div>
      <span style={{
        fontSize: '0.8rem',
        color: 'var(--color-muted)',
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}>
        ▼
      </span>
    </button>
  );
}

interface AccordionPanelProps {
  section: AccordionSection;
  title: string;
  icon: string;
  openSection: AccordionSection;
  onToggle: (section: AccordionSection) => void;
  maxHeight: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function AccordionPanel({
  section,
  title,
  icon,
  openSection,
  onToggle,
  maxHeight,
  contentClassName,
  children,
}: AccordionPanelProps) {
  const isOpen = openSection === section;

  return (
    <div>
      <SectionHeader
        section={section}
        title={title}
        icon={icon}
        isOpen={isOpen}
        onToggle={onToggle}
      />
      <div
        className={contentClassName}
        style={{
          maxHeight: isOpen ? maxHeight : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
        }}
      >
        <div style={accordionBodyStyle}>{children}</div>
      </div>
    </div>
  );
}
