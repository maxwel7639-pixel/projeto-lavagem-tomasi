import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mx: {
          bg: "#050507",
          card: "#0D0D12",
          border: "#1D1D26",
          text: "#FFFFFF",
          muted: "#9090A0",
          soft: "#C4C4D0",
          roxo: "#6D5CF5",
          roxo2: "#8B7CF8",
          verde: "#2F9E6F",
        },
      },
    },
  },
  plugins: [],
};

export default config;
