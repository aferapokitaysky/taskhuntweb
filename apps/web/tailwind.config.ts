import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Тёплая терракотовая — акцент вместо прежнего индиго. Держим
        // одно имя `brand`, чтобы не переименовывать все использования
        // по кодовой базе — меняется только палитра под ним.
        brand: {
          DEFAULT: '#CC785C',
          dark: '#B35F44',
          light: '#E3A98C',
        },
        cream: {
          DEFAULT: '#F7F4EE',
          50: '#FDFCFA',
          100: '#F7F4EE',
          200: '#F0EBE0',
        },
        // Пастельные фоны для иллюстрированных карточек — намеренно
        // приглушённые (не кислотные), чтобы уживались с terracotta-акцентом.
        card: {
          lavender: '#D7D5E8',
          rose: '#E8D6D6',
          sage: '#C7D3C9',
          olive: '#8B9A72',
          sand: '#EDE1CE',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(-6deg) scale(1.05)' },
          '75%': { transform: 'rotate(6deg) scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'loading-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        wiggle: 'wiggle 0.5s ease-in-out',
        float: 'float 3s ease-in-out infinite',
        'loading-bar': 'loading-bar 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
