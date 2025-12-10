# 🧪 GUIA DE TESTE - MONITOR ACTIONS API

## 📋 O QUE FOI IMPLEMENTADO

### Backend Completo

✅ **MonitorActionService.js** (`src/services/MonitorActionService.js`)
- Serviço com 3 métodos principais para corrigir problemas detectados pelo monitor
- Integração completa com CDE (MySQL), MongoDB e R2 (Cloudflare)
- Sistema de rollback em caso de falhas
- Logs detalhados de todas as operações

✅ **Monitor Actions Routes** (`src/routes/monitor-actions.js`)
- 3 endpoints POST para executar ações
- Autenticação obrigatória de admin
- Validação completa de dados
- Respostas detalhadas com before/after

✅ **Integração no Server.js**
- Rotas adicionadas em `/api/monitor-actions/*`
- Sistema pronto para uso em localhost

---

## 🚀 COMO TESTAR EM LOCALHOST

### Passo 1: Iniciar o Servidor

```bash
npm run dev
```

Aguarde até ver:
```
SERVIDOR SUNSHINE COWHIDES v2.1
Porta: 3000
URL: http://localhost:3000
```

### Passo 2: Fazer Login como Admin

**Endpoint:** `POST http://localhost:3000/api/auth/admin/login`

**Body (JSON):**
```json
{
  "username": "seu_admin_username",
  "password": "sua_senha"
}
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "admin",
    "role": "admin"
  }
}
```

⚠️ **IMPORTANTE:** Copie o `token` - você vai precisar dele para todas as próximas requisições!

---

## 🔧 TESTANDO AS AÇÕES

### AÇÃO 1: Corrigir Retorno

**Quando usar:** Foto está marcada como `sold` no MongoDB mas está `INGRESADO` no CDE (voltou ao estoque)

**Endpoint:** `POST http://localhost:3000/api/monitor-actions/retorno`

**Headers:**
```
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "photoNumber": "00026",
  "adminUser": "admin@email.com"
}
```

**O que a ação faz:**
1. ✅ Valida que foto existe no MongoDB
2. ✅ Verifica status no CDE (deve ser INGRESADO)
3. ✅ Valida que foto está como `sold` no MongoDB
4. ✅ Atualiza MongoDB:
   - `status: sold → available`
   - `cdeStatus: → INGRESADO`
   - `currentStatus: → available`
   - Remove `selectionId` e `reservedBy`
5. ✅ Se QB mudou durante o retorno, atualiza também

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Foto 00026 marcada como disponível",
  "data": {
    "photoNumber": "00026",
    "action": "retorno",
    "changes": {
      "before": {
        "status": "sold",
        "cdeStatus": "RETIRADO",
        "qbItem": "5301SB"
      },
      "after": {
        "status": "available",
        "cdeStatus": "INGRESADO",
        "qbItem": "5302B TP"
      }
    },
    "timestamp": "2025-12-09T..."
  }
}
```

**Resposta de erro (exemplo):**
```json
{
  "success": false,
  "message": "Foto 00026 não encontrada no MongoDB",
  "photoNumber": "00026"
}
```

---

### AÇÃO 2: Aplicar Pase Simples

**Quando usar:** Foto mudou de categoria (QB diferente) mas continua no mesmo país (mesma pasta no R2)

**Endpoint:** `POST http://localhost:3000/api/monitor-actions/pase-simples`

**Headers:**
```
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "photoNumber": "00142",
  "adminUser": "admin@email.com"
}
```

**O que a ação faz:**
1. ✅ Busca foto no MongoDB
2. ✅ Busca QB correto no CDE
3. ✅ Valida que QB realmente mudou
4. ✅ Busca nova categoria no PhotoCategory
5. ✅ Atualiza MongoDB:
   - `qbItem: → novo QB do CDE`
   - `category: → novo displayName`
6. ❌ **NÃO move fotos no R2** (isso é o pase simples!)

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Pase aplicado com sucesso",
  "data": {
    "photoNumber": "00142",
    "action": "pase-simples",
    "changes": {
      "before": {
        "qbItem": "5301SB",
        "category": "Brazilian Solid Black"
      },
      "after": {
        "qbItem": "5302B TP",
        "category": "Brazilian Top Selected Black White"
      }
    },
    "timestamp": "2025-12-09T..."
  }
}
```

---

### AÇÃO 3: Aplicar Pase Complexo (com R2)

**Quando usar:** Foto mudou de categoria E precisa mover no R2 (mudança de país ou pasta principal)

**Endpoint:** `POST http://localhost:3000/api/monitor-actions/pase-complexo`

**Headers:**
```
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "photoNumber": "00026",
  "destinationPath": "Brazil Top Selected Categories/5302B - Brazilian Top Selected Black White",
  "destinationQB": "5302B TP",
  "adminUser": "admin@email.com"
}
```

**O que a ação faz:**
1. ✅ Busca foto no MongoDB
2. ✅ Valida que tem `r2Path`
3. ✅ **MOVE 4 VERSÕES DA FOTO NO R2:**
   - Original: `antiga_pasta/00026.webp` → `nova_pasta/00026.webp`
   - Thumbnail: `antiga_pasta/_thumbnails/00026.webp` → `nova_pasta/_thumbnails/00026.webp`
   - Preview: `antiga_pasta/_previews/00026.webp` → `nova_pasta/_previews/00026.webp`
   - Display: `antiga_pasta/_display/00026.webp` → `nova_pasta/_display/00026.webp`
4. ✅ Busca categoria de destino no PhotoCategory
5. ✅ Atualiza MongoDB:
   - `qbItem: → novo QB`
   - `category: → novo displayName`
   - `r2Path: → novo caminho`
   - `thumbnailUrl: → nova URL`
   - `webViewLink: → nova URL`
6. ✅ **ROLLBACK AUTOMÁTICO:** Se categoria não for encontrada, move fotos de volta!

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Pase complexo aplicado com sucesso",
  "data": {
    "photoNumber": "00026",
    "action": "pase-complexo",
    "changes": {
      "before": {
        "qbItem": "5301SB",
        "category": "Brazilian Solid Black",
        "r2Path": "Brazil Best Sellers/5301SB - Brazilian Solid Black/00026.webp"
      },
      "after": {
        "qbItem": "5302B TP",
        "category": "Brazilian Top Selected Black White",
        "r2Path": "Brazil Top Selected Categories/5302B - Brazilian Top Selected Black White/00026.webp"
      },
      "r2Moves": ["original", "thumbnail", "preview", "display"]
    },
    "timestamp": "2025-12-09T..."
  }
}
```

**Logs no console (esperado):**
```
[MONITOR ACTION] 🚨 Aplicando pase complexo da foto 00026...
   Destino: Brazil Top Selected Categories/5302B - Brazilian Top Selected Black White
   QB Destino: 5302B TP
[MONITOR ACTION] 📦 Movendo fotos no R2...
[R2 MOVE] Movendo foto 00026
   DE: Brazil Best Sellers/5301SB - Brazilian Solid Black/00026.webp
   PARA: Brazil Top Selected Categories/5302B - Brazilian Top Selected Black White
[R2 MOVE]    Movendo original...
[R2 MOVE]    ✅ original movido
[R2 MOVE]    Movendo thumbnail...
[R2 MOVE]    ✅ thumbnail movido
[R2 MOVE]    Movendo preview...
[R2 MOVE]    ✅ preview movido
[R2 MOVE]    Movendo display...
[R2 MOVE]    ✅ display movido
[MONITOR ACTION] ✅ Pase complexo aplicado: 00026
   - QB: 5301SB → 5302B TP
   - Path: Brazil Best Sellers/.../00026.webp → Brazil Top Selected Categories/.../00026.webp
   - 4 versões movidas no R2
```

---

## 🧪 COMO VERIFICAR OS RESULTADOS

### 1. Verificar MongoDB (após qualquer ação)

Use MongoDB Compass ou shell:

```javascript
// Buscar foto atualizada
db.unifiedproductcompletes.findOne({ photoNumber: "00026" })
```

**Verifique:**
- ✅ `status` está correto (available, sold, etc)
- ✅ `qbItem` foi atualizado
- ✅ `category` corresponde ao novo QB
- ✅ `r2Path` está correto (se foi pase complexo)
- ✅ `selectionId` foi removido (se foi retorno)

### 2. Verificar CDE (opcional)

```sql
SELECT AESTADOP, AQBITEM, AFECHA
FROM tbinventario
WHERE ATIPOETIQUETA = '00026'
ORDER BY AFECHA DESC
LIMIT 1
```

### 3. Verificar R2 (após pase complexo)

Abra o navegador e teste as URLs:

```
https://images.sunshinecowhides-gallery.com/Brazil Top Selected Categories/5302B - Brazilian Top Selected Black White/00026.webp

https://images.sunshinecowhides-gallery.com/Brazil Top Selected Categories/5302B - Brazilian Top Selected Black White/_thumbnails/00026.webp
```

**Você deve ver:**
- ✅ Foto carrega corretamente na nova pasta
- ✅ Pasta antiga não tem mais a foto (foi movida, não copiada)

### 4. Rodar o Monitor Novamente

```bash
# Em outro terminal (com servidor rodando)
curl http://localhost:3000/api/inventory-monitor/scan \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Você deve ver:**
- ✅ Problema corrigido não aparece mais
- ✅ Contadores de issues diminuíram

---

## 🐛 TROUBLESHOOTING

### Erro: "Apenas administradores podem executar esta ação"

**Problema:** Token não tem role de admin

**Solução:** Verifique que fez login com usuário admin correto

---

### Erro: "Foto não encontrada no MongoDB"

**Problema:** `photoNumber` incorreto ou foto não existe

**Solução:**
1. Verifique formato do número (pode ser "26" ou "00026")
2. Confirme que foto existe: `db.unifiedproductcompletes.findOne({ photoNumber: "00026" })`

---

### Erro: "Foto não está INGRESADO no CDE"

**Problema:** Tentando corrigir retorno mas CDE não mostra INGRESADO

**Solução:** Verifique status real no CDE antes de executar

---

### Erro ao mover fotos no R2

**Problema:** Credenciais R2 incorretas ou foto não existe

**Solução:**
1. Verifique `.env`:
   ```
   R2_ENDPOINT=https://...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=sunshine-photos
   ```
2. Confirme que foto existe no R2 antes do pase

---

## 📊 ENDPOINT DE STATUS

Para verificar se a API está funcionando:

**Endpoint:** `GET http://localhost:3000/api/monitor-actions/status`

**Headers:**
```
Authorization: Bearer SEU_TOKEN_AQUI
```

**Resposta:**
```json
{
  "success": true,
  "message": "Monitor Actions API operacional",
  "availableActions": [
    {
      "endpoint": "/api/monitor-actions/retorno",
      "method": "POST",
      "description": "Corrige retornos (sold → available)",
      "requiredFields": ["photoNumber"],
      "optionalFields": ["adminUser"]
    },
    ...
  ],
  "timestamp": "2025-12-09T..."
}
```

---

## 🎯 FLUXO DE TESTE RECOMENDADO

### 1. PRIMEIRO: Testar Pase Simples (mais seguro)

```bash
# 1. Login
POST /api/auth/admin/login
# Copiar token

# 2. Executar pase simples
POST /api/monitor-actions/pase-simples
{
  "photoNumber": "00142"
}

# 3. Verificar MongoDB
# Confirmar que qbItem e category mudaram
```

### 2. SEGUNDO: Testar Retorno

```bash
# 1. Executar retorno
POST /api/monitor-actions/retorno
{
  "photoNumber": "00026"
}

# 2. Verificar MongoDB
# Confirmar que status mudou de sold → available
# Confirmar que selectionId foi removido
```

### 3. TERCEIRO: Testar Pase Complexo (cuidado!)

⚠️ **ATENÇÃO:** Essa ação MOVE fotos no R2! Faça backup primeiro se possível.

```bash
# 1. Executar pase complexo
POST /api/monitor-actions/pase-complexo
{
  "photoNumber": "00026",
  "destinationPath": "Brazil Top Selected Categories/5302B - Brazilian Top Selected Black White",
  "destinationQB": "5302B TP"
}

# 2. Verificar MongoDB
# Confirmar que r2Path, qbItem e category mudaram

# 3. Verificar R2
# Abrir URL nova no navegador
# Confirmar que foto foi movida
```

---

## ✅ CHECKLIST DE TESTE

- [ ] Servidor iniciado com `npm run dev`
- [ ] Login admin realizado com sucesso
- [ ] Token copiado e guardado
- [ ] Endpoint de status testado
- [ ] Pase simples testado
- [ ] Resultado do pase simples verificado no MongoDB
- [ ] Retorno testado
- [ ] Resultado do retorno verificado no MongoDB
- [ ] Pase complexo testado (com cuidado!)
- [ ] Fotos movidas no R2 verificadas
- [ ] Monitor rodado novamente para confirmar correções

---

## 📝 NOTAS IMPORTANTES

1. **Sempre teste com fotos reais detectadas pelo monitor**
   - Não invente números de fotos
   - Use os resultados do `/api/inventory-monitor/scan`

2. **Pase Complexo move fotos permanentemente**
   - A operação é de MOVE (copy + delete), não COPY
   - Não é facilmente reversível
   - Teste com fotos não-críticas primeiro

3. **Logs são seus amigos**
   - Sempre verifique o console do servidor
   - Logs mostram cada passo da execução
   - Erros aparecem com emoji ❌

4. **Autenticação é obrigatória**
   - Todas as rotas requerem token de admin
   - Token expira em 24h
   - Se expirar, faça login novamente

5. **Validações estão implementadas**
   - Sistema valida dados antes de executar
   - Erros são retornados com mensagens claras
   - HTTP status codes corretos (400, 401, 403, 500)

---

**Última atualização:** 2025-12-09
**Versão:** 1.0
**Status:** Pronto para teste em localhost
