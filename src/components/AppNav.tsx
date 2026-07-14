import { APP_SECTIONS, type AppSection } from '@lib/appSections';

interface Props {
  section: AppSection;
  onSelect: (section: AppSection) => void;
}

export function AppNav({ section, onSelect }: Props) {
  return (
    <>
      <nav className="app-nav-desktop" aria-label="Section navigation">
        {APP_SECTIONS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`app-nav-pill${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              aria-label={`${item.label} (shortcut ${item.shortcut})`}
              onClick={() => onSelect(item.id)}
            >
              <span className="app-nav-pill-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <nav className="app-nav-mobile" aria-label="Section navigation">
        {APP_SECTIONS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`app-nav-mobile-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => onSelect(item.id)}
            >
              <span className="app-nav-mobile-icon" aria-hidden="true">{item.icon}</span>
              <span className="app-nav-mobile-label">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
