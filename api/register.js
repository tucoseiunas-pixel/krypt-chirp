// api/register.js

// Simulação de persistência de hardware vinculada à conta Google na RAM do servidor.
// Em produção, isso pode ser integrado com um banco chave-valor ultra-rápido (como Redis ou Supabase)
let hardwareRegistry = {};

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

  const { userKey, googleId, action } = req.body;

  if (!userKey) {
    return res.status(400).json({ error: "Chave do dispositivo (userKey) é obrigatória." });
  }

  // Ação 1: Vincular Hardware a uma Conta Google (Para backup da Agenda)
  if (action === 'link_account') {
    if (!googleId) {
      return res.status(400).json({ error: "Google ID é obrigatório para vínculo." });
    }

    // Regra de Ouro anti-abuso: Varre se o Google ID já está vinculado a outro hardware
    const activeHardware = Object.keys(hardwareRegistry).find(
      key => hardwareRegistry[key].googleId === googleId
    );

    if (activeHardware && activeHardware !== userKey) {
      // Se já existia um hardware para essa conta, o antigo perde o vínculo (sobrescrita por segurança)
      delete hardwareRegistry[activeHardware];
      console.log(`[K-CHIRP] Hardware antigo ${activeHardware} desvinculado.`);
    }

    // Registra o novo vínculo
    hardwareRegistry[userKey] = {
      googleId,
      linkedAt: Date.now()
    };

    return res.status(200).json({
      success: true,
      message: "Dispositivo autenticado e vinculado com sucesso.",
      deviceAuthorized: true
    });
  }

  // Ação 2: Validar se o hardware ainda é o dono ativo do vínculo
  if (action === 'validate') {
    const registry = hardwareRegistry[userKey];
    
    if (registry) {
      return res.status(200).json({ 
        authorized: true, 
        linkedTo: registry.googleId 
      });
    }

    // Se não há vínculo registrado, o hardware opera estritamente no modo local (sem nuvem)
    return res.status(200).json({ 
      authorized: true, 
      linkedTo: null,
      message: "Operando em modo puramente local (Offline-First)." 
    });
  }

  return res.status(400).json({ error: "Ação inválida." });
}