import { useState, useEffect, useRef, useCallback } from 'react';

export default function useKChirp(userKey) {
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [remoteStream, setRemoteStream] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const dataChannelRef = useRef(null);
  const pollingRef = useRef(null);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // --- FUNÇÃO CORE: GERAÇÃO DO ENDEREÇO DO TÚNEL P2P ---
  // Cria um hash único que só quem tem as duas chaves consegue gerar.
  const getTunnelId = async (keyA, keyB) => {
    const combined = [keyA, keyB].sort().join('_'); // Ordem alfabética garante o mesmo ID em ambos os lados
    const msgBuffer = new TextEncoder().encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  };

  // --- ESCUTA PASSIVA (O MONITOR DE TÚNEIS) ---
  const monitorActiveTunnels = useCallback(async () => {
    if (!userKey || connectionState !== 'DISCONNECTED') return;

    const agenda = JSON.parse(localStorage.getItem('kchirp_local_contacts') || '[]');
    
    // Varre cada contato da agenda procurando um sinal no túnel correspondente
    for (const contact of agenda) {
      try {
        const tunnelId = await getTunnelId(userKey, contact.key);
        const res = await fetch(`/api/signal?userKey=${tunnelId}`);
        const data = await res.json();

        // Se houver um 'call' vindo especificamente desse contato no túnel secreto
        if (data.sdp && data.action === 'call' && data.senderKey === contact.key) {
          setIncomingCall({
            senderKey: contact.key,
            senderName: contact.name,
            sdp: data.sdp,
            tunnelId: tunnelId
          });
          break; // Para na primeira chamada encontrada
        }
      } catch (err) {
        // Silencioso: Túnel vazio ou offline
      }
    }
  }, [userKey, connectionState]);

  useEffect(() => {
    if (userKey && connectionState === 'DISCONNECTED') {
      pollingRef.current = setInterval(monitorActiveTunnels, 3500);
    }
    return () => clearInterval(pollingRef.current);
  }, [userKey, connectionState, monitorActiveTunnels]);

  // --- LÓGICA DE CONEXÃO (HANDSHAKE) ---

  const createPeerConnection = (targetKey) => {
    const pc = new RTCPeerConnection(rtcConfig);
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') setConnectionState('CONNECTED');
      if (pc.iceConnectionState === 'disconnected') cleanup();
    };
    peerConnection.current = pc;
    return pc;
  };

  // DISCAR (Enviar sinal para o Túnel)
  const startCall = async (targetKey) => {
    try {
      setConnectionState('CONNECTING');
      const tunnelId = await getTunnelId(userKey, targetKey);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;

      const pc = createPeerConnection(targetKey);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("kchirp-chat");
      setupDataChannel(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Publica a oferta no endereço do túnel
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'call',
          senderKey: userKey,
          targetKey: tunnelId, // O alvo é o endereço matemático do túnel
          sdp: pc.localDescription
        })
      });

      // Polling de resposta no túnel
      const answerWait = setInterval(async () => {
        const res = await fetch(`/api/signal?userKey=${tunnelId}`);
        const data = await res.json();
        if (data.action === 'connected' && data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          clearInterval(answerWait);
        }
      }, 2000);

    } catch (err) {
      cleanup();
      console.error("Falha ao iniciar rádio:", err);
    }
  };

  // ATENDER (Responder no Túnel)
  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      setConnectionState('CONNECTING');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;

      const pc = createPeerConnection(incomingCall.senderKey);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.ondatachannel = (e) => setupDataChannel(e.channel);

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Envia resposta para o túnel
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          targetKey: incomingCall.tunnelId,
          sdp: pc.localDescription
        })
      });

      setIncomingCall(null);
    } catch (err) {
      cleanup();
    }
  };

  const setupDataChannel = (dc) => {
    dc.onmessage = (e) => setDataChannel(e.data);
    dc.onopen = () => setDataChannel(dc);
    dataChannelRef.current = dc;
  };

  const cleanup = () => {
    if (peerConnection.current) peerConnection.current.close();
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    setConnectionState('DISCONNECTED');
    setRemoteStream(null);
    setDataChannel(null);
    setIncomingCall(null);
  };

  return {
    connectionState,
    remoteStream,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall: () => setIncomingCall(null),
    cleanup
  };
}