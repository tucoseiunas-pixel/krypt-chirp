import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Cloud, CloudOff, ShieldAlert, Check } from 'lucide-react';

export default function Agenda() {
  const [contacts, setContacts] = useState([]);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [isGoogleSynced, setIsGoogleSynced] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Carrega a agenda do LocalStorage ao montar o componente
  useEffect(() => {
    const savedContacts = localStorage.getItem('kchirp_local_contacts');
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    }
  }, []);

  const saveContacts = (updatedContacts) => {
    setContacts(updatedContacts);
    localStorage.setItem('kchirp_local_contacts', JSON.stringify(updatedContacts));
    
    if (isGoogleSynced) {
      // Aqui futuramente chamaremos a API para salvar na pasta secreta do Google Drive (appDataFolder)
      console.log("Sincronizando com appDataFolder do Google Drive...");
    }
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newKey.trim()) return;

    const newContact = {
      id: Date.now().toString(),
      name: newName.trim().toUpperCase(),
      key: newKey.trim().toUpperCase()
    };

    const updated = [...contacts, newContact];
    saveContacts(updated);
    
    setNewName('');
    setNewKey('');
    setShowAddForm(false);
  };

  const handleDeleteContact = (id) => {
    const updated = contacts.filter(contact => contact.id !== id);
    saveContacts(updated);
  };

  const handleGoogleSyncToggle = () => {
    // Simula o login do Google e vinculação da agenda
    setIsGoogleSynced(!isGoogleSynced);
  };

  return (
    <div className="flex flex-col justify-between h-full space-y-4">
      
      {/* Header da Agenda com Sincronização */}
      <div className="flex items-center justify-between border-b border-borderGray pb-3">
        <h2 className="text-lg font-bold tracking-widest text-acidGreen flex items-center gap-2">
          [ AGENDA DE CHAVES ]
        </h2>
        <button
          onClick={handleGoogleSyncToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold border transition-all duration-300 ${
            isGoogleSynced 
              ? 'bg-acidGreenDim border-acidGreen text-acidGreen shadow-green-glow' 
              : 'bg-terminalGray border-borderGray text-acidGreenDim hover:text-acidGreen hover:border-acidGreen'
          }`}
        >
          {isGoogleSynced ? (
            <>
              <Cloud className="w-3.5 h-3.5 animate-pulse" /> CLOUD: ATIVA
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5" /> CLOUD: OFF
            </>
          )}
        </button>
      </div>

      {/* Alerta de Segurança */}
      <div className="border border-acidGreenDim bg-terminalGray/50 p-3 rounded text-[11px] text-acidGreenDim flex gap-2 items-start">
        <ShieldAlert className="w-4 h-4 text-acidGreen flex-shrink-0 mt-0.5" />
        <p>
          <span className="text-acidGreen font-bold">REGRA DE OURO:</span> Você só receberá bipes e chamados de endereços que estiverem cadastrados nesta lista. Conexões externas não cadastradas são rejeitadas silenciosamente.
        </p>
      </div>

      {/* Botão de Exibição do Formulário */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2 border border-dashed border-acidGreen hover:border-solid hover:bg-acidGreenDim text-acidGreen font-bold rounded text-xs tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" /> Adicionar Contato Autorizado
        </button>
      )}

      {/* Formulário de Adicionar Contato */}
      {showAddForm && (
        <form onSubmit={handleAddContact} className="border border-acidGreen bg-terminalGray p-4 rounded space-y-3 shadow-green-glow">
          <div className="text-xs font-bold text-acidGreen border-b border-acidGreenDim pb-1.5 flex justify-between">
            <span>NOVO DISPOSITIVO AUTORIZADO</span>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="text-radioactiveOrange hover:underline"
            >
              [ CANCELAR ]
            </button>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] text-acidGreenDim">NOME / ALIAS (COMO APARECE NA TELA)</label>
            <input 
              type="text" 
              required
              placeholder="Ex: PARCEIRO KAPPA"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-oledBlack border border-borderGray p-2 rounded text-sm text-acidGreen focus:border-acidGreen focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-acidGreenDim">ENDEREÇO / CHAVE SHA-256 DO HARDWARE</label>
            <input 
              type="text" 
              required
              placeholder="Ex: K-8B3F91A2D..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full bg-oledBlack border border-borderGray p-2 rounded text-sm text-acidGreen focus:border-acidGreen focus:outline-none tracking-wider font-bold"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-acidGreen border border-acidGreen text-oledBlack font-bold rounded text-xs tracking-widest uppercase hover:bg-transparent hover:text-acidGreen transition-all"
          >
            Confirmar e Autorizar
          </button>
        </form>
      )}

      {/* Lista de Contatos */}
      <div className="flex-1 overflow-y-auto max-h-[40vh] space-y-2 pr-1">
        {contacts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-borderGray rounded text-xs text-acidGreenDim">
            NENHUM CONTATO AUTORIZADO NA AGENDA LOCAL
          </div>
        ) : (
          contacts.map((contact) => (
            <div 
              key={contact.id}
              className="flex items-center justify-between border border-borderGray bg-terminalGray/30 p-3 rounded hover:border-acidGreen transition-all group"
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider text-acidGreen">{contact.name}</span>
                <span className="text-[10px] text-acidGreenDim font-mono tracking-widest mt-0.5">{contact.key}</span>
              </div>
              <button
                onClick={() => handleDeleteContact(contact.id)}
                className="p-2 text-acidGreenDim hover:text-radioactiveOrange rounded transition-colors"
                title="Remover autorização"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

    </div>
  );
}