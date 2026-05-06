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
}