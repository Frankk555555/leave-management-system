// frontend/tailwind.config.js

const defaultTheme = require('tailwindcss/defaultTheme'); 

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // เราบอกว่า ให้ใช้ 'Sarabun' เป็นฟอนต์หลักของกลุ่ม 'sans'
        // และให้เก็บฟอนต์มาตรฐานอื่นๆ ของ Tailwind ไว้เป็นตัวสำรอง
        sans: ['Sarabun', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}