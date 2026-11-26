/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F3F9FD',
        berry: { DEFAULT: '#D7193A', soft: '#FDE4E8', dark: '#AE0F2B' },
        sage: { DEFAULT: '#4F9BD0', soft: '#E1F0FA', dark: '#2873AB' },
        butter: { DEFAULT: '#9CD2F0', soft: '#E9F6FD' },
        cocoa: { DEFAULT: '#22395A', soft: '#7A8DA8', line: '#CFE4F2' },
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
