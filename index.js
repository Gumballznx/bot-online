#!/usr/bin/env node
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
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync, readFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import { showBanner, BOT_NAME, BOT_VERSION } from './banner.js'

const logger = pino({ level: 'silent' })
const BOT_DIR = path.dirname(fileURLToPath(import.meta.url))
// Instalado com git clone: sessão fica em ./auth
// Instalado com npm -g: sessão fica em ~/.bot-online/auth (não some ao atualizar)
const AUTH_DIR =
  process.env.BOT_AUTH_DIR ||
  (BOT_DIR.includes(`${path.sep}node_modules${path.sep}`)
    ? path.join(os.homedir(), '.bot-online', 'auth')
    : path.join(BOT_DIR, 'auth'))
const PM2_FLAG = path.join(AUTH_DIR, '.pm2-saved')
// Cache das visualizações únicas recebidas (para o .ver funcionar mesmo se o
// WhatsApp não mandar a mídia junto da mensagem marcada).
const CACHE_DIR = path.join(path.dirname(AUTH_DIR), 'viewonce-cache')
const CACHE_MAX = 150
const CACHE_DAYS = 7

// A biblioteca de criptografia imprime sessões inteiras (com chaves) no log.
// Esconde esse ruído.
for (const fn of ['log', 'info', 'warn', 'error']) {
  const orig = console[fn].bind(console)
  console[fn] = (...a) => {
    const first = typeof a[0] === 'string' ? a[0] : ''
    if (/^(Closing (open )?session|Closing session:|Removing old closed session|Decrypted message with closed session|Session error|Failed to decrypt)/.test(first)) return
    orig(...a)
  }
}

const safeId = (id) => String(id || '').replace(/[^A-Za-z0-9_-]/g, '')

function cachePut(id, data) {
  id = safeId(id)
  if (!id) return
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(path.join(CACHE_DIR, `${id}.bin`), data.buffer)
    writeFileSync(path.join(CACHE_DIR, `${id}.json`), JSON.stringify({ ...data, buffer: undefined }))
    // limpa: mais antigos que CACHE_DAYS ou além de CACHE_MAX
    const files = readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, t: statSync(path.join(CACHE_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    files.forEach(({ f, t }, i) => {
      if (i >= CACHE_MAX || Date.now() - t > CACHE_DAYS * 86400_000) {
        const base = f.slice(0, -5)
        rmSync(path.join(CACHE_DIR, `${base}.json`), { force: true })
        rmSync(path.join(CACHE_DIR, `${base}.bin`), { force: true })
      }
    })
  } catch (e) {
    console.error('Erro ao salvar cache:', e.message)
  }
}

function cacheGet(id) {
  id = safeId(id)
  try {
    const meta = JSON.parse(readFileSync(path.join(CACHE_DIR, `${id}.json`), 'utf8'))
    return { ...meta, buffer: readFileSync(path.join(CACHE_DIR, `${id}.bin`)) }
  } catch {
    return null
  }
}
const underPm2 = process.env.pm_id !== undefined
const interactive = process.stdin.isTTY && process.stdout.isTTY && !underPm2

// Uso:
//   bot-online                         -> menu: escolhe QR ou código de pareamento
//   bot-online --qr                    -> QR code direto
//   bot-online --code [258841234567]   -> código de pareamento
//   bot-online reset                   -> desconecta, apaga a sessão e tira do pm2
//   BOT_CODE=1 BOT_PHONE=258841234567  -> código via variáveis (útil no pm2)
const args = process.argv.slice(2)
let codeMode = args.includes('--code') || process.env.BOT_CODE === '1'
const qrFlag = args.includes('--qr')
let phone = (args.find((a) => /^\+?\d{10,15}$/.test(a)) || process.env.BOT_PHONE || '').replace(/\D/g, '')

let presenceTimer
const startedAt = Date.now()
let reconnectDelay = 2_000

const ask = (q) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(q, (a) => {
      rl.close()
      resolve(a.trim())
    })
  })

const validPhone = (p) => /^\d{10,15}$/.test(p)

async function askPhone() {
  while (!validPhone(phone)) {
    console.log('\n📱 Digite seu número com o código do país, SEM o +')
    console.log('   ex: 258841234567 (Moçambique) • 5511999999999 (Brasil)')
    phone = (await ask('--> ')).replace(/\D/g, '')
    if (!validPhone(phone)) console.log('⚠️ Número inválido, tente de novo.')
  }
}

// Menu inicial: só aparece no terminal e quando ainda não há sessão.
async function chooseMethod() {
  if (qrFlag) { codeMode = false; return }
  if (codeMode) { if (interactive) await askPhone(); return }
  if (!interactive) return // pm2/sem terminal: usa QR nos logs
  console.log('\nComo você quer conectar o WhatsApp?\n')
  console.log('  [1] 📷 QR code')
  console.log('  [2] 🔑 Código de pareamento (pelo número)\n')
  let op
  while (!['1', '2'].includes(op)) op = await ask('Escolha 1 ou 2 --> ')
  codeMode = op === '2'
  if (codeMode) await askPhone()
}

async function requestCode(sock) {
  if (!validPhone(phone)) {
    console.log('⚠️ Número inválido. Use só dígitos com o código do país (ex: 258841234567).')
    process.exit(1)
  }
  console.log('⏳ Gerando código (5s)...')
  await new Promise((r) => setTimeout(r, 5_000))
  const code = await sock.requestPairingCode(phone)
  console.log(`\n🔑 Código de pareamento: \x1b[1m\x1b[32m${code?.match(/.{1,4}/g)?.join('-') ?? code}\x1b[0m\n`)
  console.log('📲 WhatsApp > ⋮ > Aparelhos conectados > Conectar aparelho > Conectar com número de telefone')
  console.log('⏳ Aguardando você digitar o código... (não feche o terminal)')
}

const pm2 = (...a) => execFileSync('pm2', a, { stdio: 'ignore' })
const hasPm2 = () => { try { pm2('-v'); return true } catch { return false } }
const pm2HasBot = () => { try { pm2('describe', BOT_NAME); return true } catch { return false } }

// Ao conectar, registra o bot no pm2 e salva a lista,
// para ele rodar 24h e voltar sozinho se a VPS reiniciar.
async function setupPm2(sock) {
  if (underPm2) {
    if (existsSync(PM2_FLAG)) return
    try {
      pm2('save')
      writeFileSync(PM2_FLAG, new Date().toISOString())
      console.log('💾 Bot salvo no pm2 (volta sozinho se a VPS reiniciar).')
    } catch {}
    return
  }
  if (!hasPm2()) {
    console.log('ℹ️ pm2 não encontrado. Instale com "npm i -g pm2" para rodar 24h. Por enquanto o bot roda neste terminal.')
    return
  }
  // Rodando no terminal: fecha esta conexão e entrega o bot para o pm2.
  try {
    console.log('🚀 Conectado! Passando o bot para o pm2...')
    clearInterval(presenceTimer)
    handingOff = true
    sock.end(undefined)
    await new Promise((r) => setTimeout(r, 1_500))
    if (pm2HasBot()) pm2('delete', BOT_NAME)
    pm2('start', path.join(BOT_DIR, 'index.js'), '--name', BOT_NAME, '--cwd', BOT_DIR)
    pm2('save')
    writeFileSync(PM2_FLAG, new Date().toISOString())
    console.log(`✅ Pronto! O bot está rodando no pm2 como "${BOT_NAME}" e volta sozinho se a VPS reiniciar.`)
    console.log('   Pode fechar o terminal.')
    console.log(`   Ver logs: pm2 logs ${BOT_NAME}   •   Desconectar: bot-online reset`)
    process.exit(0)
  } catch (e) {
    console.error('⚠️ Não consegui configurar o pm2:', e.message)
    process.exit(1)
  }
}

let handingOff = false

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
      console.log('\n📷 WhatsApp > ⋮ > Aparelhos conectados > Conectar aparelho e escaneie:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      reconnectDelay = 2_000
      codeMode = false
      console.log('✅ Conectado como', sock.user.id)
      // Confirmação de leitura normal: ✓✓ cinza quando chega, ✓✓ azul só quando
      // VOCÊ ler no celular. O bot nunca marca nada como lido sozinho.
      // (versões antigas desligavam isso; aqui religamos)
      try { await sock.updateReadReceiptsPrivacy('all') } catch {}
      // Mantém "online" sempre
      clearInterval(presenceTimer)
      await sock.sendPresenceUpdate('available').catch(() => {})
      presenceTimer = setInterval(() => {
        sock.sendPresenceUpdate('available').catch(() => {})
      }, 25_000)
      await setupPm2(sock)
    }

    if (connection === 'close') {
      clearInterval(presenceTimer)
      if (handingOff) return
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Sessão encerrada. Rode "bot-online reset" e conecte de novo.')
        process.exit(1)
      }
      console.log(`🔄 Conexão fechada (código ${code ?? '?'}). Reconectando em ${reconnectDelay / 1000}s...`)
      setTimeout(start, reconnectDelay)
      reconnectDelay = Math.min(reconnectDelay * 2, 60_000)
    }
  })

  // Comandos do dono (.ping / .bot) — só o número conectado pode usar
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        // fromMe = mensagem enviada pela própria conta conectada. Dos outros, ignora.
        if (!msg.message || !msg.key.fromMe) continue
        const ts = Number(msg.messageTimestamp) * 1000
        if (!ts || Date.now() - ts > 60_000) continue // ignora mensagens antigas
        const m = msg.message.ephemeralMessage?.message || msg.message
        const text = (m.conversation || m.extendedTextMessage?.text || '').trim().toLowerCase()
        if (!['.ping', '.bot', '.ver', '.del'].includes(text)) continue
        await handleOwnerCommand(sock, msg, text, ts, m)
      } catch (e) {
        console.error('Erro no comando:', e.message)
      }
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

        cachePut(msg.key.id, {
          kind,
          caption: inner[kind].caption || '',
          mimetype: inner[kind].mimetype || '',
          ptt: !!inner[kind].ptt,
          buffer,
        })

        const me = jidNormalizedUser(sock.user.id)
        const from = msg.pushName || msg.key.participant || msg.key.remoteJid
        const caption = `👁️ Visualização única de ${from}`

        if (kind === 'imageMessage') await sock.sendMessage(me, { image: buffer, caption })
        else if (kind === 'videoMessage') await sock.sendMessage(me, { video: buffer, caption })
        else await sock.sendMessage(me, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true })
        console.log(`💾 Visualização única salva: ${kind} de ${from} (${msg.key.id})`)
      } catch (e) {
        console.error('Erro ao espelhar:', e.message)
      }
    }
  })
}

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000)
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60), s = sec % 60
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ')
}

// .ver — marque (responda) uma mídia de visualização única com .ver
// e o bot reenvia ela aberta (normal) no mesmo chat.
async function revealViewOnce(sock, msg, m) {
  const jid = msg.key.remoteJid
  const ctx = m.extendedTextMessage?.contextInfo
  const quoted = ctx?.quotedMessage
  if (!quoted) {
    await sock.sendMessage(jid, { text: '↩️ Marque (responda) uma foto, vídeo ou áudio de visualização única com *.ver*' }, { quoted: msg })
    return
  }
  // 1) Mídia que o bot já guardou quando chegou
  let item = cacheGet(ctx.stanzaId)

  // 2) Senão, tenta baixar pela própria mensagem marcada
  if (!item) {
    const inner =
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessage?.message ||
      quoted.viewOnceMessageV2Extension?.message ||
      quoted
    const kind = ['imageMessage', 'videoMessage', 'audioMessage'].find((k) => inner[k])
    if (!kind) {
      await sock.sendMessage(jid, { text: '⚠️ A mensagem marcada não é foto, vídeo nem áudio.' }, { quoted: msg })
      return
    }
    const media = inner[kind]
    try {
      if (!media.mediaKey || !(media.directPath || media.url)) throw new Error('mensagem marcada veio sem a chave da mídia')
      const buffer = await downloadMediaMessage(
        {
          key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant, fromMe: false },
          message: { [kind]: media },
        },
        'buffer',
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      )
      item = { kind, buffer, caption: media.caption || '', mimetype: media.mimetype || '', ptt: !!media.ptt }
    } catch (e) {
      console.error(`.ver: falha ao baixar ${ctx.stanzaId}:`, e.message)
      await sock.sendMessage(
        jid,
        { text: '❌ Não consegui abrir essa mídia. O .ver funciona com visualizações únicas recebidas *com o bot ligado*. Mídias antigas ou já abertas não dá.' },
        { quoted: msg }
      )
      return
    }
  }

  const { kind, buffer } = item
  const caption = item.caption || undefined
  if (kind === 'imageMessage') await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg })
  else if (kind === 'videoMessage') await sock.sendMessage(jid, { video: buffer, caption }, { quoted: msg })
  else await sock.sendMessage(jid, { audio: buffer, mimetype: item.mimetype || 'audio/ogg; codecs=opus', ptt: item.ptt }, { quoted: msg })
  console.log(`👁️ .ver: ${kind} ${ctx.stanzaId} enviado`)
}

// Meus próprios ids (número e LID), sem o :dispositivo
function myIds(sock) {
  return [sock.user?.id, sock.user?.lid].filter(Boolean).map((j) => jidNormalizedUser(j))
}

// .del — marque (responda) uma mensagem com .del e o bot apaga para todos.
// Privado: só as suas. Grupo: as suas sempre; as dos outros só se você for admin.
async function deleteQuoted(sock, msg, m) {
  const jid = msg.key.remoteJid
  const ctx = m.extendedTextMessage?.contextInfo
  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })
  if (!ctx?.stanzaId) return reply('↩️ Marque (responda) a mensagem que quer apagar com *.del*')

  const isGroup = jid.endsWith('@g.us')
  const mine = myIds(sock)
  const author = ctx.participant ? jidNormalizedUser(ctx.participant) : isGroup ? '' : jidNormalizedUser(jid)
  const isMine = !author || mine.includes(author)

  if (!isMine) {
    if (!isGroup) return reply('⚠️ No privado só dá para apagar as *suas* mensagens.')
    const meta = await sock.groupMetadata(jid)
    const me = meta.participants.find((p) =>
      [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some((id) => mine.includes(jidNormalizedUser(id)))
    )
    if (!me?.admin) return reply('⚠️ Para apagar mensagem de outra pessoa você precisa ser *admin* do grupo.')
  }

  const key = { remoteJid: jid, id: ctx.stanzaId, fromMe: isMine }
  if (isGroup && !isMine) key.participant = ctx.participant
  await sock.sendMessage(jid, { delete: key })
  // apaga também o próprio ".del" para não sujar a conversa
  await sock.sendMessage(jid, { delete: msg.key }).catch(() => {})
  console.log(`🗑️ .del: ${ctx.stanzaId} apagada em ${isGroup ? 'grupo' : 'privado'} (${isMine ? 'minha' : 'de outro, como admin'})`)
}

async function handleOwnerCommand(sock, msg, cmd, sentAt, m) {
  const jid = msg.key.remoteJid
  if (cmd === '.del') {
    await deleteQuoted(sock, msg, m)
    return
  }
  if (cmd === '.ver') {
    await revealViewOnce(sock, msg, m)
    return
  }
  if (cmd === '.ping') {
    const lat = Math.max(0, Date.now() - sentAt)
    await sock.sendMessage(jid, { text: `🏓 *Pong!*\n⚡ ${lat} ms\n⏱️ Online há ${formatUptime(Date.now() - startedAt)}` }, { quoted: msg })
    return
  }
  // .bot
  const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(0)
  const art = [
    '    _|_',
    '  .-----.',
    ' | ^   ^ |',
    ' |  \\_/  |/',
    "  '-----'",
  ].join('\n')
  const text = [
    '```' + art + '```',
    `🤖 *${BOT_NAME}* v${BOT_VERSION}`,
    '',
    `📱 Número: ${jidNormalizedUser(sock.user.id).split('@')[0]}`,
    `⏱️ Online há: ${formatUptime(Date.now() - startedAt)}`,
    `💾 Memória: ${mem} MB  •  Node ${process.version}`,
    `⚙️ pm2: ${underPm2 ? 'sim ✅' : 'não'}`,
    '',
    '🟢 Sempre online: ativo',
    '✅ Confirmação de leitura: normal (azul só quando você ler)',
    '👁️ Visualização única: salvando no seu chat',
    '',
    '_Comandos (só você pode usar): .ping • .bot • .ver • .del_',
  ].join('\n')
  await sock.sendMessage(jid, { text }, { quoted: msg })
}

async function main() {
  if (args[0] === 'reset') {
    if (hasPm2() && pm2HasBot()) { pm2('delete', BOT_NAME); pm2('save') }
    rmSync(AUTH_DIR, { recursive: true, force: true })
    console.log('🧹 Sessão apagada e bot removido do pm2. Rode "bot-online" para conectar de novo.')
    return
  }

  const { state } = await useMultiFileAuthState(AUTH_DIR)
  const registered = !!state.creds.registered

  // Já conectado e rodando no pm2: não abre uma segunda conexão.
  if (interactive && registered && hasPm2() && pm2HasBot()) {
    await showBanner('já conectado')
    console.log(`\n✅ O bot já está conectado e rodando no pm2.`)
    console.log(`   Logs: pm2 logs ${BOT_NAME}   •   Reiniciar: pm2 restart ${BOT_NAME}`)
    console.log('   Conectar outro número: bot-online reset  e depois  bot-online')
    return
  }

  await showBanner(registered ? 'reconectando...' : 'primeira conexão')
  if (!registered) await chooseMethod()
  else codeMode = false
  start()
}

main()
