# Scripts de Manutenção

## /sync
- `cde-to-mongodb.js` - Sincronização completa CDE → MongoDB
- `r2-to-mongodb.js` - Criar registros para fotos do R2

## /migrations  
- `add-idh-codes.js` - Mapear IDH codes do CDE
- `add-photo-number.js` - Adicionar campo photoNumber normalizado

## /utils
- `audit-database.js` - Auditoria completa de inconsistências
- `audit-cde-comparison.js` - Comparar CDE vs MongoDB
- `audit-orphans.js` - Encontrar registros órfãos
- `analyze-cde-states.js` - Analisar estados no CDE
- `analyze-mongodb.js` - Analisar estrutura MongoDB
- `verify-cde-conflicts.js` - Verificar conflitos entre sistemas
- `cde-structure-analysis.js` - Descobrir estrutura do CDE

## Uso
Todos os scripts devem ser executados com: `node scripts/[pasta]/[arquivo].js`
