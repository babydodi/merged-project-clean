/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
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
        minecraft: ['Minecraft', 'monospace'],
      },
    },
  },
  safelist: [
    // أضف هنا كلاسات اللاندينق اللي قد تُولَّد ديناميكياً
    'bg-[#141414]',
    'bg-white',
    'text-white',
    'border-[#2a2a2a]',
    'bg-black',
    'text-gray-400',
  ],
  plugins: [],
}
