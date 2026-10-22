/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cricket: {
          dark: '#0a0d14',
          card: '#121824',
          surface: '#182030',
          hover: '#1f2a3f',
          border: '#26334a',
          accent: '#00d2ff',
          live: '#ff3366',
          green: '#00e676',
          gold: '#ffb300',
        }
      }
    },
  },
  plugins: [],
}
