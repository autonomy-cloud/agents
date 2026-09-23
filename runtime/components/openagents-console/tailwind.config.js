const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");
const shades = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
];
const colorList = [
  "gray",
  "green",
  "cyan",
  "amber",
  "violet",
  "blue",
  "rose",
  "pink",
  "teal",
  "red",
];
const uiElements = [
  "bg",
  "selection:bg",
  "border",
  "text",
  "hover:bg",
  "hover:border",
  "hover:text",
  "ring",
  "focus:ring",
];
const customColors = {
  cyan: colors.cyan,
  green: colors.green,
  amber: colors.amber,
  violet: colors.violet,
  blue: colors.blue,
  rose: colors.rose,
  pink: colors.pink,
  teal: colors.teal,
  red: colors.red,
};

let customShadows = {};
let shadowNames = [];
let textShadows = {};
let textShadowNames = [];

for (const [name, color] of Object.entries(customColors)) {
  customShadows[`${name}`] = `0px 0px 10px ${color["500"]}`;
  customShadows[`lg-${name}`] = `0px 0px 20px ${color["600"]}`;
  textShadows[`${name}`] = `0px 0px 4px ${color["700"]}`;
  textShadowNames.push(`drop-shadow-${name}`);
  shadowNames.push(`shadow-${name}`);
  shadowNames.push(`shadow-lg-${name}`);
  shadowNames.push(`hover:shadow-${name}`);
}

const safelist = [
  "bg-black",
  "bg-white",
  "transparent",
  "object-cover",
  "object-contain",
  ...shadowNames,
  ...textShadowNames,
  ...shades.flatMap((shade) => [
    ...colorList.flatMap((color) => [
      ...uiElements.flatMap((element) => [
        `${element}-${color}-${shade}`,
        // Also safelist the dark: variant of every dynamically-built accent
        // color class (e.g. `bg-${accentColor}-950`), since Tailwind's JIT
        // content scanner can't statically see class names built from JS
        // template literals — these are used across the light/dark theme
        // treatment of the user-selectable accent color.
        `dark:${element}-${color}-${shade}`,
      ]),
    ]),
  ]),
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: colors.black,
      white: colors.white,
      gray: colors.neutral,
      ...customColors,
    },
    extend: {
      // Neutral elevation scale for the app's "surface" chrome (cards, tiles,
      // panels). Kept separate from the accent color list above so the
      // user-selectable theme colors are untouched.
      colors: {
        surface: {
          0: "#0a0a0c", // page background
          1: "#131317", // resting card / tile surface
          2: "#1b1b20", // raised surface / hover state
          3: "#232329", // further raised (inputs, chips)
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        card: "1rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.6)",
        elevated:
          "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 24px 48px -20px rgba(0,0,0,0.7)",
        ...customShadows,
      },
      dropShadow: {
        ...textShadows,
      },
      keyframes: {
        "fade-in-out": {
          "0%": { opacity: "0" },
          "20%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "fade-in-out": "fade-in-out 1s ease-in-out",
      },
    },
  },
  plugins: [],
  safelist,
};
