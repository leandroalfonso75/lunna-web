import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
    './app/error.vue'
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-soft': 'var(--primary-soft)',
        'primary-ink': 'var(--primary-ink)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-ink': 'var(--accent-ink)',
        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
        warning: 'var(--warning)',
        'warning-soft': 'var(--warning-soft)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        info: 'var(--info)',
        'info-soft': 'var(--info-soft)',
        // gráficos (27/11/2026): azul da marca + laranja, validados para daltonismo nos dois temas
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-grid': 'var(--chart-grid)',
        'nav-bg': 'var(--nav-bg)',
        'nav-ink': 'var(--nav-ink)',
        'nav-ink-2': 'var(--nav-ink-2)',
        'nav-hover': 'var(--nav-hover)',
        'nav-active': 'var(--nav-active)'
      },
      borderRadius: {
        card: '10px',
        panel: '14px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 24, 41, 0.06)',
        panel: '0 1px 2px rgba(20, 24, 41, 0.04), 0 4px 16px -6px rgba(20, 24, 41, 0.10)',
        lift: '0 10px 30px -10px rgba(20, 24, 41, 0.25)'
      },
      maxWidth: {
        content: '1440px'
      }
    }
  },
  plugins: []
}
