SUNSHINE COWHIDES
Sistema de Gerenciamento e Venda de Couro Bovino
==================================================

VISÃO GERAL

O Sistema de Gerenciamento e Venda de Couro Bovino (Sunshine Cowhides) é
uma aplicação web completa projetada para facilitar a comercialização de
produtos de couro premium através de um catálogo digital. O sistema
permite que clientes visualizem uma seleção personalizada de produtos,
façam pedidos digitais, e que administradores gerenciem o inventário, os
clientes e processem os pedidos.

Este sistema atende a um modelo de negócio B2B (Business-to-Business)
baseado em acesso controlado, onde cada cliente recebe um código único
para acessar o catálogo, frequentemente com preços e produtos
personalizados para suas necessidades específicas.

TECNOLOGIAS UTILIZADAS

Front-end:
- HTML5, CSS3 (Sistema modular)
- JavaScript (Vanilla)
- Design Responsivo
- Lazy Loading com IntersectionObserver
- Sistema de Tutorial Interativo

Back-end:
- Node.js com Express.js (API REST)
- MongoDB (Banco de Dados Principal)
- Google Drive API (Armazenamento de Imagens)
- Sharp (Processamento de Imagens)
- Nodemailer (Sistema de Email)
- Bcrypt (Criptografia de Senhas)

DevOps:
- Git (Controle de Versão)
- NPM (Gerenciamento de Dependências)
- dotenv (Variáveis de Ambiente)

FUNCIONALIDADES PRINCIPAIS

Sistema de Catálogo:
- Carregamento otimizado de imagens com cache inteligente
- Visualização em lightbox com zoom avançado
- Organização por categorias hierárquicas
- Sistema de pré-carregamento progressivo

Sistema de Preços:
- Preços base por categoria
- Preços personalizados por cliente
- Sistema de descontos baseado em quantidade
- Atualização em lote de preços

Processamento de Pedidos:
- Fluxo assíncrono com confirmação imediata
- Organização automática em pastas no Google Drive
- Separação por categorias
- Notificações por email com resumo detalhado
- Integração com sistema CDE (opcional)

Gerenciamento de Acesso:
- Controle granular por cliente e categoria
- Histórico de acessos
- Sistema de códigos únicos (4 dígitos)
- Painel administrativo completo

ESTRUTURA DO PROJETO

fotosystem/
├── public/                # Arquivos estáticos (frontend)
│   ├── css/              # Folhas de estilo modulares
│   │   ├── main-modular.css  # Arquivo principal que importa todos
│   │   ├── base/         # Estilos base (reset, variáveis, tipografia)
│   │   ├── layout/       # Layout (grid, header, container)
│   │   ├── components/   # Componentes (botões, forms, modais)
│   │   ├── modules/      # Módulos (cart, gallery, lightbox)
│   │   ├── pages/        # Páginas específicas (admin, login)
│   │   └── utilities/    # Utilitários (animações, helpers)
│   ├── js/               # Scripts do cliente
│   │   ├── admin.js      # Funcionalidades administrativas
│   │   ├── api-client.js # Cliente para comunicação com API
│   │   ├── auth.js       # Sistema de autenticação
│   │   ├── cart.js       # Gerenciamento do carrinho
│   │   ├── database-service.js # Abstração para MongoDB
│   │   ├── gallery.js    # Galeria de fotos
│   │   ├── lightbox.js   # Visualizador de imagens
│   │   ├── price-manager.js # Gerenciamento de preços
│   │   ├── sidebar.js    # Menu lateral de categorias
│   │   └── utils.js      # Utilitários gerais
│   └── index.html        # Página principal
│
├── src/                   # Código-fonte (backend)
│   ├── config/           # Configurações
│   │   ├── database.js   # Configuração do MongoDB
│   │   └── google.drive.js # Configuração do Google Drive
│   ├── controllers/      # Controladores (lógica de negócio)
│   │   ├── adminController.js
│   │   ├── orderController.js
│   │   └── photoController.js
│   ├── models/           # Modelos de dados (MongoDB)
│   │   ├── admin.js
│   │   ├── categoryAccess.js
│   │   ├── categoryPrice.js
│   │   ├── customerCode.js
│   │   └── order.js
│   ├── routes/           # Rotas da API
│   │   ├── admin.js
│   │   ├── client.js
│   │   ├── config.js
│   │   ├── db.js
│   │   ├── orders.js
│   │   └── photos.js
│   ├── services/         # Serviços
│   │   ├── cdeIntegrationService.js
│   │   ├── driveService.js
│   │   ├── emailService.js
│   │   ├── mongoService.js
│   │   ├── monitoringService.js
│   │   ├── queueService.js
│   │   └── smartCache.js
│   └── server.js         # Ponto de entrada
│
├── cache/                 # Cache local de imagens
├── .env                   # Variáveis de ambiente
├── credentials.json       # Credenciais do Google Drive
├── package.json           # Dependências e scripts
└── README.txt             # Este arquivo

MODELOS DE DADOS (MongoDB)

CustomerCode - Códigos de acesso dos clientes
- code: String (4 dígitos únicos)
- customerName: String
- createdAt: Date
- lastAccess: Date
- items: Array (seleções do cliente)
- orderStatus: String

CategoryAccess - Configuração de acesso às categorias por cliente
- customerCode: String
- categoryAccess: Array de objetos com:
  - categoryId: String
  - enabled: Boolean
  - customPrice: Number
  - minQuantityForDiscount: Number
  - discountPercentage: Number

CategoryPrice - Preços das categorias
- folderId: String (ID da pasta no Google Drive)
- name: String
- price: Number
- updatedAt: Date
- path: String

Order - Pedidos realizados
- customerCode: String
- customerName: String
- photoIds: Array
- comments: String
- status: String (processing, waiting_payment, paid, failed)
- createdAt: Date
- processedAt: Date
- folderName: String
- folderId: String

Admin - Administradores do sistema
- email: String
- password: String (criptografado com bcrypt)

API ENDPOINTS RESUMO

Autenticação e Cliente:
- GET  /api/client/initial-data    # Dados iniciais do cliente
- POST /api/client/selections      # Salvar seleções do cliente
- POST /api/client/clear-cache     # Limpar cache do servidor

Fotos e Categorias:
- GET  /api/photos                 # Obter fotos com filtros
- GET  /api/photos/categories      # Obter categorias disponíveis

Pedidos:
- POST /api/orders                 # Criar novo pedido
- GET  /api/orders/folders         # Listar pastas de pedidos
- PUT  /api/orders/status          # Atualizar status do pedido
- GET  /api/orders/details         # Obter detalhes de um pedido
- GET  /api/orders/highres-image/:fileId  # Imagem em alta resolução
- GET  /api/orders/thumbnail/:fileId      # Thumbnail de imagem

Administração:
- POST /api/admin/login            # Autenticar administrador
- POST /api/admin/code             # Gerar código de cliente
- GET  /api/admin/codes            # Listar códigos ativos
- DELETE /api/admin/code/:code     # Excluir código
- GET  /api/admin/folders/leaf     # Obter pastas finais (categorias)
- GET  /api/admin/categories/prices # Obter preços das categorias
- POST /api/admin/categories/:folderId/price  # Definir preço
- POST /api/admin/categories/batch-update     # Atualização em lote
- GET  /api/admin/customers/:code/category-access  # Acesso do cliente
- POST /api/admin/customers/:code/category-access  # Configurar acesso

Sistema e Banco de Dados:
- GET  /api/status                 # Status do sistema
- GET  /api/db/:collection         # Obter coleção do MongoDB
- GET  /api/db/:collection/:id     # Obter documento específico
- PATCH /api/db/:collection/:id    # Atualizar documento

INSTALAÇÃO E CONFIGURAÇÃO

Requisitos:
- Node.js v14+ 
- NPM v6+
- Conta Google com Drive API habilitada
- MongoDB (local ou Atlas)
- Mínimo 1GB RAM
- 10GB+ espaço para cache

Passos de Instalação:

1. Clone o repositório:
   git clone [url-do-repositorio]
   cd fotosystem

2. Instale as dependências:
   npm install

3. Configure as variáveis de ambiente (.env):
   PORT=3000
   DRIVE_FOLDER_ID=id_da_pasta_raiz_google_drive
   WAITING_PAYMENT_FOLDER_ID=id_pasta_aguardando_pagamento
   SOLD_FOLDER_ID=id_pasta_vendidos
   ADMIN_EMAIL=email_do_administrador
   ADMIN_PASSWORD=senha_do_administrador
   EMAIL_USER=email_para_notificacoes
   EMAIL_PASSWORD=senha_de_app_do_email
   MONGODB_URI=mongodb_connection_string
   CDE_ENDPOINT_URL=url_sistema_cde (opcional)
   CDE_SECURITY_TOKEN=token_seguranca_cde (opcional)

4. Configure as credenciais do Google Drive:
   - Crie um Service Account no Google Cloud Console
   - Baixe o arquivo JSON de credenciais
   - Renomeie para 'credentials.json' na raiz do projeto
   - Compartilhe as pastas do Drive com o email do Service Account

5. Inicie o servidor:
   npm start

FLUXOS DE TRABALHO

Fluxo do Cliente:
1. Recebe código de acesso (4 dígitos)
2. Faz login no sistema
3. Navega pelo catálogo personalizado
4. Adiciona produtos ao carrinho
5. Finaliza o pedido com comentários opcionais
6. Recebe confirmação automática

Fluxo do Administrador:
1. Faz login com email/senha
2. Gerencia códigos de acesso
3. Configura categorias e preços
4. Define acesso personalizado por cliente
5. Processa pedidos (Aguardando → Vendidos)
6. Organiza o catálogo no Google Drive

Fluxo de Processamento de Pedidos:
1. Cliente finaliza pedido
2. Sistema processa em segundo plano:
   - Cria pasta com nome do cliente
   - Move fotos para subpastas por categoria
   - Envia notificação por email
   - Integra com sistema CDE (se configurado)
3. Administrador marca como "Pago" quando necessário
4. Sistema move pasta para seção "Vendidos"

FUNCIONALIDADES AVANÇADAS

Sistema de Cache Inteligente:
- Cache local de imagens otimizadas
- Cache em memória para APIs
- Limpeza automática baseada em uso

Processamento de Imagens:
- Redimensionamento automático
- Compressão adaptativa
- Múltiplos formatos (JPEG, WebP)
- Sistema de thumbnails

Interface Avançada:
- Tutorial interativo para novos usuários
- Lightbox com zoom e navegação
- Carregamento progressivo por categoria
- Design responsivo completo

Monitoramento:
- Logs detalhados de sistema
- Métricas de performance
- Alertas de memória/CPU
- Status em tempo real

DESIGN E UI/UX

Paleta de Cores:
- Dourado: #D4AF37 (Destaque principal)
- Creme: #F8F5F0 (Fundo)
- Escuro: #212529 (Texto principal)
- Taupe: #483C32 (Texto secundário)

Tipografia:
- Títulos: 'Playfair Display' (elegante, serif)
- Corpo: 'Montserrat' (moderna, sans-serif)

Características:
- Design responsivo para todos dispositivos
- Animações suaves com CSS3
- Interface intuitiva e acessível
- Loading states informativos

SEGURANÇA

Autenticação:
- Clientes: Códigos únicos de 4 dígitos
- Administradores: Email/senha com bcrypt
- Sessões baseadas em localStorage

Autorização:
- Controle granular de acesso a categorias
- Preços personalizados por cliente
- Validação de permissões em todas as rotas

Proteção de Dados:
- Variáveis de ambiente para dados sensíveis
- Validação de entrada em todas as APIs
- Tratamento seguro de erros
- Headers de segurança configurados

OTIMIZAÇÕES

Performance:
- Lazy loading de imagens
- Cache local e em memória
- Processamento assíncrono de pedidos
- Compressão de assets
- Carregamento em lotes

SEO e Acessibilidade:
- HTML semântico
- Alt texts para imagens
- Navegação por teclado
- Indicadores de loading
- Feedback visual consistente

TROUBLESHOOTING

Problemas Comuns:

1. Erro de conexão MongoDB:
   - Verificar string de conexão
   - Confirmar acesso à rede
   - Checar credenciais

2. Falha no Google Drive:
   - Verificar permissions do Service Account
   - Confirmar IDs das pastas
   - Checar cota da API

3. Emails não enviados:
   - Verificar configurações SMTP
   - Confirmar senha de app do Gmail
   - Checar filtros de spam

4. Problemas de cache:
   - Limpar cache via /api/client/clear-cache
   - Reiniciar servidor
   - Verificar espaço em disco

Logs:
- Logs detalhados no console
- Arquivos de log rotativos (se configurado)
- Monitoramento de erros em tempo real

EXPANSÕES FUTURAS

Funcionalidades Planejadas:
- Implementação de CDN
- Progressive Web App (PWA)
- Sistema de pedidos recorrentes
- Dashboard analítico avançado
- Suporte multi-idioma
- API de integrações com terceiros
- Sistema de reviews/avaliações
- Relatórios de vendas automatizados

Melhorias Técnicas:
- Containerização com Docker
- Pipeline de CI/CD
- Testes automatizados
- Backup automatizado
- Escalabilidade horizontal

EQUIPE DE DESENVOLVIMENTO

Para suporte técnico, manutenção ou questões sobre o sistema,
entre em contato com a equipe responsável.

VERSIONAMENTO

v1.0 - Versão inicial com funcionalidades básicas
v2.0 - Migração para MongoDB, interface melhorada, sistema de cache
v2.1 - Sistema de tutorial, otimizações de performance

==================================================
Desenvolvido para Sunshine Cowhides
Documentação Técnica Completa - v2.1
Última atualização: Maio 2025
==================================================