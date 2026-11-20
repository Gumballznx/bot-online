# bot-online

Bot de WhatsApp feito com [Baileys](https://github.com/WhiskeySockets/Baileys) que roda na sua própria conta e:

- 🟢 **Mantém você sempre online** (envia presença "disponível" a cada 25s)
- 🔵 **Desliga a confirmação de leitura** (tique azul) da conta
- 👁️ **Guarda mídias de visualização única** (foto, vídeo, áudio) recebidas, enviando uma cópia para o seu próprio chat
- 🔄 Reconecta sozinho se a conexão cair

## Requisitos

- Node.js 20 ou superior
- Git

## Instalação

```bash
git clone https://github.com/Gumballznx/bot-online.git
cd bot-online
npm install
```

## Conectar

### Opção 1 — Código de pareamento (recomendado)

```bash
npm run code
# ou já passando o número (com código do país, só dígitos):
node index.js --code 258841234567
```

O terminal mostra um código tipo `ABCD-EFGH`. No celular:
**WhatsApp → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone** e digite o código.

### Opção 2 — QR code

```bash
npm start
```

Escaneie o QR que aparece no terminal em **WhatsApp → Aparelhos conectados**.

A sessão fica salva na pasta `auth/` (ela **não** vai para o Git). Nas próximas vezes é só `npm start`.

## Rodar 24h na VPS com pm2

Primeiro conecte uma vez de forma interativa (passo acima). Depois:

```bash
npm i -g pm2
pm2 start index.js --name bot-online
pm2 save
pm2 logs bot-online
```

Também dá para parear direto pelo pm2 usando variáveis de ambiente e ver o código nos logs:

```bash
BOT_CODE=1 BOT_PHONE=258841234567 pm2 start index.js --name bot-online
pm2 logs bot-online
```

## Atualizar

```bash
git pull && npm install && pm2 restart bot-online
```

## Problemas comuns

| Problema | Solução |
|---|---|
| `Sessão encerrada` | Apague a pasta `auth/` e conecte de novo |
| Código de pareamento não aceita | Confira o número (código do país, sem `+`), apague `auth/` e gere outro |
| Não aparece online | Confira se o processo está rodando (`pm2 ls`) |

> ⚠️ Usa uma API não oficial do WhatsApp. Use por sua conta e risco.
