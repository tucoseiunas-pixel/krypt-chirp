import React, { useState, useEffect, useRef } from 'react';
import { Radio as RadioIcon, Mic, MicOff, MessageSquare, Send, Power } from 'lucide-react';

export default function Radio({ activeCall, onDisconnect, remoteStream, dataChannel, dataChannelRef }) {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90); // Limite de 90 segundos de chamada
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  // Sintetizador para simular o Chirp clássico do Nextel via Web Audio API
  const playNextelChirp = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const gainNode = audioCtx.createGain();
      gainNode.connect(audioCtx.destination);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      // Primeiro Bip (Mais grave)
      const osc1 = audioCtx.createOscillator();
      osc1.connect(gainNode);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(900, audioCtx.currentTime);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.08);

      // Segundo Bip imediato (Mais agudo e estalado)
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        osc2.connect(gainNode);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1400, audioCtx.currentTime);
        osc2.start(audioCtx.currentTime);
        osc2.stop(audioCtx.currentTime + 0.12);
      }, 80);

    } catch (e) {
      console.log("Erro ao reproduzir Chirp:", e);
    }
  };

  // Reproduzir áudio remoto quando receber stream
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      console.log('[Radio] Conectando remoteStream ao elemento audio');
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(err => console.error('[Audio] Erro ao reproduzir:', err));
    }
  }, [remoteStream]);

  // Efeito para tocar o Chirp no início da chamada (se for saída ou entrada)
  useEffect(() => {
    playNextelChirp();
    
    // Timer regressivo implacável de 90 segundos para derrubar a chamada
    const callTimer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(callTimer);
          playNextelChirp(); // Toca o bip para sinalizar encerramento
          onDisconnect(); // Derruba a chamada
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(callTimer);
  }, [onDisconnect]);

  // Rola o chat para o fim automaticamente ao chegar nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Escutar mensagens recebidas pelo DataChannel
  useEffect(() => {
    const dc = dataChannel || (dataChannelRef?.current);
    if (!dc) return;

    const handleMessage = (event) => {
      console.log('[DataChannel] Mensagem recebida:', event.data);
      const msgId = Date.now().toString();
      const newMsg = {
        id: msgId,
        text: event.data,
        sender: 'REMOTO',
        timer: 60
      };

      setMessages((prev) => [...prev, newMsg]);

      // Timer de autodestruição
      const msgTimer = setInterval(() => {
        setMessages((prev) => {
          const target = prev.find(m => m.id === msgId);
          if (target && target.timer <= 1) {
            clearInterval(msgTimer);
            return prev.filter(m => m.id !== msgId);
          }
          return prev.map(m => m.id === msgId ? { ...m, timer: m.timer - 1 } : m);
        });
      }, 1000);
    };

    dc.addEventListener('message', handleMessage);
    return () => dc.removeEventListener('message', handleMessage);
  }, [dataChannel, dataChannelRef]);

  // Enviar mensagem efêmera (Dura 60 segundos na memória)
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const msgText = inputText.trim().toUpperCase();
    let sent = false;

    // Usar dataChannelRef se disponível (mais confiável)
    const dc = dataChannel || (dataChannelRef?.current);
    
    if (dc) {
      console.log('[Radio] DataChannel disponível. readyState:', dc.readyState);
      
      if (dc.readyState === 'open') {
        try {
          dc.send(msgText);
          console.log('[DataChannel] Mensagem enviada com sucesso:', msgText);
          sent = true;
        } catch (err) {
          console.error('[DataChannel] Erro ao enviar:', err);
        }
      } else {
        console.warn('[DataChannel] Canal não está aberto. Estado:', dc.readyState);
        console.log('[DataChannel] Iniciando retry automático a cada 300ms...');
        
        // Retry com backoff exponencial
        let retries = 0;
        const retryInterval = setInterval(() => {
          if (sent) {
            clearInterval(retryInterval);
            return;
          }
          
          console.log('[DataChannel] Tentativa #' + (retries + 1), 'readyState:', dc.readyState);
          
          if (dc.readyState === 'open' && !sent) {
            try {
              dc.send(msgText);
              console.log('[DataChannel] Mensagem enviada (retry #' + retries + ')');
              sent = true;
              clearInterval(retryInterval);
            } catch (err) {
              console.error('[DataChannel] Erro no retry:', err);
            }
          }
          
          retries++;
          
          // Continuar tentando indefinidamente, mas log reduzido após 20 tentativas
          if (retries > 100) { // ~30 segundos
            console.error('[DataChannel] Falha - canal não abriu após 100 tentativas. readyState final:', dc.readyState);
            clearInterval(retryInterval);
          }
        }, 300);
      }
    } else {
      console.warn('[Radio] DataChannel é null/undefined');
    }

    // Exibir mensagem localmente MESMO SE NÃO FOI ENVIADA (para feedback do usuário)
    const msgId = Date.now().toString();
    const newMsg = {
      id: msgId,
      text: msgText,
      sender: 'VOCÊ',
      timer: 60,
      sent: sent
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Timer de autodestruição para esta mensagem específica
    const msgTimer = setInterval(() => {
      setMessages((prev) => {
        const target = prev.find(m => m.id === msgId);
        if (target && target.timer <= 1) {
          clearInterval(msgTimer);
          // Sobrescreve com array vazio na RAM para não deixar vestígio
          return prev.filter(m => m.id !== msgId);
        }
        return prev.map(m => m.id === msgId ? { ...m, timer: m.timer - 1 } : m);
      });
    }, 1000);
  };

  const toggleTransmission = () => {
    playNextelChirp();
    setIsTransmitting(!isTransmitting);
  };

  // Cálculo da barra laranja de tempo de chamada
  const percentageLeft = (timeLeft / 90) * 100;

  return (
    <div className="flex flex-col justify-between h-full space-y-4">
      
      {/* Elemento de áudio para reproduzir stream remoto (invisível) */}
      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline
        style={{ display: 'none' }}
      />
      
      {/* Indicador de Canal Ativo */}
      <div className="border border-radioactiveOrange bg-terminalGray/30 p-3 rounded shadow-orange-glow flex justify-between items-center">
        <div className="flex items-center gap-2">
          <RadioIcon className={`w-5 h-5 text-radioactiveOrange ${isTransmitting ? 'animate-pulse' : ''}`} />
          <div>
            <span className="text-[10px] text-radioactiveOrangeDim block">CONEXÃO P2P RASTRO ZERO</span>
            <span className="text-xs font-bold text-radioactiveOrange tracking-widest">
              CANAL: {activeCall?.target || "ESCUTA_ATIVA"}
            </span>
          </div>
        </div>
        <button 
          onClick={onDisconnect}
          className="p-2 border border-radioactiveOrange hover:bg-radioactiveOrange hover:text-oledBlack rounded transition-all active:scale-95 text-radioactiveOrange"
          title="Desconectar Linha"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>

      {/* Status do DataChannel */}
      <div className="border border-acidGreen/50 bg-acidGreen/10 p-2 rounded text-[10px] text-acidGreen">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${(dataChannel?.readyState === 'open' || dataChannelRef?.current?.readyState === 'open') ? 'bg-acidGreen animate-pulse' : 'bg-radioactiveOrange animate-pulse'}`} />
          <span className="font-mono">
            {(dataChannel?.readyState === 'open' || dataChannelRef?.current?.readyState === 'open') 
              ? '✓ TEXTO OK'
              : `⏳ TEXTO (${(dataChannelRef?.current?.readyState || 'aguardando')})`
            }
          </span>
        </div>
      </div>

      {/* Barra de Tempo de Linha (90 segundos de limite) */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-radioactiveOrange">
          <span>LIMITE DE SESSÃO P2P (MÁX 90S)</span>
          <span className="font-bold">{timeLeft}s restantes</span>
        </div>
        <div className="w-full bg-terminalGray h-2 rounded overflow-hidden border border-radioactiveOrangeDim">
          <div 
            className="bg-radioactiveOrange h-full transition-all duration-1000 shadow-orange-glow" 
            style={{ width: `${percentageLeft}%` }}
          ></div>
        </div>
      </div>

      {/* Chat de Texto Efêmero (Se autodestrói em 60 segundos) */}
      <div className="flex-1 min-h-[150px] border border-borderGray bg-terminalGray/10 rounded p-3 flex flex-col justify-between">
        <div className="overflow-y-auto space-y-2 flex-1 max-h-[180px] pr-1">
          {messages.length === 0 ? (
            <div className="text-center py-10 text-[10px] text-acidGreenDim italic">
              CONEXÃO DE TEXTO EFÊMERA (60S DE BUFFER NA RAM)
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="border-l-2 border-radioactiveOrange pl-2 py-1 bg-radioactiveOrangeDim/20 rounded-r">
                <div className="flex justify-between items-center text-[9px] text-radioactiveOrange">
                  <span className="font-bold">{msg.sender}</span>
                  <span className="font-mono">destrói em {msg.timer}s</span>
                </div>
                <p className="text-xs text-white font-mono mt-0.5">{msg.text}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de Envio de Texto */}
        <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-borderGray pt-2 mt-2">
          <input 
            type="text" 
            placeholder="MENSAGEM EFÊMERA..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-oledBlack border border-borderGray p-2 rounded text-xs text-acidGreen focus:border-acidGreen focus:outline-none"
          />
          <button 
            type="submit" 
            className="p-2 border border-acidGreen bg-acidGreenDim text-acidGreen rounded hover:bg-acidGreen hover:text-oledBlack transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Botão de Transmissão Principal (Nextel PTT) */}
      <div className="flex flex-col items-center justify-center py-4">
        <button
          onClick={toggleTransmission}
          className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center gap-2 transition-all duration-300 active:scale-95 ${
            isTransmitting 
              ? 'bg-radioactiveOrange border-radioactiveOrange text-oledBlack shadow-orange-glow animate-pulse-orange' 
              : 'bg-terminalGray border-acidGreen text-acidGreen shadow-green-glow animate-pulse-green'
          }`}
        >
          {isTransmitting ? (
            <>
              <Mic className="w-10 h-10 animate-bounce" />
              <span className="text-[10px] font-black tracking-widest uppercase">TRANSMITINDO</span>
            </>
          ) : (
            <>
              <MicOff className="w-10 h-10" />
              <span className="text-[10px] font-black tracking-widest uppercase">MUTADO / ESCUTA</span>
            </>
          )}
        </button>
        <span className="text-[9px] text-acidGreenDim mt-3 tracking-widest">
          {isTransmitting ? "SOLTE PARA OUVIR O RETORNO" : "CLIQUE PARA TRANSMITIR (CHIRP)"}
        </span>
      </div>

    </div>
  );
}