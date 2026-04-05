import type { BankTheme, ThemeColors } from '../types';

export const DEFAULT_THEME: BankTheme = {
  key: 'DEFAULT',
  name: 'Los Santos Banking',
  subtitle: 'Online Banking',
  contextLabel: 'Bank',
  location: '',
  logo: '',
  colors: {
    bg: '#050505',
    bg2: '#0c0c0c',
    surface: 'rgba(255, 255, 255, 0.035)',
    surface2: 'rgba(255, 255, 255, 0.02)',
    card: 'rgba(14, 14, 14, 0.94)',
    border: 'rgba(255, 255, 255, 0.09)',
    text: '#e5e7eb',
    textMuted: '#9ca3af',
    textSoft: '#6b7280',
    accent: '#f472b6',
    accent2: '#db2777',
    accentContrast: '#ffffff',
    glow: 'rgba(244, 114, 182, 0.32)',
    danger: '#fb7185',
    warning: '#fbbf24',
    flowRingOut: 'rgba(251, 113, 133, 0.28)',
  },
};

export function mergeTheme(
  base: BankTheme,
  incoming: Partial<BankTheme>,
): BankTheme {
  const incomingColors =
    incoming.colors && typeof incoming.colors === 'object'
      ? incoming.colors
      : ({} as Partial<ThemeColors>);
  return {
    ...base,
    ...incoming,
    colors: { ...base.colors, ...incomingColors },
  };
}

export function applyThemeCssVars(theme: BankTheme): void {
  const c = theme.colors;
  const vars: Record<string, string> = {
    '--rb-bg': c.bg,
    '--rb-bg-2': c.bg2,
    '--rb-surface': c.surface,
    '--rb-surface-2': c.surface2,
    '--rb-card': c.card,
    '--rb-border': c.border,
    '--rb-text': c.text,
    '--rb-text-muted': c.textMuted,
    '--rb-text-soft': c.textSoft,
    '--rb-accent': c.accent,
    '--rb-accent-2': c.accent2,
    '--rb-accent-contrast': c.accentContrast,
    '--rb-glow': c.glow,
    '--rb-danger': c.danger,
    '--rb-warning': c.warning,
    '--rb-flow-out': c.flowRingOut ?? 'rgba(251, 113, 133, 0.28)',
  };
  for (const [key, value] of Object.entries(vars)) {
    if (value) document.documentElement.style.setProperty(key, value);
  }
}
