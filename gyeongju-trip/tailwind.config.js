/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF9F0',
        berry: { DEFAULT: '#D97870', soft: '#F6DEDA', dark: '#B85E57' },
        sage: { DEFAULT: '#9BAE91', soft: '#E4EBDF', dark: '#6F8466' },
        butter: { DEFAULT: '#F2D88B', soft: '#FBF1D2' },
        cocoa: { DEFAULT: '#65564B', soft: '#A39588', line: '#EADFD3' },
      },
      fontFamily: {
        hand: ['Gaegu', 'cursive'],
        body: ['"Gowun Dodum"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '22px' },
    },
  },
  plugins: [],
};
