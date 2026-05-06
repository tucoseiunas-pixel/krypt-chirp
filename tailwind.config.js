/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oledBlack: "#050505",       // Fundo absoluto OLED
        acidGreen: "#39FF14",       // Verde fósforo ativo
        acidGreenDim: "rgba(57, 255, 20, 0.15)",
        radioactiveOrange: "#FF5F1F", // Laranja de transmissão e alerta
        radioactiveOrangeDim: "rgba(255, 95, 31, 0.15)",
        terminalGray: "#121212",    // Base de painéis internos
        borderGray: "#222222"       // Divisórias discretas
      },
      boxShadow: {
        'green-glow': '0 0 15px rgba(57, 255, 20, 0.4)',
        'orange-glow': '0 0 15px rgba(255, 95, 31, 0.4)',
      },
      fontFamily: {
        mono: ['Courier New', 'Courier', 'monospace'],
      }
    },
  },
  plugins: [],
}