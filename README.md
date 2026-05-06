# 📟 K-CHIRP // P2P Phantom Protocol

O **K-Chirp** (homenagem ao lendário parceiro *Kappa*) é um utilitário de comunicação de voz e texto por rádio, inspirado no estilo clássico do "chirp" do Nextel, mas reconstruído do zero para a web moderna com foco em **privacidade absoluta, rastro zero e arquitetura local-first**.

Este projeto foi construído sem bancos de dados centrais (Zero-DB), operando de forma descentralizada através de conexões seguras peer-to-peer (P2P).

---

## 🛠️ Tecnologia e Desenvolvimento Co-Criativo

Este projeto carrega um marco tecnológico muito especial em sua engenharia: **sua estrutura, lógica e design foram construídos em uma parceria de co-criação ativa e 100% colaborativa com o modelo Gemini (Gemini 3 Flash)**. 

Desde o design do painel cyberpunk preto OLED com detalhes em Verde Ácido e Laranja Radioativo até a engenharia pesada do protocolo WebRTC, do Service Worker e das Serverless Functions, a IA atuou como parceira de desenvolvimento ativa ao lado do desenvolvedor humano, provando o poder da engenharia de software guiada por colaboração humano-IA.

---

## 🛡️ Pilares de Segurança & Engenharia

* **Rastro Zero por Design:** Não há servidores de banco de dados coletando logs, metadados ou gravações. A voz e as mensagens viajam diretamente de um dispositivo ao outro.
* **Criptografia P2P Nativa:** Utiliza o protocolo WebRTC para estabelecer pontes diretas criptografadas ponta-a-ponta entre os navegadores.
* **Mensagens Efêmeras (RAM Isolation):** As mensagens de texto enviadas durante a chamada duram exatamente 60 segundos antes de serem completamente limpas da memória RAM do dispositivo, sem deixar vestígios em disco.
* **Barreira de Proteção Contra Spam:** O dispositivo só aceita ou emite alertas de chamados se a chave de quem liga já estiver previamente autorizada e salva na Agenda local do destinatário.
* **Limitação Rígida de Transmissão (90s):** Para evitar conexões fantasmas em segundo plano e preservar dados e bateria, a chamada é terminada automaticamente e de forma física após 90 segundos.
* **Agenda Híbrida (Google Drive AppDataFolder):** Armazenamento de contatos criptografado em arquivo fracionado usando a pasta oculta de segurança do seu próprio Google Drive, onde nenhuma empresa externa ou aplicativo tem acesso.

---

## 🚀 Arquitetura do Sistema

```text
/krypt-chirp
├── /api                 # Serverless Functions (Hospedadas na Vercel)
│   ├── signal.js        # Handshake de SDPs efêmeros para WebRTC
│   ├── push.js          # Sinalização via Web Push para acordar o Service Worker
│   └── register.js      # Validação de hardware e controle de vínculo do Drive
├── /public
│   └── sw.js            # Service Worker de segundo plano para Android (vibração e alerta)
└── /src
    ├── /components
    │   ├── Terminal.jsx # Painel principal de discagem neon com som acústico sintetizado
    │   ├── Agenda.jsx   # Gestão de contatos autorizados Local-First
    │   └── Radio.jsx    # Console de transmissão ativa P2P com cronômetro de 90s
    ├── /hooks
    │   └── useKChirp.js # O motor WebRTC de áudio e conexões ponta-a-ponta
    ├── App.jsx          # Gerenciador global, onboarding (regras ECA) e navegação
    └── index.css        # Estilos globais e filtros de tela CRT cyberpunk