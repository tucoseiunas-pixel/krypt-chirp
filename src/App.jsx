import React, { useState, useEffect } from 'react';
import Terminal from './components/Terminal';
import Agenda from './components/Agenda';
import Radio from './components/Radio';
import useKChirp from './hooks/useKChirp';

export default function App() {
const [acceptedTerms, setAcceptedTerms] = useState(false);
const [currentTab, setCurrentTab] = useState('terminal'); // 'terminal', 'agenda', 'radio'
const [activeCall, setActiveCall] = useState(null); // Armazena dados se houver chamada ativa
const [userKey, setUserKey] = useState('');
const [targetKey, setTargetKey] = useState(''); // Estado para o endereço de destino

// Simula a geração do SHA-256 do hardware no primeiro acesso
useEffect(() => {
const terms = localStorage.getItem('kchirp_terms_accepted');
if (terms === 'true') {
setAcceptedTerms(true);
}

let savedKey = localStorage.getItem('kchirp_device_key');
if (!savedKey) {
const array = new Uint8Array(16);
window.crypto.getRandomValues(array);
savedKey = "K-" + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 12).toUpperCase();
localStorage.setItem('kchirp_device_key', savedKey);
}
setUserKey(savedKey);
}, []);

// Inicializa o nosso hook de P2P WebRTC conectando ao endereço local
const { connectionState, makeCall, answerCall, disconnect, incomingCall  } = useKChirp(userKey);

// Monitora o estado da conexão para ajustar a navegação de forma reativa
useEffect(() => {
if (connectionState === 'CONNECTED' && currentTab !== 'radio') {
setCurrentTab('radio');
} else if (connectionState === 'DISCONNECTED' && currentTab === 'radio') {
setActiveCall(null);
setCurrentTab('terminal');
}
}, [connectionState, currentTab]);

// LOGICA DE RECEPÇÃO: Escuta sinais de chamada e valida contra a agenda local
useEffect(() => {
  if (incomingCall && connectionState === 'DISCONNECTED') {
    // 1. Recuperar agenda local para verificação de segurança (P2P White-list)
    const agendaSalva = localStorage.getItem('kchirp_local_contacts');
    const contatos = agendaSalva ? JSON.parse(agendaSalva) : [];
    
    // 2. Verificar se a chave de origem (quem está ligando) está autorizada na agenda
    const contatoAutorizado = contatos.find(c => c.key === incomingCall.from);

    if (contatoAutorizado) {
      console.log(`[P2P] Chamada autorizada detectada de: ${contatoAutorizado.name}`);
      setActiveCall({ target: incomingCall.from, type: 'incoming' });
      setCurrentTab('radio');
      // 3. Responder ao sinal WebRTC (Envia o SDP Answer de volta)
      answerCall();
    } else {
      console.warn(`[P2P] Chamada ignorada: Chave ${incomingCall.from} não consta na agenda local.`);
    }
  }
}, [incomingCall, connectionState, answerCall]);

const handleAcceptTerms = () => {
localStorage.setItem('kchirp_terms_accepted', 'true');
setAcceptedTerms(true);
};

const handleStartCall = async (targetKey) => {
setActiveCall({ target: targetKey, type: 'outgoing' });
setCurrentTab('radio');
try {
// Dispara a oferta WebRTC. Em produção, isso seria enviado via fetch para api/signal.js
await makeCall(targetKey, (incomingMessage) => {
console.log("Mensagem de texto P2P recebida no canal de dados:", incomingMessage);
});
} catch (err) {
console.error("Erro ao iniciar chamada:", err);
handleDisconnect();
}
};

const handleDisconnect = () => {
disconnect();
setActiveCall(null);
setCurrentTab('terminal');
};

if (!acceptedTerms) {
return (
<div className="flex flex-col justify-between min-h-screen p-6 max-w-md mx-auto text-center border border-acidGreenDim my-2 rounded-lg bg-oledBlack shadow-green-glow">
<div className="mt-6">
<h1 className="text-3xl font-bold tracking-widest text-acidGreen animate-pulse">K-CHIRP</h1>
<p className="text-xs text-acidGreenDim mt-2">V1.0.0 // PROTOCOLO FANTASMA P2P</p>
</div>

<div className="my-auto space-y-6 text-left text-sm max-h-[60vh] overflow-y-auto pr-2">
<div className="border-l-2 border-radioactiveOrange pl-3 py-1 bg-radioactiveOrangeDim text-radioactiveOrange">
<span className="font-bold">[!] REQUISITO ETÁRIO</span>
<p className="text-xs mt-1">Este utilitário exige idade superior a 18 anos. Caso seja menor, o proprietário legal do dispositivo assume total responsabilidade civil por suas transmissões.</p>
</div>

<div className="border-l-2 border-acidGreen pl-3 py-1 bg-acidGreenDim text-acidGreen">
<span className="font-bold">[i] POLÍTICA DE RASTRO ZERO</span>
<p className="text-xs mt-1">Nenhum dado é coletado, monitorado ou armazenado de forma centralizada. A comunicação de áudio utiliza criptografia nativa WebRTC ponta-a-ponta (P2P).</p>
</div>

<div className="border border-borderGray p-3 bg-terminalGray rounded text-xs text-gray-400 leading-relaxed">
<p className="font-bold mb-2 text-acidGreen">TERMO DE RESPONSABILIDADE:</p>
Ao prosseguir, você declara estar ciente de que as chaves de comunicação são temporárias e geradas localmente. O K-Chirp não armazena logs de chamadas e não possui recursos de recuperação de dados ou moderação de uso.
</div>
</div>

<button 
onClick={handleAcceptTerms}
className="w-full py-4 bg-acidGreen hover:bg-transparent hover:text-acidGreen text-oledBlack font-bold border border-acidGreen rounded transition-all duration-300 shadow-green-glow text-sm tracking-wider uppercase"
>
Aceitar Termos e Inicializar
</button>
</div>
);
}

return (
<div className="flex flex-col h-screen w-full max-w-md mx-auto border-x border-borderGray bg-oledBlack text-acidGreen overflow-hidden">

{/* Header Fixo - Sem encolher */}
<header className="p-4 border-b border-borderGray flex justify-between items-center bg-terminalGray shrink-0">
<div>
<span className="text-xs text-acidGreenDim">STBY // KEY:</span>
<p className="text-sm font-bold text-acidGreen">{userKey}</p>
</div>
<div className="flex items-center gap-2">
{connectionState === 'CONNECTED' ? (
<span className="w-2.5 h-2.5 rounded-full bg-radioactiveOrange animate-ping shadow-orange-glow"></span>
) : (
<span className="w-2.5 h-2.5 rounded-full bg-acidGreen animate-pulse shadow-green-glow"></span>
)}
<span className="text-xs tracking-widest text-acidGreen font-bold">
{connectionState === 'CONNECTED' ? 'TX_ON' : 'K-CHIRP'}
</span>
</div>
</header>

    {/* Conteúdo Dinâmico - Flex cresce e gerencia rolagem própria se necessário */}
    <main className="flex-1 overflow-y-auto p-3 flex flex-col justify-start">
      {currentTab === 'terminal' && (
        <Terminal 
          userKey={userKey} 
          onCall={handleStartCall}
          targetKey={targetKey}
          setTargetKey={setTargetKey}
        />
      )}
{currentTab === 'agenda' && (
  <Agenda 
    onSelectContact={(key) => {
      setTargetKey(key);          // Define a chave do destino globalmente
      handleStartCall(key);       // Dispara a chamada WebRTC automaticamente
    }} 
  />
)}
      {currentTab === 'radio' && (
        <Radio 
          activeCall={activeCall} 
          onDisconnect={handleDisconnect} 
        />
      )}
    </main>

    {/* Footer / Abas de Navegação - Sem encolher e travado na base */}
    <nav className="border-t border-borderGray grid grid-cols-3 bg-terminalGray text-center text-xs shrink-0">
      <button 
        onClick={() => setCurrentTab('terminal')}
        className={`py-4 border-r border-borderGray tracking-widest transition-all ${
          currentTab === 'terminal' 
            ? 'text-acidGreen bg-oledBlack border-t-2 border-t-acidGreen font-bold' 
            : 'text-acidGreenDim hover:text-acidGreen'
        }`}
      >
        [ TERMINAL ]
      </button>
      <button 
        onClick={() => setCurrentTab('agenda')}
        className={`py-4 border-r border-borderGray tracking-widest transition-all ${
          currentTab === 'agenda' 
            ? 'text-acidGreen bg-oledBlack border-t-2 border-t-acidGreen font-bold' 
            : 'text-acidGreenDim hover:text-acidGreen'
        }`}
      >
        [ AGENDA ]
      </button>
      <button 
        onClick={() => setCurrentTab('radio')}
        className={`py-4 tracking-widest transition-all ${
          currentTab === 'radio' 
            ? 'text-radioactiveOrange bg-oledBlack border-t-2 border-t-radioactiveOrange font-bold' 
            : 'text-acidGreenDim hover:text-acidGreen'
        }`}
      >
        [ RÁDIO ]
      </button>
    </nav>

</div>
);
}