import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ブランドカラー（2026-09-22 LPデザイン刷新時に追加）。
        // docs/screens/top-page-design.md 7章と Penpot「LP」ページの Tailwind/Colors トークンに準拠。
        navy: {
          50: '#F0F4FA',
          100: '#DCE5F2',
          200: '#B9CBE6',
          300: '#8FACD4',
          400: '#5E85BA',
          500: '#3D65A0',
          600: '#2C4C82',
          700: '#1B3A6B',
          800: '#122A52',
          900: '#0B1E3D',
          950: '#081530',
        },
      },
    },
  },
  plugins: [],
}

export default config
