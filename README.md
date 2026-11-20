# 🤖 bot-online

```
╭────────────────────────────────────────────────────╮
│      _|_      bot-online v1.2.0                    │
│    .-----.    WhatsApp • Baileys                   │
│   | ^   ^ |                                        │
│   |  \_/  |/  ● sempre online  ● sem tique azul    │
│    '-----'    ● salva visualização única           │
╰── modo: código de pareamento ──────────────────────╯
```

Bot de WhatsApp que roda **na sua própria conta**, numa VPS ou PC, 24 horas por dia.

## ✨ O que ele faz

| Função | Como funciona |
|---|---|
| 🟢 **Sempre online** | Sua conta aparece "online" o tempo todo |
| 🔵 **Sem tique azul** | Desliga a confirmação de leitura: ninguém vê que você leu |
| 👁️ **Salva visualização única** | Foto, vídeo ou áudio de "ver uma vez" que você receber chega como cópia no **seu próprio chat** (a conversa com você mesmo) |
| 🔄 **Reconecta sozinho** | Se a internet cair, ele volta sozinho |
| 💾 **Se instala no pm2 sozinho** | Na primeira conexão ele mesmo se coloca no pm2 e fica salvo para voltar quando a VPS reiniciar |

## 📋 O que você precisa

- Uma VPS Linux (Ubuntu/Debian) **ou** Termux no Android
- **Node.js 20+**, **git** e **pm2**

Na VPS (Ubuntu/Debian), instale tudo assim:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git
npm i -g pm2
pm2 startup   # faz o pm2 iniciar junto com a VPS
```

## 🚀 Instalação (passo a passo)

**1. Baixe o bot**

```bash
git clone https://github.com/Gumballznx/bot-online.git
cd bot-online
npm install
```

**2. Conecte seu WhatsApp**

Use o seu número **com o código do país, só os números** (sem `+`, espaço ou traço):

| País | Exemplo |
|---|---|
| 🇲🇿 Moçambique | `258841234567` |
| 🇧🇷 Brasil | `5511999999999` |
| 🇦🇴 Angola | `244923456789` |
| 🇵🇹 Portugal | `351912345678` |

```bash
node index.js --code 258841234567
```

O mascote aparece e logo depois um código, por exemplo:

```
🔑 Código de pareamento: ABCD-EFGH
```

**3. Digite o código no celular**

No WhatsApp: **⋮ (três pontinhos) → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone** e digite o código.

**4. Pronto!** ✅

Quando conectar, o bot **se coloca sozinho no pm2** e salva. Você já pode fechar o terminal: ele continua rodando e volta sozinho se a VPS reiniciar.

> Prefere QR code? Rode só `npm start` e escaneie o QR em **Aparelhos conectados → Conectar aparelho**.

## 🛠️ Comandos úteis

| Para... | Comando |
|---|---|
| Ver se está rodando | `pm2 ls` |
| Ver os logs | `pm2 logs bot-online` |
| Reiniciar | `pm2 restart bot-online` |
| Parar | `pm2 stop bot-online` |
| Atualizar para a versão nova | `git pull && npm install && pm2 restart bot-online` |
| Conectar outro número | `pm2 delete bot-online && rm -rf auth && node index.js --code SEUNUMERO` |

Também dá para parear direto pelo pm2 e ver o código nos logs:

```bash
BOT_CODE=1 BOT_PHONE=258841234567 pm2 start index.js --name bot-online
pm2 logs bot-online
```

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| `Sessão encerrada` | Você desconectou o aparelho. Rode `rm -rf auth` e conecte de novo |
| O código não é aceito | Confira o número (código do país, sem `+`). Apague `auth/` e gere outro, o código expira em poucos minutos |
| `pm2 não encontrado` | Instale com `npm i -g pm2` |
| Não aparece online | Veja `pm2 ls`. Se estiver `errored`, olhe `pm2 logs bot-online` |
| As visualizações únicas não chegam | Abra a conversa **com você mesmo** no WhatsApp, é lá que elas aparecem |

## 📁 Arquivos

```
bot-online/
├── index.js      # o bot (conexão, online, visualização única, pm2)
├── banner.js     # mascote animado do início
├── package.json  # nome, versão e dependências
└── auth/         # sua sessão do WhatsApp (criada ao conectar, NUNCA compartilhe)
```

> ⚠️ A pasta `auth/` é o seu login do WhatsApp. Não envie para ninguém e não suba para o GitHub (o `.gitignore` já bloqueia).

> ⚠️ Usa uma API não oficial do WhatsApp. Use por sua conta e risco.
