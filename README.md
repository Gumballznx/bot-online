# 🤖 bot-online

```
╭────────────────────────────────────────────────────╮
│      _|_      bot-online v1.7.0                    │
│    .-----.    WhatsApp • Baileys                   │
│   | ^   ^ |                                        │
│   |  \_/  |/  ● sempre online  ● .ping .bot .del  │
│    '-----'    ● leitura normal                    │
╰── modo: código de pareamento ──────────────────────╯
```

Bot de WhatsApp que roda **na sua própria conta**, numa VPS ou PC, 24 horas por dia.

## ✨ O que ele faz

| Função | Como funciona |
|---|---|
| 🟢 **Sempre online** | Sua conta aparece "online" o tempo todo |
| ✅ **Leitura normal** | Quem te manda mensagem vê ✓✓ cinza quando chega e ✓✓ azul **só quando você ler** no celular. O bot nunca marca nada como lido sozinho |
| 🔄 **Reconecta sozinho** | Se a internet cair, ele volta sozinho |
| 💬 **Comandos `.ping`, `.bot` e `.del`** | Só você (o número conectado) pode usar |
| 💾 **Se instala no pm2 sozinho** | Na primeira conexão ele mesmo se coloca no pm2 e fica salvo para voltar quando a VPS reiniciar |

## ⚡ Instalação rápida (1 comando)

Na VPS (Ubuntu/Debian) ou no Termux, cole:

```bash
curl -fsSL https://raw.githubusercontent.com/Gumballznx/bot-online/main/install.sh | bash
```

Ele instala o Node.js, o git e o pm2 se faltar, baixa o bot e já abre o menu de conexão. 👇

## 🔌 Conectar

Depois de instalado, é só digitar:

```bash
bot-online
```

O mascote aparece e o bot pergunta:

```
Como você quer conectar o WhatsApp?

  [1] 📷 QR code
  [2] 🔑 Código de pareamento (pelo número)

Escolha 1 ou 2 -->
```

- **[1] QR code:** o QR aparece na hora. No celular: **WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho** e escaneie.
- **[2] Código de pareamento:** o bot pede seu número **sem o +** e mostra um código tipo `ABCD-EFGH`. No celular: **WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone** e digite o código.

| País | Exemplo de número |
|---|---|
| 🇲🇿 Moçambique | `258841234567` |
| 🇧🇷 Brasil | `5511999999999` |
| 🇦🇴 Angola | `244923456789` |
| 🇵🇹 Portugal | `351912345678` |

**Conectou? Pronto! ✅** O bot **se coloca sozinho no pm2** e salva na hora. Pode fechar o terminal: ele continua rodando 24h e volta sozinho se a VPS reiniciar.

Se rodar `bot-online` de novo com ele já conectado, ele só avisa que já está rodando (não abre outra conexão).

## 💬 Comandos no WhatsApp

Mande em **qualquer conversa** (ou no chat com você mesmo):

| Comando | Resposta |
|---|---|
| `.ping` | 🏓 Pong! com a velocidade de resposta e há quanto tempo está online |
| `.bot` | 🤖 Mascote, nome, versão, número, tempo online, memória e status das funções |
| `.del` | 🗑️ **Marque (responda) uma mensagem** com `.del` e o bot apaga **para todos**. No privado: só as suas. Em grupo: as suas sempre, e as dos outros só se você for **admin** |

> 🔒 **Só o número conectado pode usar.** Se outra pessoa mandar `.ping`, `.bot` ou `.del`, o bot ignora.

## 🛠️ Comandos no terminal

| Para... | Comando |
|---|---|
| Conectar / abrir o menu | `bot-online` |
| Ir direto pro QR | `bot-online --qr` |
| Ir direto pro código | `bot-online --code 258841234567` |
| Desconectar e apagar a sessão | `bot-online reset` |
| Ver se está rodando | `pm2 ls` |
| Ver os logs | `pm2 logs bot-online` |
| Reiniciar | `pm2 restart bot-online` |
| Atualizar para a versão nova | `npm i -g github:Gumballznx/bot-online && pm2 restart bot-online` |
| Conectar outro número | `bot-online reset` e depois `bot-online` |

## 📦 Outras formas de instalar

**Pelo npm (direto do GitHub):**

```bash
npm i -g pm2 github:Gumballznx/bot-online
bot-online
```

**Clonando o repositório:**

```bash
git clone https://github.com/Gumballznx/bot-online.git
cd bot-online && npm install
node index.js
```

**Pela [Release](https://github.com/Gumballznx/bot-online/releases/latest):** baixe o `.tar.gz`, extraia, rode `npm install` e `node index.js`.

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| `Sessão encerrada` | Você desconectou o aparelho. Rode `bot-online reset` e depois `bot-online` |
| O código não é aceito | Confira o número (código do país, sem `+`). Rode `bot-online reset` e gere outro, o código expira em poucos minutos |
| `pm2 não encontrado` | Instale com `npm i -g pm2` |
| Não aparece online | Veja `pm2 ls`. Se estiver `errored`, olhe `pm2 logs bot-online` |
| As visualizações únicas não chegam | Abra a conversa **com você mesmo** no WhatsApp, é lá que elas aparecem |

## 📁 Arquivos

```
bot-online/
├── index.js      # o bot (menu, conexão, online, visualização única, pm2)
├── banner.js     # mascote animado do início
├── install.sh    # instalador de 1 comando
├── package.json  # nome, versão e dependências
└── auth/         # sua sessão do WhatsApp (NUNCA compartilhe)
```

Instalado pelo npm/instalador, a sessão fica em `~/.bot-online/auth`.

> ⚠️ A pasta `auth/` é o seu login do WhatsApp. Não envie para ninguém e não suba para o GitHub (o `.gitignore` já bloqueia).

> ⚠️ Usa uma API não oficial do WhatsApp. Use por sua conta e risco.
