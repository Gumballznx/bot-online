#!/usr/bin/env bash
# Instalador do bot-online
#   curl -fsSL https://raw.githubusercontent.com/Gumballznx/bot-online/main/install.sh | bash
set -e
G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; N='\033[0m'
echo -e "${G}🤖 Instalando bot-online...${N}"

SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null && SUDO="sudo"

# Node.js 20+
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo -e "${Y}📦 Instalando Node.js 20...${N}"
  if [ -n "$PREFIX" ] && command -v pkg >/dev/null; then pkg install -y nodejs-lts git   # Termux
  elif command -v apt-get >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - && $SUDO apt-get install -y nodejs
  else echo -e "${R}Instale o Node.js 20+ manualmente e rode de novo.${N}"; exit 1; fi
fi

# git (necessário para baixar do GitHub)
if ! command -v git >/dev/null; then
  if command -v apt-get >/dev/null; then $SUDO apt-get install -y git; else pkg install -y git; fi
fi

# pm2 (mantém o bot rodando 24h)
command -v pm2 >/dev/null || { echo -e "${Y}📦 Instalando pm2...${N}"; $SUDO npm i -g pm2; }
# pm2 iniciar junto com a VPS (só em sistemas com systemd)
if command -v systemctl >/dev/null && [ "$(id -u)" -eq 0 ]; then pm2 startup >/dev/null 2>&1 || true; fi

echo -e "${Y}📥 Baixando o bot...${N}"
$SUDO npm i -g github:Gumballznx/bot-online --no-audit --no-fund

echo -e "${G}✅ Instalado! Abrindo o bot...${N}\n"
exec bot-online < /dev/tty
