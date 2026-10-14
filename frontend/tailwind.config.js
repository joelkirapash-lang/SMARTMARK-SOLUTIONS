const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
const scale = (p) => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, v(`${p}${s}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: scale("b"),
        accent: { 400: v("a400"), 500: v("a500"), 600: v("a600") },
        canvas: v("canvas"),
        side: v("side"),
        side2: v("side2"),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
      boxShadow: { soft: "0 1px 2px rgba(15,23,42,.05), 0 10px 28px -14px rgba(15,23,42,.18)" },
    },
  },
  plugins: [],
};
