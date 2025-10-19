/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FA5A0A',
        secondary: '#21242A',
        'text-light': '#F8F9FA',
        'text-dark': '#343A40',
      },
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
        minecraft: ['Minecraft', 'monospace'], // ← خط ماينكرافت
      },
    },
  },
  plugins: [],
}
