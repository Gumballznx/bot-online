// Mascote animado exibido ao iniciar o bot (estilo boas-vindas de CLI).
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
pkg.name = pkg.name.replace(/^@[^/]+\//, '') // tira o @dono/ do nome

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
}

// Cada frame do mascote tem 5 linhas de 11 colunas.
const EYES = { open: 'o   o', blink: '-   -', happy: '^   ^' }
const mascot = (eyes, mouth, arm) => [
  '    _|_    ',
  '  .-----.  ',
  ` | ${eyes} | `,
  ` |  ${mouth}  |${arm}`,
  "  '-----'  ",
]

const FRAMES = [
  mascot(EYES.open, '___', ' '),
  mascot(EYES.blink, '___', ' '),
  mascot(EYES.open, '___', ' '),
  mascot(EYES.happy, '\\_/', '/'),
  mascot(EYES.happy, '\\_/', '\\'),
  mascot(EYES.happy, '\\_/', '/'),
  mascot(EYES.open, '\\_/', ' '),
]

const INNER = 52

function render(frame, status) {
  const info = [
    `${c.bold}${c.green}${pkg.name}${c.reset} ${c.dim}v${pkg.version}${c.reset}`,
    `${c.dim}WhatsApp • Baileys${c.reset}`,
    '',
    `${c.cyan}● sempre online  ● sem tique azul${c.reset}`,
    `${c.cyan}● salva visualização única${c.reset}`,
  ]
  const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')
  const lines = frame.map((m, i) => {
    const body = `  ${c.yellow}${m}${c.reset}  ${info[i]}`
    return `${c.green}│${c.reset}${body}${' '.repeat(Math.max(0, INNER - plain(body).length))}${c.green}│${c.reset}`
  })
  const st = ` ${status} `
  return [
    `${c.green}╭${'─'.repeat(INNER)}╮${c.reset}`,
    ...lines,
    `${c.green}╰${'─'.repeat(2)}${c.reset}${c.dim}${st}${c.reset}${c.green}${'─'.repeat(Math.max(0, INNER - 2 - st.length))}╯${c.reset}`,
  ]
}

export async function showBanner(status = 'iniciando...') {
  const out = process.stdout
  // Fora de terminal (ex: pm2 logs) mostra só um frame, sem animação.
  if (!out.isTTY) {
    console.log(render(FRAMES[FRAMES.length - 1], status).join('\n'))
    return
  }
  const height = FRAMES[0].length + 2
  out.write('\x1b[?25l') // esconde cursor
  for (let i = 0; i < FRAMES.length; i++) {
    if (i > 0) out.write(`\x1b[${height}A`)
    out.write(render(FRAMES[i], status).join('\n') + '\n')
    await new Promise((r) => setTimeout(r, 220))
  }
  out.write('\x1b[?25h')
}

export const BOT_NAME = pkg.name
export const BOT_VERSION = pkg.version
