// api/signal.js

// Banco de dados em memória temporário para o "aperto de mão" (handshake) do WebRTC
// Como a Vercel pode reciclar os containers, esse objeto serve para conexões rápidas de até alguns segundos.
let activeHandshakes = {};

export default async function handler(req, res) {
  // CORS Headers para permitir conexões de qualquer cliente K-Chirp
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method } = req;

  if (method === 'POST') {
    const { action, senderKey, targetKey, sdp } = req.body;

    // Ação 1: Registrar Oferta (Quem está ligando)
    if (action === 'call') {
      activeHandshakes[targetKey] = {
        sender: senderKey,
        offer: sdp,
        timestamp: Date.now()
      };
      return res.status(200).json({ success: true, message: "Chamado registrado. Aguardando destinatário." });
    }

    // Ação 2: Responder Chamado (Quem está atendendo)
    if (action === 'answer') {
      if (activeHandshakes[userKey]) {
        activeHandshakes[userKey].answer = sdp;
        return res.status(200).json({ success: true });
      }
      return res.status(404).json({ error: "Chamado expirado ou não encontrado." });
    }
  }

  if (req.method === 'GET') {
    const { userKey } = req.query;

    // Limpeza periódica de handshakes com mais de 30 segundos (Rastro Zero / Vazamento de RAM)
    const now = Date.now();
    Object.keys(activeHandshakes).forEach(key => {
      if (now - activeHandshakes[key].timestamp > 30000) {
        delete activeHandshakes[key];
      }
    });

    // Verifica se há alguma oferta de chamada pendente para este usuário
    if (activeHandshakes[userKey]) {
      const data = activeHandshakes[userKey];
      
      // Se o destinatário já respondeu, entregamos a resposta de volta ao chamador e destruímos o rastro
      if (data.sender === userKey && data.answer) {
        const response = { sdp: data.answer, action: 'connected' };
        delete activeHandshakes[userKey]; // Destruição instantânea do rastro
        return res.status(200).json(response);
      }

      // Se há apenas uma oferta de chamada recebida do amigo
      if (data.sender !== userKey && !data.answer) {
        return res.status(200).json({ sdp: data.offer, action: 'incoming', sender: data.sender });
      }
    }

    return res.status(200).json({ action: 'idle' });
  }

  return res.status(405).json({ error: "Método não permitido." });
}// Banco de dados em memória temporário (RAM)
let activeTunnels = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Limpeza de túneis mortos (mais de 30 segundos) para evitar vazamento de RAM
  const now = Date.now();
  Object.keys(activeTunnels).forEach(id => {
    if (now - activeTunnels[id].timestamp > 30000) delete activeTunnels[id];
  });

  if (req.method === 'POST') {
    const { action, senderKey, targetKey, sdp } = req.body;
    // Aqui, 'targetKey' é o hash do túnel (tunnelId) enviado pelo useKChirp

    if (action === 'call') {
      activeTunnels[targetKey] = {
        sender: senderKey,
        offer: sdp,
        timestamp: now
      };
      return res.status(200).json({ success: true });
    }

    if (action === 'answer') {
      if (activeTunnels[targetKey]) {
        activeTunnels[targetKey].answer = sdp;
        return res.status(200).json({ success: true });
      }
      return res.status(404).json({ error: "Túnel expirado." });
    }
  }

  if (req.method === 'GET') {
    const { userKey } = req.query; // Aqui userKey é o tunnelId que o rádio está a espiar

    if (activeTunnels[userKey]) {
      const data = activeTunnels[userKey];

      // Se o iniciador da chamada (sender) está a perguntar, ele quer o 'answer'
      if (data.sender === req.query.originalSenderKey && data.answer) {
        const response = { sdp: data.answer, action: 'connected' };
        delete activeTunnels[userKey]; // Destruição imediata após conexão
        return res.status(200).json(response);
      }

      // Se quem está a espiar não é o sender, então é o destinatário a receber o 'offer's
      if (data.sender !== req.query.originalSenderKey && !data.answer) {
        return res.status(200).json({ sdp: data.offer, senderKey: data.sender, action: 'call' });
      }
    }

    return res.status(200).json({ message: "Silêncio no túnel..." });
  }
}