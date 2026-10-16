import plugin from "tailwindcss/plugin";
import colors from "tailwindcss/colors";

const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
const scale = (p) => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, v(`${p}${s}`)]));
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const FLIPPED = ["slate", "emerald", "rose", "amber", "sky", "violet", "blue", "cyan", "fuchsia", "indigo"];
// Dark mode: slate is fully inverted (text, borders, tracks). Tinted palettes swap only their pale
// tints with their deep shades, so badges and alerts stay readable. 400-600 never change.
const SLATE_DARK = { 50: 950, 100: 800, 200: 700, 300: 600, 400: 500, 500: 400, 600: 300, 700: 200, 800: 100, 900: 50, 950: 50 };
const TINT_DARK = { 50: 950, 100: 900, 200: 800, 700: 200, 800: 100, 900: 50 };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`; };

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: scale("b"),
        accent: { 400: v("a400"), 500: v("a500"), 600: v("a600") },
        canvas: v("canvas"), surface: v("surface"), side: v("side"), side2: v("side2"), brandtext: v("btext"),
        ...Object.fromEntries(FLIPPED.map((n) => [n, Object.fromEntries(SHADES.map((s) => [s, v(`${n}-${s}`)]))])),
      },
      fontFamily: { display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"], sans: ["Figtree", "system-ui", "sans-serif"] },
      boxShadow: { soft: "0 1px 2px rgba(15,23,42,.05), 0 10px 28px -14px rgba(15,23,42,.18)" },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      const light = { "--surface": "255 255 255" };
      const dark = { "--surface": "17 24 39" };
      FLIPPED.forEach((n) => SHADES.forEach((s) => {
        light[`--${n}-${s}`] = rgb(colors[n][s]);
        const src = (n === "slate" ? SLATE_DARK : TINT_DARK)[s] ?? s;
        dark[`--${n}-${s}`] = rgb(colors[n][src]);
      }));
      addBase({ ":root": light, "html.dark": dark });
    }),
  ],
};
