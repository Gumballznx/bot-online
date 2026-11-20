import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  jidNormalizedUser,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import readline from 'node:readline'

const logger = pino({ level: 'silent' })
const AUTH_DIR = './auth'

// Modo de conexão:
//   node index.js                     -> QR code no terminal
//   node index.js --code              -> código de pareamento (pergunta o número)
//   node index.js --code 258841234567 -> código de pareamento com número direto
//   BOT_CODE=1 BOT_PHONE=258841234567 node index.js (útil no pm2)
const args = process.argv.slice(2)
let codeMode = args.includes('--code') || process.env.BOT_CODE === '1'
const phoneArg = (args.find((a) => /^\+?\d{10,15}$/.test(a)) || process.env.BOT_PHONE || '').replace(/\D/g, '')

let presenceTimer
let reconnectDelay = 2_000

const ask = (q) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(q, (a) => {
      rl.close()
      resolve(a)
    })
  })

async function requestCode(sock) {
  let phone = phoneArg
  if (!/^\d{10,15}$/.test(phone)) {
    console.log('📱 Número com código do país (ex: 258841234567 ou 5511999999999):')
    phone = (await ask('--> ')).replace(/\D/g, '')
  }
  if (!/^\d{10,15}$/.test(phone)) {
    console.log('⚠️ Número inválido. Use só dígitos com o código do país.')
    process.exit(1)
  }
  console.log('⏳ Aguardando estabilização da conexão (5s)...')
  await new Promise((r) => setTimeout(r, 5_000))
  const code = await sock.requestPairingCode(phone)
  console.log(`🔑 Código de pareamento: ${code?.match(/.{1,4}/g)?.join('-') ?? code}`)
  console.log('📲 WhatsApp > Aparelhos conectados > Conectar aparelho > Conectar com número de telefone')
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.ubuntu('Chrome'), // necessário para o código de pareamento funcionar
    markOnlineOnConnect: true, // aparece online ao conectar
    syncFullHistory: false,
    keepAliveIntervalMs: 30_000,
  })

  sock.ev.on('creds.update', saveCreds)

  if (codeMode && !sock.authState.creds.registered) {
    requestCode(sock).catch((e) => console.error('❌ Erro ao pedir código de pareamento:', e.message))
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !codeMode) {
      console.log('📷 Escaneie o QR abaixo (ou rode com --code para usar código de pareamento):')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      reconnectDelay = 2_000
      codeMode = false
      console.log('✅ Conectado como', sock.user.id)
      // Desliga confirmação de leitura (tique azul) na conta
      try { await sock.updateReadReceiptsPrivacy('none') } catch {}
      // Mantém "online" sempre
      clearInterval(presenceTimer)
      await sock.sendPresenceUpdate('available').catch(() => {})
      presenceTimer = setInterval(() => {
        sock.sendPresenceUpdate('available').catch(() => {})
      }, 25_000)
    }

    if (connection === 'close') {
      clearInterval(presenceTimer)
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Sessão encerrada. Apague a pasta ./auth e conecte de novo (QR ou --code).')
        process.exit(1)
      }
      console.log(`🔄 Conexão fechada (código ${code ?? '?'}). Reconectando em ${reconnectDelay / 1000}s...`)
      setTimeout(start, reconnectDelay)
      reconnectDelay = Math.min(reconnectDelay * 2, 60_000)
    }
  })

  // Espelha mídia de visualização única para o seu próprio chat
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue

        // Formato antigo: mídia embrulhada em viewOnceMessage*
        const wrapper =
          msg.message.viewOnceMessageV2 ||
          msg.message.viewOnceMessage ||
          msg.message.viewOnceMessageV2Extension
        // Formato novo: a própria mídia vem com viewOnce: true
        const inner = wrapper?.message || msg.message

        const kind = ['imageMessage', 'videoMessage', 'audioMessage'].find((k) => inner[k])
        if (!kind) continue
        if (!wrapper && !inner[kind].viewOnce) continue

        const buffer = await downloadMediaMessage(
          { key: msg.key, message: inner },
          'buffer',
          {},
          { logger, reuploadRequest: sock.updateMediaMessage }
        )

        const me = jidNormalizedUser(sock.user.id)
        const from = msg.pushName || msg.key.participant || msg.key.remoteJid
        const caption = `👁️ Visualização única de ${from}`

        if (kind === 'imageMessage') await sock.sendMessage(me, { image: buffer, caption })
        else if (kind === 'videoMessage') await sock.sendMessage(me, { video: buffer, caption })
        else await sock.sendMessage(me, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true })
      } catch (e) {
        console.error('Erro ao espelhar:', e.message)
      }
    }
  })
}

start()
