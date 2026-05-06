import React, { useState } from 'react';
import { PhoneOutgoing, Delete, Shield, Key } from 'lucide-react';

export default function Terminal({ userKey, onCall }) {
  const [targetKey, setTargetKey] = useState('');

  // Sintetizador de áudio simples (Web Audio API) para dar o som de bip retrô nos botões
  const playBeep = (freq, duration) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = freq; // Frequência em Hz
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); // Volume baixo para não estourar o ouvido
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.log("AudioContext bloqueado ou não suportado:", e);
    }
  };

  const handleKeyPress = (char) => {
    playBeep(880, 0.05); // Bip agudo rápido
    if (targetKey.length < 15) { // Limite do tamanho da chave
      setTargetKey(prev => prev + char);
    }
  };

  const handleDelete = () => {
    playBeep(440, 0.05); // Bip mais grave para erro/delete
    setTargetKey(prev => prev.slice(0, -1));
  };

  const handleCallSubmit = () => {
    if (targetKey.trim().length > 3) {
      playBeep(1200, 0.15); // Bip de sucesso/ativação
      onCall(targetKey.toUpperCase());
    } else {
      playBeep(220, 0.3); // Bip de erro
    }
  };

  return (
    <div className="flex flex-col justify-between h-full space-y-6">
      {/* Visor de Status do Terminal */}
      <div className="border border-acidGreenDim bg-terminalGray p-4 rounded shadow-green-glow">
        <div className="flex items-center justify-between border-b border-acidGreenDim pb-2 mb-2">
          <span className="text-xs font-bold tracking-widest flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-acidGreen animate-pulse" /> SYSTEM: ACTIVE
          </span>
          <span className="text-[10px] text-acidGreenDim">P2P_MODE_SECURE</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-acidGreenDim">ENDEREÇO DE HARDWARE:</span>
            <span className="font-bold">{userKey}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-acidGreenDim">REGRA DE RETENÇÃO:</span>
            <span className="text-radioactiveOrange font-bold">90 SEC MAX / RASTRO ZERO</span>
          </div>
        </div>
      </div>

      {/* Input de Destino */}
      <div className="flex flex-col space-y-2">
        <label className="text-xs text-acidGreenDim tracking-wider">[ INSIRA O ENDEREÇO DE DESTINO ]</label>
        <div className="relative flex items-center border border-acidGreen bg-oledBlack p-3 rounded text-xl font-bold tracking-widest text-center justify-center min-h-[56px] shadow-green-glow">
          {targetKey || <span className="text-acidGreenDim animate-pulse text-sm font-normal">DIGITE OU USE O TECLADO...</span>}
          {targetKey && (
            <button 
              onClick={handleDelete}
              className="absolute right-3 p-1 text-acidGreenDim hover:text-radioactiveOrange transition-colors"
            >
              <Delete className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Teclado Hexadecimal Retrô */}
      <div className="grid grid-cols-4 gap-2">
        {/* Números e letras hexadecimais para bater com o SHA-256 parcial */}
        {['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '-', '0', 'E', 'F'].map((char) => (
          <button
            key={char}
            onClick={() => handleKeyPress(char)}
            className="py-3 bg-terminalGray border border-borderGray rounded text-lg font-bold hover:bg-acidGreenDim hover:border-acidGreen hover:text-acidGreen hover:shadow-green-glow transition-all active:scale-95 duration-100"
          >
            {char}
          </button>
        ))}
      </div>

      {/* Botão de Disparo / Chamar */}
      <button
        onClick={handleCallSubmit}
        disabled={!targetKey}
        className={`w-full py-4 rounded font-bold text-sm tracking-widest uppercase border flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 ${
          targetKey 
            ? 'bg-radioactiveOrange border-radioactiveOrange text-oledBlack hover:bg-transparent hover:text-radioactiveOrange hover:shadow-orange-glow' 
            : 'bg-terminalGray border-borderGray text-gray-700 cursor-not-allowed'
        }`}
      >
        <PhoneOutgoing className="w-4 h-4" /> Iniciar Chamado (K-Chirp)
      </button>
    </div>
  );
}