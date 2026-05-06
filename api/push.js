// api/push.js

// Em produção, você salvaria as assinaturas de Push (PushSubscriptions) no navegador do destinatário.
// Aqui nós simulamos o recebimento e o disparo do evento que acorda o Service Worker.
let pushSubscriptions = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const { action, targetKey, subscription, senderName } = req.body;

  // Ação 1: Salvar a assinatura de notificação do dispositivo para receber chamados em segundo plano
  if (action === 'subscribe') {
    if (!targetKey || !subscription) {
      return res.status(400).json({ error: "Dados de assinatura inválidos." });
    }
    pushSubscriptions[targetKey] = subscription;
    return res.status(200).json({ success: true, message: "Dispositivo registrado para escuta em segundo plano." });
  }

  // Ação 2: Disparar o Push para acordar o destinatário
  if (action === 'trigger_ping') {
    if (!targetKey) {
      return res.status(400).json({ error: "Destinatário inválido." });
    }

    console.log(`[K-CHIRP] Disparando sinal de push de alerta para: ${targetKey}`);

    // Em produção, aqui integraríamos com a biblioteca 'web-push' enviando a payload criptografada:
    // const webpush = require('web-push');
    // await webpush.sendNotification(pushSubscriptions[targetKey], JSON.stringify({ ... }));

    return res.status(200).json({ 
      success: true, 
      notified: true,
      message: `Sinal enviado. Acordando dispositivo do destino [${targetKey}].` 
    });
  }

  return res.status(400).json({ error: "Ação inválida." });
}