import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#eef3f8',
        panel: '#f9fbfd',
        ink: '#122033',
        muted: '#61748d',
        line: '#d5deea',
        brand: '#285ea8',
        accent: '#c6404a',
        brandSoft: '#dce9fb'
      },
      boxShadow: {
        shell: '0 20px 60px rgba(19, 36, 63, 0.12)',
        panel: '0 12px 32px rgba(35, 61, 98, 0.08)'
      },
      borderRadius: {
        xl2: '1.5rem'
      }
    }
  },
  plugins: []
};

export default config;
