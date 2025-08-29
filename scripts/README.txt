# Scripts de Análise CDE

## 📋 Objetivo
Descobrir onde está o campo "NoFoto" no banco CDE e estabelecer sincronização automática entre CDE e Sistema Sunshine.

## 🎯 O Problema
- **Manual hoje**: Baixar planilha Excel → Mover fotos manualmente
- **Automático desejado**: CDE marca RETIRADO → Sistema marca como "sold" automaticamente

## 📁 Scripts Disponíveis

### 1. `cde-01-analyze-structure.js`
**O que faz**: Analisa a estrutura completa do banco CDE
```bash
npm run cde:structure
```
**Procura por**:
- Lista todas as tabelas
- Estrutura da tbinventario
- Campos que possam ser NoFoto
- Padrões numéricos em campos

### 2. `cde-02-analyze-retirados.js`
**O que faz**: Busca produtos RETIRADOS de ontem
```bash
npm run cde:retirados
```
**Procura por**:
- Total de RETIRADOS ontem
- Amostra de registros RETIRADOS
- Padrões de IDH
- Extração de números (possível NoFoto)

### 3. `cde-03-find-nofoto.js`
**O que faz**: Busca específica pelo campo NoFoto
```bash
npm run cde:find
```
**Procura por**:
- Colunas com "foto", "no", "num" no nome
- Variações de "NoFoto"
- Análise do campo AQBITEM
- Relação IDH ↔ números de foto

## 🔑 Estados no CDE

| Estado CDE | Código | Sistema Sunshine | Descrição |
|------------|--------|------------------|-----------|
| INGRESADO | 1 | available | Produto disponível |
| RETIRADO | 2 | sold | Produto vendido/saiu |
| STANDBY/RESERVADO | 3 | (futuro) | Produto reservado |

## 🗂️ Campos Importantes no CDE

### Confirmados:
- **AIDH**: IDH do produto (9 dígitos, ex: 200012345)
- **AESTADOP**: Estado (INGRESADO/RETIRADO/STANDBY)
- **AFECHA**: Data da movimentação
- **AQBITEM**: Código do item (pode conter NoFoto)
- **AUBICACION**: Localização física

### Procurando:
- **NoFoto**: Número único da foto (2-6 dígitos)
- Pode estar nos últimos dígitos do AIDH
- Pode estar no AQBITEM
- Pode ter outro nome

## 🚀 Próximos Passos

1. **Executar os 3 scripts** para coletar informações
2. **Compartilhar resultados** com Ingrid para confirmar campo NoFoto
3. **Criar script de sincronização** após identificar o campo correto

## 💡 Hipóteses Atuais

1. **NoFoto = últimos 5 dígitos do AIDH**
   - AIDH: 200012345 → NoFoto: 12345

2. **NoFoto está no AQBITEM**
   - Precisa extrair números do campo

3. **NoFoto tem outro nome**
   - Pode ser: codigo_foto, num_foto, etc.

## 📝 Notas Importantes

- Ingrid confirmou: "Si necesitas saber ingresadas, retiradas, reservadas es con inventario"
- tbinventario = tabela principal
- tbetiqueta = tabela temporária/pré-ingresso
- CDE é multi-empresa (contém produtos de toda empresa, não só Sunshine)

## ⚠️ Instalação Necessária

Antes de executar os scripts, instale o mysql2:
```bash
npm install mysql2
```

## 🔐 Credenciais CDE
As credenciais estão no arquivo `.env`:
```env
CDE_HOST=216.246.112.6
CDE_PORT=3306
CDE_USER=tzwgctib_photos
CDE_PASSWORD=T14g0@photos
CDE_DATABASE=tzwgctib_inventario
```