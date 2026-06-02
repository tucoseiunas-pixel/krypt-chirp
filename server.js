// server.js - Servidor local para endpoints de API durante desenvolvimento
import http from 'http';
import url from 'url';

// Banco de dados em memória (mesmo do api/signal.js)
let activeHandshakes = {};

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.writeHead(200).end();
  }

  // Parse da URL e do body
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      // Apenas /api/signal
      if (!pathname.startsWith('/api/signal')) {
        return res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
      }

      const bodyData = body ? JSON.parse(body) : {};
      const { action, senderKey, targetKey, sdp, candidate, sdpMLineIndex } = bodyData;
      const { userKey } = parsedUrl.query;

      // POST: Registrar oferta, resposta ou candidate
      if (req.method === 'POST') {
        if (action === 'call') {
          activeHandshakes[targetKey] = {
            sender: senderKey,
            offer: sdp,
            candidates: { sender: [], receiver: [] },
            timestamp: Date.now()
          };
          console.log(`[API] Oferta registrada para túnel ${targetKey.substring(0, 8)}...`);
          return res.writeHead(200).end(
            JSON.stringify({ success: true, message: 'Chamado registrado. Aguardando destinatário.' })
          );
        }

        if (action === 'answer') {
          if (activeHandshakes[targetKey]) {
            activeHandshakes[targetKey].answer = sdp;
            console.log(`[API] Resposta registrada para túnel ${targetKey.substring(0, 8)}...`);
            return res.writeHead(200).end(JSON.stringify({ success: true }));
          }
          return res.writeHead(404).end(JSON.stringify({ error: 'Chamado expirado ou não encontrado.' }));
        }

        if (action === 'candidate') {
          if (activeHandshakes[targetKey]) {
            const isOriginalSender = activeHandshakes[targetKey].sender === senderKey;
            const candidateRole = isOriginalSender ? 'sender' : 'receiver';
            
            activeHandshakes[targetKey].candidates[candidateRole].push({
              candidate: candidate,
              sdpMLineIndex: sdpMLineIndex,
              timestamp: Date.now()
            });
            
            console.log(`[API] Candidate registrado para ${candidateRole} (${activeHandshakes[targetKey].candidates[candidateRole].length} total)`);
            return res.writeHead(200).end(JSON.stringify({ success: true }));
          }
          return res.writeHead(404).end(JSON.stringify({ error: 'Túnel não encontrado para candidate.' }));
        }

        return res.writeHead(400).end(JSON.stringify({ error: 'Ação inválida' }));
      }

      // GET: Buscar oferta ou resposta
      if (req.method === 'GET') {
        // Limpar handshakes antigos
        const now = Date.now();
        Object.keys(activeHandshakes).forEach(key => {
          if (now - activeHandshakes[key].timestamp > 30000) {
            delete activeHandshakes[key];
          }
        });

        if (activeHandshakes[userKey]) {
          const data = activeHandshakes[userKey];
          
          if (data.answer) {
            const response = {
              sdp: data.answer,
              action: 'connected',
              candidates: data.candidates.receiver || []
            };
            delete activeHandshakes[userKey];
            console.log(`[API] Resposta entregue para ${userKey.substring(0, 8)}...`);
            return res.writeHead(200).end(JSON.stringify(response));
          }

          if (!data.answer) {
            console.log(`[API] Oferta entregue para ${userKey.substring(0, 8)}...`);
            return res.writeHead(200).end(JSON.stringify({
              sdp: data.offer,
              action: 'incoming',
              senderKey: data.sender,
              candidates: data.candidates.sender || []
            }));
          }
        }

        return res.writeHead(200).end(JSON.stringify({ action: 'idle' }));
      }

      return res.writeHead(405).end(JSON.stringify({ error: 'Método não permitido' }));
    } catch (err) {
      console.error('[API Error]', err.message);
      res.writeHead(500).end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 API Server rodando em http://localhost:${PORT}/api/signal`);
  console.log(`   Vite proxy redireciona /api para cá durante desenvolvimento\n`);
});
