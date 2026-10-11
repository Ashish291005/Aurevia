/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Cormorant Garamond"', "Georgia", "serif"],
        body: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        burgundy: { DEFAULT: "#4A0E1F", dark: "#2E0812" },
        gold: { DEFAULT: "#C5A059", hover: "#A57C4B" },
        cream: "#FCFCFA",
      },
    },
  },
  plugins: [],
};
