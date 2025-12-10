# 🔧 PLANO DE MELHORIA DO INVENTORY MONITOR

## 🎯 OBJETIVOS

Transformar o Inventory Monitor em um sistema **robusto, preciso e acionável**.

## 📊 RESUMO DA ANÁLISE ATUAL

**BOAS NOTÍCIAS:** ✅
- 0 fotos ativas com duplicatas no CDE
- Sistema relativamente limpo
- Poucos problemas críticos

**PROBLEMAS DETECTADOS:**
- 🔙 **13-15 Retornos** não atualizados (sold no MongoDB, INGRESADO no CDE)
- 🔀 **1 Pase** detectado (mudança de categoria)
- 📷 **5-10 Fotos** sem imagem no R2

---

## 🚀 MELHORIAS PROPOSTAS

### 1️⃣ **SISTEMA DE AÇÕES COM BOTÕES**

Cada problema detectado terá botões de ação:

```
┌─────────────────────────────────────────┐
│ 🔙 RETORNO - Foto 026                   │
│ MongoDB: sold | CDE: INGRESADO         │
│ QB: 5301SB → 5302B TP                  │
│                                         │
│ [✅ Corrigir Automaticamente]           │
└─────────────────────────────────────────┘
```

### 2️⃣ **MODAL PARA DECISÕES COMPLEXAS**

Para pases que requerem mover fotos no R2:

```
Modal: Escolher Destino da Foto
- Tree selector de categorias
- Preview das mudanças
- Confirmação antes de executar
```

### 3️⃣ **EXECUÇÃO COMPLETA AUTOMÁTICA**

Quando admin clica no botão:
- ✅ Atualiza MongoDB (status, QB, categoria, preços)
- ✅ Move fotos no R2 (4 versões)
- ✅ Atualiza todos os paths
- ✅ Recalcula preços via PhotoCategory
- ✅ Registra log completo

---

## 🎨 TIPOS DE AÇÕES

### **RETORNO SIMPLES**
- Foto voltou ao estoque, mesma categoria
- Ação: `sold → available`

### **RETORNO + PASE**
- Foto voltou E mudou de categoria
- Ação: `sold → available` + atualizar QB

### **PASE SIMPLES**
- Mudou de categoria, mesmo país
- Ação: Atualizar MongoDB apenas

### **PASE COMPLEXO**
- Mudou de país (52→53 ou 53→52)
- Ação: Atualizar MongoDB + Mover no R2

---

## 🛠️ IMPLEMENTAÇÃO

### Backend:
```javascript
// src/routes/monitor-actions.js
POST /api/monitor/actions/retorno
POST /api/monitor/actions/pase-simples
POST /api/monitor/actions/pase-complexo
```

### Frontend:
```javascript
// public/js/monitor-actions.js
- Botões de ação em cada card
- Modais de confirmação
- Tree selector de destinos
- Feedback visual (loading, success, error)
```

---

## ✅ PRÓXIMOS PASSOS

1. ✅ Reativar fotos desativadas
2. 🔄 Implementar backend de ações
3. 🔄 Melhorar interface do monitor
4. 🔄 Testar com casos reais

---

**Última atualização:** 2025-12-09
