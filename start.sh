#!/bin/bash

# Script de inicialização para Oracle Cloud
echo "🚀 Iniciando Sunshine Cowhides na Oracle Cloud..."

# Definir variáveis de ambiente para produção
export NODE_ENV=production
export PORT=3000

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install --production
fi

# Verificar se o arquivo credentials.json existe
if [ ! -f "credentials.json" ]; then
    echo "⚠️ AVISO: credentials.json não encontrado!"
fi

# Iniciar o servidor
echo "✅ Iniciando servidor..."
cd /opt/sunshine-cowhides
node src/server.js