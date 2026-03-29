/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        void: '#070a12',
        ink: '#0e1424',
        mist: '#1a2338',
        accent: '#2ee6d6',
        accentDim: '#1fa89c',
        flare: '#a78bfa',
        warn: '#fbbf24',
        danger: '#fb7185',
      },
      backgroundImage: {
        'grid-radial':
          'radial-gradient(ellipse 80% 60% at 50% -30%, rgba(46,230,214,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(167,139,250,0.12), transparent)',
        mesh: 'linear-gradient(135deg, rgba(46,230,214,0.06) 0%, transparent 50%), linear-gradient(225deg, rgba(167,139,250,0.05) 0%, transparent 40%)',
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(46, 230, 214, 0.35)',
        card: '0 4px 40px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
