Sunshine Cowhides Gallery System
Visão Geral
O Sunshine Cowhides Gallery System é uma aplicação web completa para catálogo e venda de couros premium. 
O sistema funciona como um showcase interativo onde clientes autenticados podem navegar por categorias de produtos, visualizar imagens em alta qualidade, selecionar itens e fazer pedidos.
O projeto foi desenvolvido com foco em performance, utilizando uma arquitetura de cache em múltiplas camadas e otimização avançada de imagens.
Arquitetura e Tecnologias
Backend (Node.js/Express)

Framework: Express.js com middlewares personalizados
Banco de Dados: MongoDB Atlas (cloud) para persistência de dados
Storage Principal: Google Drive API v3 (storage oficial das imagens originais)
Cache Local: Sistema de cache inteligente usando 50GB de disco da Render
Processamento de Imagens: Sharp.js para conversão WebP e otimização
Autenticação: Sistema dual (códigos de cliente + admin login)
Email: Nodemailer para notificações de pedidos
Monitoramento: Sistema customizado de métricas e logs

Frontend (Vanilla JavaScript)

Arquitetura: SPA modular sem frameworks
Interface: Design responsivo com sidebar categorizada
Galeria: Carregamento progressivo com lazy loading
Lightbox: Visualização em alta qualidade com zoom avançado
Cache: Multiple layers (localStorage, sessionStorage, memory)
Estado: Gerenciamento de estado centralizado

Infraestrutura

Deploy: Render.com (plano Standard, 50GB disk)
CDN: Cache de imagens WebP servidas diretamente do disco local
Backup Storage: Google Drive como fallback
Database: MongoDB Atlas (free tier)
Automação: Scripts cron para manutenção e sincronização

Estrutura de Pastas
FOTOSYSTEM/
├── src/
│   ├── config/
│   │   ├── database.js          # Configuração MongoDB
│   │   └── google.drive.js      # Configuração Google Drive API
│   ├── controllers/
│   │   ├── adminController.js   # Lógica do painel administrativo
│   │   ├── orderController.js   # Processamento de pedidos
│   │   └── photoController.js   # Gerenciamento de fotos/categorias
│   ├── models/
│   │   ├── admin.js            # Modelo de administradores
│   │   ├── categoryAccess.js   # Controle de acesso por categoria
│   │   ├── categoryPrice.js    # Preços por categoria
│   │   ├── customerCode.js     # Códigos de acesso de clientes
│   │   └── order.js            # Pedidos
│   ├── routes/
│   │   ├── admin.js            # Rotas administrativas
│   │   ├── client.js           # Rotas do cliente
│   │   ├── orders.js           # Rotas de pedidos
│   │   └── photos.js           # Rotas de fotos/categorias
│   ├── services/
│   │   ├── cdeIntegrationService.js  # Integração sistema externo
│   │   ├── driveService.js          # Serviços Google Drive
│   │   ├── emailService.js          # Envio de emails
│   │   ├── mongoService.js          # Operações MongoDB
│   │   ├── monitoringService.js     # Monitoramento sistema
│   │   ├── queueService.js          # Filas de processamento
│   │   └── smartCache.js            # Sistema de cache inteligente
│   └── server.js               # Servidor principal
├── public/
│   ├── css/                    # Estilos modulares
│   ├── js/
│   │   ├── admin.js           # Interface administrativa
│   │   ├── api-client.js      # Cliente API centralizado
│   │   ├── auth.js            # Autenticação
│   │   ├── cart.js            # Carrinho de compras
│   │   ├── database-service.js # Abstração banco de dados
│   │   ├── gallery.js         # Galeria principal
│   │   ├── lightbox.js        # Visualizador de imagens
│   │   ├── price-manager.js   # Gerenciamento de preços
│   │   ├── sidebar.js         # Menu lateral categorias
│   │   └── utils.js           # Utilitários gerais
│   └── index.html             # Interface principal
├── scripts/
│   ├── cache-stats.js         # Estatísticas de cache
│   ├── convert-local-to-webp.js # Conversão local para WebP
│   ├── migrate-to-webp.js     # Migração completa Google Drive
│   ├── setup-cron.js          # Configuração automação
│   └── sync-drive-webp.js     # Sincronização incremental
└── storage/cache/             # Cache local (50GB Render)
    ├── webp/hd/              # Imagens HD em WebP
    ├── thumbnails/           # Miniaturas (small/medium/large)
    ├── persistent/           # Cache persistente
    └── temp/                 # Cache temporário
Funcionalidades Principais
Sistema de Autenticação

Clientes: Acesso via códigos de 4 dígitos gerados pelo admin
Administradores: Login tradicional (email/senha)
Controle de Acesso: Categorias específicas por cliente
Sessão Persistente: localStorage para admin, código para clientes

Galeria e Navegação

Carregamento Progressivo: Categorias carregadas sob demanda
Lazy Loading: Imagens carregadas conforme necessário
Cache Inteligente: Multiple layers (memory → disk → Google Drive)
Paginação: Batches de 20-50 imagens por categoria
Busca: Filtro de categorias em tempo real

Carrinho e Pedidos

Seleção Múltipla: Adicionar/remover itens do carrinho
Persistência: Seleções salvas automaticamente
Preços Dinâmicos: Por categoria com desconto por quantidade
Processamento: Background processing com emails automáticos
Organização: Pedidos organizados por categoria na pasta final

Painel Administrativo

Gerenciamento de Clientes: Criar/deletar códigos de acesso
Controle de Preços: Preços por categoria, atualizações em lote
Acesso Granular: Configurar quais categorias cada cliente vê
Gestão de Pedidos: Mover entre "Aguardando Pagamento" e "Vendido"
Monitoramento: Estatísticas de uso e cache

Sistema de Cache e Otimização
Estratégia de Cache (Performance Critical)
Cliente → Memory Cache → Disk Cache (50GB) → Google Drive (Fallback)
SmartCache System

Múltiplos Formatos: WebP HD + 3 tamanhos de thumbnail
Priorização: Categorias populares mantidas em disco
Limpeza Automática: Baseada em uso e idade
Memory Cache: 500MB para acesso ultra-rápido
Compressão: WebP com qualidade 85-90 (HD) e 80 (thumbnails)

Pipeline de Otimização

Conversão Local: Scripts para converter 2500+ imagens
Upload Inteligente: Estrutura de pastas preservada
Metadados: JSON com informações de cache
Sincronização: Automática via cron jobs
Monitoramento: Estatísticas detalhadas de uso

Fluxo de Dados
Carregamento de Imagens
1. Cliente solicita categoria
2. Verifica cache em memória
3. Se não existe, verifica disco local (WebP)
4. Se não existe, baixa do Google Drive
5. Converte para WebP e armazena localmente
6. Serve para cliente com headers de cache agressivos
Processamento de Pedidos
1. Cliente finaliza seleção
2. Sistema cria pasta no Google Drive (formato: "Nome XXun Mês Dia Ano")
3. Organiza fotos por categoria em subpastas
4. Move pasta para "Waiting Payment"
5. Envia email com detalhes e link
6. Admin pode mover para "Sold" quando pago
Gerenciamento de Estado
1. Códigos de cliente → MongoDB
2. Seleções ativas → localStorage + MongoDB
3. Cache de categorias → sessionStorage
4. Imagens processadas → Memory + Disk
5. Configurações admin → MongoDB
API Endpoints
Autenticação

GET /api/db/customerCodes/:code - Validar código cliente
POST /api/admin/login - Login administrativo

Galeria

GET /api/client/initial-data?code=:code - Dados iniciais otimizados
GET /api/photos?category_id=:id&customer_code=:code - Fotos por categoria
GET /api/photos/categories?customer_code=:code - Lista de categorias
GET /api/orders/thumbnail/:fileId - Thumbnail otimizado
GET /api/orders/highres-image/:fileId - Imagem HD

Pedidos

POST /api/orders - Criar novo pedido
GET /api/orders/folders?status=:status - Listar pedidos por status
PUT /api/orders/status - Atualizar status do pedido
GET /api/orders/details?folderId=:id - Detalhes do pedido

Administração

POST /api/admin/code - Gerar código cliente
GET /api/admin/codes - Listar códigos ativos
DELETE /api/admin/code/:code - Deletar código
GET /api/admin/folders/leaf - Categorias (pastas folha)
POST /api/admin/categories/:id/price - Definir preço categoria
POST /api/admin/categories/batch-update - Atualização em lote
GET /api/admin/customers/:code/category-access - Acesso por categoria
POST /api/admin/customers/:code/category-access - Configurar acesso

Scripts de Automação
Conversão e Migração
bash# Conversão local (desenvolvimento)
node scripts/convert-local-to-webp.js

# Migração completa do Google Drive
node scripts/migrate-to-webp.js

# Sincronização incremental
node scripts/sync-drive-webp.js
Manutenção Automática (Cron Jobs)
bash# Sincronização a cada 6 horas
0 */6 * * * node scripts/sync-drive-webp.js

# Limpeza de cache diária (3 AM)
0 3 * * * node scripts/cache-cleanup.js

# Estatísticas horárias
0 * * * * node scripts/cache-stats.js
Monitoramento
bash# Estatísticas detalhadas
node scripts/cache-stats.js

# Status do sistema
curl http://localhost:3000/api/status
Configuração e Variáveis de Ambiente
env# Servidor
PORT=3000
NODE_ENV=production

# MongoDB Atlas
MONGODB_URI=mongodb+srv://...

# Google Drive API
GOOGLE_CREDENTIALS={"type":"service_account",...}
DRIVE_FOLDER_ID=1abc...
WAITING_PAYMENT_FOLDER_ID=1def...
SOLD_FOLDER_ID=1ghi...

# Cache e Storage
CACHE_STORAGE_PATH=/opt/render/project/storage/cache
CACHE_PRELOAD_ON_START=true
ENABLE_WEBP_CONVERSION=true

# Email
EMAIL_USER=sales.sunshinecowhides@gmail.com
EMAIL_PASSWORD=app_specific_password

# Admin
ADMIN_EMAIL=sales.sunshinecowhides@gmail.com
ADMIN_PASSWORD=SUNcow1!

# Integração Externa (CDE)
CDE_ENDPOINT_URL=https://...
CDE_SECURITY_TOKEN=secret_token
Otimizações de Performance
Frontend

Module Splitting: JavaScript modular por funcionalidade
Lazy Loading: Imagens e categorias sob demanda
Progressive Enhancement: Interface utilizável durante carregamento
Memory Management: Limpeza automática de cache
Prefetching: Próximas imagens carregadas em background

Backend

Connection Pooling: MongoDB com pool otimizado
Compression: Gzip para todas as respostas
Cache Headers: Agressivos para assets estáticos
Queue System: Processamento assíncrono de imagens
Memory Monitoring: Garbage collection e alertas

Render.com Optimizations

50GB Disk: Cache local para servir imagens instantaneamente
Static Serving: Express.static com cache headers otimizados
Process Management: Graceful shutdown e restart
Health Checks: Endpoint /api/status para monitoramento
Resource Limits: CPU e memória otimizados para o plano Standard

Segurança
Autenticação e Autorização

Códigos Únicos: 4 dígitos únicos por cliente
Acesso Granular: Controle por categoria
Session Management: Tokens seguros para admin
Rate Limiting: Proteção contra spam
CORS: Configuração adequada para produção

Proteção de Dados

Environment Variables: Credenciais não expostas
MongoDB Atlas: Conexão criptografada
Google Drive: Service Account com permissões mínimas
File Access: Validação de IDs e permissões
Error Handling: Logs sem exposição de dados sensíveis

Estrutura Hierárquica das Imagens
Google Drive (Fonte Original)
Sunshine Cowhides Actual Pictures/
├── Categoria A/
│   ├── Subcategoria A1/
│   │   ├── foto001.jpg
│   │   └── foto002.heic
│   └── Subcategoria A2/
├── Categoria B/
├── Waiting Payment/
│   └── Cliente João 5un Jan 15 2025/
│       ├── Categoria A/
│       └── Categoria B/
└── Sold/
    └── Cliente Maria 8un Jan 10 2025/
Cache Local (Performance)
storage/cache/
├── webp/hd/
│   ├── 1abc123.webp
│   └── 1def456.webp
├── thumbnails/
│   ├── small/1abc123.webp
│   ├── medium/1abc123.webp
│   └── large/1abc123.webp
└── metadata/
    └── 1abc123.json
Métricas e Monitoramento
Dashboards Disponíveis

Cache Performance: Hit rate, storage usage, categorias populares
System Health: CPU, memória, requests, errors
Business Metrics: Pedidos, conversões, categorias mais vendidas
Google Drive: Quota usage, sync status, erro rate

Alertas Configurados

Memory Usage: > 85% do sistema
Disk Space: > 90% dos 50GB
Error Rate: > 5% das requests
Google Drive Quota: Próximo do limite
Email Failures: Problemas no envio

Deployment
Processo de Deploy (Render.com)

Build: npm install && npm run build
Environment: Variáveis configuradas no dashboard
Storage: 50GB disk montado em /opt/render/project/storage
Health Check: /api/status retorna métricas
Logs: Centralizados no dashboard Render

Manutenção Pós-Deploy

Sync Inicial: Executar migração WebP
Cron Setup: Configurar jobs automáticos
Cache Warm-up: Pre-load categorias populares
Monitoring: Verificar métricas e alertas
Backup Verification: Testar fallback para Google Drive

Roadmap Futuro
Melhorias Planejadas

CDN Integration: CloudFlare para cache global
Progressive Web App: Instalação mobile
Advanced Analytics: Tracking detalhado de uso
API Rate Limiting: Proteção avançada
Multi-language: Suporte a múltiplos idiomas

Escalabilidade

Database Sharding: Para crescimento de dados
Load Balancing: Multiple instances
Microservices: Separação de responsabilidades
Event-Driven: Architecture assíncrona
Cache Distribution: Redis cluster para cache compartilhado

Este sistema representa uma solução completa e otimizada para catálogo e venda de produtos premium,
com foco especial em performance através de cache inteligente e otimização de imagens,
aproveitando ao máximo os recursos disponíveis na infraestrutura da Render.com.