import { useState, useEffect, useRef } from 'react';

export default function useKChirp(userKey) {
  const [connectionState, setConnectionState] = useState('DISCONNECTED'); // DISCONNECTED, CONNECTING, CONNECTED, ERROR
  const [remoteStream, setRemoteStream] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const dataChannelRef = useRef(null);

  // Configuração padrão de servidores STUN públicos e gratuitos do Google
  // Essencial para furar o NAT das operadoras de celular e conectar os IPs direto
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // 1. Inicializar Hardware de Áudio (Microfone)
  const startAudio = async () => {
    try {
      if (!localStream.current) {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true, // Reduz o eco no viva-voz do Android
            noiseSuppression: true, // Limpa ruídos de fundo
            autoGainControl: true   // Ajusta o ganho do microfone dinamicamente
          },
          video: false
        });
      }
      return localStream.current;
    } catch (err) {
      console.error("[K-CHIRP] Erro ao acessar microfone:", err);
      setConnectionState('ERROR');
      throw err;
    }
  };

  // 2. Parar Hardware de Áudio e Liberar Microfone
  const stopAudio = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
  };

  // 3. Inicializar Conexão WebRTC (O Aperto de Mão P2P)
  const initPeerConnection = async (onMessageReceived) => {
    peerConnection.current = new RTCPeerConnection(rtcConfig);

    // Evento de monitoramento de estado da conexão física
    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current.connectionState.toUpperCase();
      setConnectionState(state);
      if (state === 'DISCONNECTED' || state === 'FAILED' || state === 'CLOSED') {
        cleanup();
      }
    };

    // Recebendo o fluxo de áudio do outro celular
    peerConnection.current.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        // Força a saída de áudio para o alto-falante externo (viva-voz) no Android
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(e => console.log("Erro ao reproduzir áudio recebido:", e));
      }
    };

    // Criando o canal de dados para textos efêmeros (Rastro Zero)
    // Usamos 'unordered' e 'maxRetransmits: 0' para simular protocolo UDP rápido
    dataChannelRef.current = peerConnection.current.createDataChannel("kchirp_data", {
      ordered: false,
      maxRetransmits: 0
    });

    setupDataChannel(dataChannelRef.current, onMessageReceived);

    // Ouvindo se o outro lado criar o canal de dados primeiro
    peerConnection.current.ondatachannel = (event) => {
      setupDataChannel(event.channel, onMessageReceived);
    };
  };

  // Configuração do Canal de Dados
  const setupDataChannel = (channel, onMessageReceived) => {
    channel.onopen = () => setDataChannel(channel);
    channel.onclose = () => setDataChannel(null);
    channel.onmessage = (event) => {
      if (onMessageReceived) {
        // Quando uma mensagem chega, ela é entregue para a UI
        onMessageReceived(event.data);
      }
    };
  };

  // 4. Disparar Chamado (Gerar Oferta SDP)
  const makeCall = async (targetKey, onMessageReceived) => {
    try {
      setConnectionState('CONNECTING');
      const stream = await startAudio();
      await initPeerConnection(onMessageReceived);

      // Adiciona nossa faixa de áudio para transmissão
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      // Cria a oferta criptografada de conexão
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      // Retorna a oferta para que a nossa API (Vercel Serverless) entregue ao destino
      return offer;
    } catch (err) {
      cleanup();
      throw err;
    }
  };

  // 5. Aceitar Chamado (Gerar Resposta SDP)
  const answerCall = async (offer, onMessageReceived) => {
    try {
      setConnectionState('CONNECTING');
      const stream = await startAudio();
      await initPeerConnection(onMessageReceived);

      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      // Define a oferta do chamador
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));

      // Cria a nossa resposta criptografada
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      // Retorna a resposta para entregar de volta ao chamador
      return answer;
    } catch (err) {
      cleanup();
      throw err;
    }
  };

  // 6. Enviar Mensagem de Texto Efêmera via P2P
  const sendDataMessage = (text) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(text);
      return true;
    }
    return false;
  };

  // 7. Desconectar e Limpar a RAM (Rastro Zero Absoluto)
  const cleanup = () => {
    stopAudio();

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setRemoteStream(null);
    setDataChannel(null);
    setConnectionState('DISCONNECTED');
    console.log("[K-CHIRP] Memória limpa e conexões encerradas.");
  };

  // Limpa tudo de forma proativa se o hook for desmontado da tela
  useEffect(() => {
    return () => cleanup();
  }, []);

  return {
    connectionState,
    remoteStream,
    makeCall,
    answerCall,
    sendDataMessage,
    disconnect: cleanup
  };
}