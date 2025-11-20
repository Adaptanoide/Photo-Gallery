# 🐄 Sunshine Cowhides - B2B Gallery System

B2B e-commerce platform for exclusive cowhide products where each photo represents a unique item. Built for American clients with real-time inventory integration with CDE warehouse system.

## 🎯 Overview

Specialized e-commerce platform featuring:
- Secure access via 4-digit codes
- Browse exclusive cowhide categories
- Shopping cart with 24-hour temporary reservations
- Dynamic Mix & Match volume pricing
- Automatic sync with MySQL warehouse database (CDE)
- Complete administrative selection management

**Core Principle:** CDE (warehouse system) is ALWAYS the source of truth.

## ⚡ Tech Stack

### Backend
- **Node.js** + Express
- **MongoDB Atlas** - Main database
- **MySQL** - CDE (warehouse inventory)
- **JWT** - Authentication

### Frontend
- Modular Vanilla JavaScript
- Modern CSS with custom design system
- Real-time polling for inventory updates

### Infrastructure
- **Cloudflare R2** - Storage for 3000+ photos (WebP)
- **Cloudflare CDN** - Optimized image delivery
- **Render.com** - Hosting and deployment

## 🚀 Running Locally

### Prerequisites
```bash
Node.js 18+
npm or yarn
MongoDB Atlas account
CDE (MySQL) access
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Adaptanoide/Photo-Gallery.git
cd Photo-Gallery
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (`.env`):
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=your_connection_string
CDE_HOST=216.246.112.6
CDE_DATABASE=tzwgctib_inventario
# ... other variables
```

4. Run the server:
```bash
npm run dev
```

5. Access: `http://localhost:3000`

## 📁 Project Structure
```
Photo-Gallery/
├── src/
│   ├── server.js              # Main server + CDE sync
│   ├── models/                # MongoDB models
│   ├── routes/                # API routes
│   └── services/              
│       ├── CDEIncrementalSync.js  # CDE synchronization
│       ├── CartService.js         # Cart logic
│       └── R2Service.js           # Cloudflare R2 integration
├── public/
│   ├── js/
│   │   ├── client-gallery.js  # Client gallery
│   │   └── admin-selections.js # Admin management
│   └── css/                   # Modular styles
└── scripts/                   # Maintenance scripts
```

## 🔄 Status System (CDE ↔ MongoDB)

| CDE Status | MongoDB Status | Description |
|------------|---------------|-------------|
| INGRESADO | available | Available for sale |
| PRE-SELECTED | reserved | In cart (24h reservation) |
| CONFIRMED | in_selection | Awaiting admin approval |
| RETIRADO | sold | Sale finalized |
| RESERVED/STANDBY | unavailable | Temporarily unavailable |

## 💰 Mix & Match Pricing

Automatic volume discounts:
- 1-5 items: Base price
- 6-12 items: Level 1 discount
- 13-36 items: Level 2 discount
- 37+ items: Maximum discount

## 🔐 Authentication

- **Clients**: 4-digit access code
- **Admin**: Traditional login with JWT
- Granular permissions per category

## 🛠️ Useful Commands
```bash
npm run dev          # Run in development
npm start            # Run in production
npm run test         # Test CDE-MongoDB integrity
```

## 📊 Monitoring

- CDE sync every 5 minutes
- Detailed logs for critical operations
- Slack notifications for important events
- Real-time administrative dashboard

## 🔗 Integrations

- **CDE (MySQL)**: Warehouse inventory system
- **Cloudflare R2**: Image storage
- **Slack**: Sales notifications
- **Email**: Confirmations and notifications

## 📝 License

Property of Sunshine Cowhides. All rights reserved.

## 👨‍💻 Developer

Developed and maintained by **Tiago** ([@Adaptanoide](https://github.com/Adaptanoide))