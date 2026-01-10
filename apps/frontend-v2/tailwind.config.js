/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          900: "#18181B", // Card/Surface
          950: "#0F1011", // Primary Background
        },
        flash: {
          white: "#FFFFFF",
          text: "#000000",
        },
        mist: {
          100: "#F4F4F5", // Primary Headings
          400: "#A1A1AA", // Body Text
        },
        aurora: {
          teal: "#14B8A6",
          purple: "#8B5CF6",
        },
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        sans: ["Manrope", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
