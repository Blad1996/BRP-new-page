/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './pages/**/*.html', './scripts/**/*.{html,mjs}', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        forest: '#1A2412',
        green: { DEFAULT: '#30462B', 600: '#3B5535' },
        sage: '#616A67',
        offwhite: '#F5F5F1',
        stone: '#ECEBE6',
        line: '#D9D8D1',
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: { site: '80rem' },
      letterSpacing: { tightest: '-0.035em' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
    },
  },
  plugins: [],
};
