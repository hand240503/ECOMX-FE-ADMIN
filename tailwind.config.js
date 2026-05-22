/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        tablet: '768px',
        desktop: '1024px',
        wide: '1280px',
      },
      maxWidth: {
        /** Khớp header/footer — tránh cột nội dung hẹp hơn thanh trên cùng */
        container: '1392px',
      },
      colors: {
        primary: {
          DEFAULT: '#1A94FF',
          dark: '#0E6FCC',
          light: '#E5F2FF',
        },
        secondary: {
          DEFAULT: '#FDD835',
          dark: '#FBC02D',
        },
        success: '#27AE60',
        danger: {
          DEFAULT: '#B91C1C',
          emphasis: '#7F1D1D',
        },
        warning: '#F39C12',
        border: '#E8E8E8',
        background: '#F5F5FA',
        surface: '#FFFFFF',
        text: {
          primary: '#27272A',
          secondary: '#6B6B6B',
          disabled: '#BDBDBD',
        },
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        heading: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '700' }],
        title: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgba(60,64,67,.1), 0 2px 6px 2px rgba(60,64,67,.15)',
        'hover': '0 4px 8px 0 rgba(60,64,67,.1), 0 4px 12px 4px rgba(60,64,67,.15)',
        'elevation-card': '0 2px 8px rgba(0,0,0,0.10)',
        'dropdown': '0 4px 16px rgba(0,0,0,0.12)',
        'header': '0 1px 4px rgba(0,0,0,0.08)',
      },
      zIndex: {
        header: '100',
        dropdown: '200',
        drawer: '300',
        modal: '400',
        toast: '500',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
    },
  },
  plugins: [],
}