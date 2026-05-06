import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Registrando o Service Worker para garantir que o K-Chirp "rasgue" o Android
// mesmo em segundo plano ou com a tela bloqueada.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[K-CHIRP] Service Worker registrado com sucesso: ', reg.scope);
      })
      .catch((err) => {
        console.error('[K-CHIRP] Falha ao registrar o Service Worker: ', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);