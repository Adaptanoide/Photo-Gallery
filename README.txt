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
ARQUITETURA


Front-end: HTML5, CSS3 e JavaScript
Back-end: Node.js com Express (API REST)
Banco de Dados: MongoDB
Armazenamento de Imagens: Google Drive API
Autenticação: Sistema baseado em códigos de acesso para clientes e login tradicional para administradores

TECNOLOGIAS UTILIZADAS

Front-end
- HTML5, CSS3
- JavaScript (Vanilla)
- Lazy Loading com IntersectionObserver
- Design Responsivo
Back-end
- Node.js e Express.js
- MongoDB
- Google Drive API
- Sharp (processamento de imagens)
- Nodemailer (emails)
- Bcrypt (criptografia)
DevOps
- Git (controle de versão)
- Oracle Cloud Free Tier (hospedagem planejada)
- NPM (gerenciamento de dependências)
- dotenv (variáveis de ambiente)
FUNCIONALIDADES PRINCIPAIS


Sistema de Catálogo

Carregamento otimizado de imagens
Visualização em lightbox com zoom
Organização por categorias


Sistema de Preços

Preços base por categoria
Preços personalizados por cliente
Sistema de descontos baseado em quantidade


Processamento de Pedidos

Fluxo assíncrono com confirmação imediata
Organização automática em pastas no Google Drive
Notificações por email


Gerenciamento de Acesso

Controle granular por cliente e categoria
Histórico de acessos
Inativação de códigos



ESTRUTURA DO PROJETO

fotosystem/
├── public/                # Arquivos estáticos (frontend)
│   ├── css/              # Folhas de estilo
│   │   └── main.css      # Estilos principais
│   ├── js/               # Scripts do cliente
│   │   ├── admin.js      # Funcionalidades administrativas
│   │   ├── api-client.js # Cliente de API
│   │   ├── auth.js       # Autenticação
│   │   ├── cart.js       # Gerenciamento do carrinho
│   │   ├── gallery.js    # Exibição da galeria
│   │   └── ... (outros)
│   └── index.html        # Página principal
│
├── src/                   # Código-fonte (backend)
│   ├── config/           # Configurações
│   ├── controllers/      # Controladores
│   ├── models/           # Modelos de dados
│   ├── routes/           # Rotas da API
│   ├── services/         # Serviços
│   └── server.js         # Ponto de entrada
│
├── cache/                 # Cache local
├── .env                   # Variáveis de ambiente
├── credentials.json       # Credenciais do Google Drive
└── package.json           # Dependências e scripts
MODELOS DE DADOS


CustomerCode - Códigos de acesso dos clientes
CategoryAccess - Configuração de acesso às categorias por cliente
CategoryPrice - Preços das categorias
Order - Pedidos realizados
Admin - Administradores do sistema

API ENDPOINTS (RESUMO)

Fotos
- GET /api/photos - Obter fotos com filtros
- GET /api/photos/categories - Obter categorias disponíveis
Pedidos
- POST /api/orders - Criar novo pedido
- GET /api/orders/folders - Listar pastas de pedidos
- PUT /api/orders/status - Atualizar status do pedido
Administração
- POST /api/admin/login - Autenticar administrador
- POST /api/admin/code - Gerar código de cliente
- GET /api/admin/codes - Listar códigos ativos
- DELETE /api/admin/code/:code - Excluir código
- POST /api/admin/categories/:folderId/price - Definir preço
Cliente
- GET /api/client/initial-data - Obter dados iniciais
- POST /api/client/selections - Salvar seleções
REQUISITOS DE INSTALAÇÃO

Servidor
- Node.js v14+
- NPM
- Mínimo 1GB RAM
- 10GB+ espaço para cache
Variáveis de Ambiente (.env)
PORT=3000
DRIVE_FOLDER_ID=id_da_pasta_raiz
WAITING_PAYMENT_FOLDER_ID=id_da_pasta_aguardando_pagamento
SOLD_FOLDER_ID=id_da_pasta_vendidos
ADMIN_EMAIL=email_do_administrador
ADMIN_PASSWORD=senha_do_administrador
EMAIL_USER=email_para_notificacoes
EMAIL_PASSWORD=senha_de_app_do_email
MONGODB_URI=uri_de_conexao_do_mongodb
FLUXOS DE TRABALHO

Cliente

Recebe código de acesso (4 dígitos)
Faz login no sistema
Navega pelo catálogo personalizado
Adiciona produtos ao carrinho
Finaliza o pedido
Recebe confirmação

Administrador

Faz login com email/senha
Gerencia códigos de acesso
Configura categorias e preços
Processa pedidos
Organiza o catálogo

OTIMIZAÇÕES


Lazy loading de imagens
Cache local de arquivos
Processamento assíncrono de pedidos
Compressão de imagens com Sharp
Carregamento em lotes para performance

DESIGN VISUAL


Paleta de cores: Dourado (#D4AF37), Creme (#F8F5F0), Tons escuros (#212529)
Tipografia: 'Playfair Display' (títulos), 'Montserrat' (corpo)
Design responsivo para todos dispositivos

EXPANSÕES FUTURAS


Implementação de CDN
Progressive Web App (PWA)
Sistema de pedidos recorrentes
Dashboard analítico
Suporte multi-idioma

==================================================
Desenvolvido para Sunshine Cowhides
Documentação Técnica Completa - v1.0