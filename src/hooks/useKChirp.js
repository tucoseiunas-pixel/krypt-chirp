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
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      // Servidor TURN público (fallback para NAT)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
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
        if (data.sdp && data.action === 'incoming' && data.senderKey === contact.key) {
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
    
    // IMPORTANTE: Definir ondatachannel ANTES de qualquer operação
    pc.ondatachannel = (event) => {
      console.log('[WebRTC] DataChannel recebido:', event.channel.label);
      setupDataChannel(event.channel);
    };
    
    pc.ontrack = (e) => {
      console.log('[WebRTC] Track recebido:', e.track.kind);
      setRemoteStream(e.streams[0]);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] Candidate gerado:', event.candidate.candidate.substring(0, 50) + '...');
        // TODO: Enviar candidate para o servidor se implementado
      }
    };
    pc.onicecandidateerror = (event) => {
      console.error('[ICE Error]:', event.errorText);
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[ICE State]:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionState('CONNECTED');
      }
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        cleanup();
      }
    };
    peerConnection.current = pc;
    return pc;
  };

  // DISCAR (Enviar sinal para o Túnel)
  const startCall = async (targetKey) => {
    try {
      console.log('[K-CHIRP] Iniciando chamada para:', targetKey);
      setConnectionState('CONNECTING');
      const tunnelId = await getTunnelId(userKey, targetKey);
      console.log('[K-CHIRP] Túnel ID calculado:', tunnelId);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Media] Áudio local capturado:', stream.getTracks().length, 'tracks');
      localStream.current = stream;

      const pc = createPeerConnection(targetKey);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      console.log('[WebRTC] Tracks adicionados ao peer connection');

      const dc = pc.createDataChannel("kchirp-chat");
      setupDataChannel(dc);
      console.log('[DataChannel] Canal de dados criado');

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      console.log('[WebRTC] Oferta criada');
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Descrição local definida');

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
      console.log('[K-CHIRP] Oferta enviada para o servidor');

      // Polling de resposta no túnel
      const answerWait = setInterval(async () => {
        const res = await fetch(`/api/signal?userKey=${tunnelId}`);
        const data = await res.json();
        if (data.action === 'connected' && data.sdp) {
          console.log('[K-CHIRP] Resposta recebida! Conectando ao peer...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          clearInterval(answerWait);
          console.log('[WebRTC] Descrição remota definida');
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
      console.log('[K-CHIRP] Aceitando chamada de:', incomingCall.senderKey);
      setConnectionState('CONNECTING');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Media] Áudio local capturado');
      localStream.current = stream;

      const pc = createPeerConnection(incomingCall.senderKey);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      console.log('[WebRTC] Tracks adicionados ao peer connection');

      console.log('[WebRTC] Definindo descrição remota da oferta recebida');
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.sdp));
      
      const answer = await pc.createAnswer();
      console.log('[WebRTC] Resposta criada');
      await pc.setLocalDescription(answer);
      console.log('[WebRTC] Descrição local definida');

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
      console.log('[K-CHIRP] Resposta enviada para o servidor');

      setIncomingCall(null);
    } catch (err) {
      console.error('[K-CHIRP] Erro ao aceitar chamada:', err);
      cleanup();
    }
  };

  const setupDataChannel = (dc) => {
    console.log('[DataChannel] Configurando canal:', dc.label, 'Estado:', dc.readyState);
    
    // Guardar referência IMEDIATAMENTE
    dataChannelRef.current = dc;
    
    dc.onopen = () => {
      console.log('[DataChannel] Canal ABERTO! readyState:', dc.readyState);
      setDataChannel(dc);
    };
    
    dc.onclose = () => {
      console.log('[DataChannel] Canal FECHADO');
      setDataChannel(null);
    };
    
    dc.onerror = (error) => {
      console.error('[DataChannel Error]:', error);
    };
    
    dc.onmessage = (e) => {
      console.log('[DataChannel] Mensagem recebida:', e.data);
    };
    
    // Se já estiver open, disparar manualmente
    if (dc.readyState === 'open') {
      console.log('[DataChannel] Canal já está OPEN! Atualizando state...');
      setDataChannel(dc);
    }
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
    localStream: localStream.current,
    dataChannel,
    dataChannelRef,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall: () => setIncomingCall(null),
    cleanup
  };
}