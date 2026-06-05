// Banco de dados em memória temporário (RAM)
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