# REPORTE DE ERRORES EN FACTURAS FEDEX
## Análisis de Cobros Incorrectos por Package Type

**Fecha del análisis:** 12 de Diciembre, 2025
**Analizado por:** Sistema automatizado de detección de errores

---

## RESUMEN EJECUTIVO

Se identificaron **22 envíos con cobros incorrectos** en 2 facturas de FedEx. La empresa utiliza exclusivamente **FedEx Large Box**, pero FedEx está clasificando erróneamente algunos envíos como "FedEx Medium Box" o "FedEx X-Large Box", lo que resulta en cobros significativamente mayores.

### IMPACTO FINANCIERO TOTAL:
| Concepto | Valor USD |
|----------|-----------|
| Cobrado incorrectamente | $831.74 |
| Debería ser (Large Box ~$4.82/envío) | $106.04 |
| **DIFERENCIA A RECLAMAR** | **$725.70** |

---

## DETALLE POR FACTURA

### FACTURA 1: 8-917-92891
| Campo | Valor |
|-------|-------|
| Fecha de factura | Jul 08, 2025 |
| Total factura | $1,337.38 |
| Descuentos aplicados | $2,730.30 |
| Total envíos | 93 |
| Envíos correctos (Large Box) | 82 |
| **Envíos con error** | **10** |
| Diferencia a reclamar | **$191.04** |

**Errores encontrados:**
- 6 envíos clasificados como "FedEx Medium Box" (~$11.03 c/u)
- 4 envíos clasificados como "FedEx X-Large Box" (~$42.14 c/u)

### FACTURA 2: 9-096-16724
| Campo | Valor |
|-------|-------|
| Fecha de factura | Dec 09, 2025 |
| Total factura | $2,484.97 |
| Descuentos aplicados | $7,713.62 |
| Total envíos | 259 |
| Envíos correctos (Large Box) | 247 |
| **Envíos con error** | **12** |
| Diferencia a reclamar | **$534.66** |

**Errores encontrados:**
- 12 envíos clasificados como "FedEx X-Large Box" (~$49.00 c/u)

---

## LISTA COMPLETA DE TRACKING IDs CON ERROR

### Factura 8-917-92891 (Jul 2025):

| # | Tracking ID | Package Type | Cobrado | Correcto | Diferencia |
|---|-------------|--------------|---------|----------|------------|
| 1 | 390397740490 | FedEx Medium Box | $11.03 | $4.82 | $6.21 |
| 2 | 390399088329 | FedEx Medium Box | $11.03 | $4.82 | $6.21 |
| 3 | 390446621070 | FedEx Medium Box | $11.03 | $4.82 | $6.21 |
| 4 | 390456995174 | FedEx Medium Box | $11.03 | $4.82 | $6.21 |
| 5 | 390511406165 | FedEx Medium Box | $11.03 | $4.82 | $6.21 |
| 6 | 390528216707 | FedEx Medium Box | $15.53 | $4.82 | $10.71 |
| 7 | 390446778370 | FedEx X-Large Box | $42.14 | $4.82 | $37.32 |
| 8 | 390446901802 | FedEx X-Large Box | $42.14 | $4.82 | $37.32 |
| 9 | 390511276707 | FedEx X-Large Box | $42.14 | $4.82 | $37.32 |
| 10 | 390528812042 | FedEx X-Large Box | $42.14 | $4.82 | $37.32 |

### Factura 9-096-16724 (Dec 2025):

| # | Tracking ID | Package Type | Cobrado | Correcto | Diferencia |
|---|-------------|--------------|---------|----------|------------|
| 1 | 395811946791 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 2 | 395896690777 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 3 | 395911876213 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 4 | 395912834680 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 5 | 396030302330 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 6 | 396043524925 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 7 | 396047082871 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 8 | 396053824810 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 9 | 396174922580 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 10 | 396182850221 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 11 | 396183301650 | FedEx X-Large Box | $49.00 | $4.82 | $44.18 |
| 12 | 396186582923 | FedEx X-Large Box | $53.50 | $4.82 | $48.68 |

---

## PROBLEMA IDENTIFICADO

### Situación:
La empresa **Sunshine Cowhides / Luxury Cowhides** tiene un contrato con FedEx que incluye descuentos especiales para **FedEx Large Box** (aproximadamente 84% de descuento).

### Error de FedEx:
FedEx está clasificando incorrectamente algunos envíos como:
- **FedEx Medium Box** - Descuento menor (~55%), costo ~$11.03
- **FedEx X-Large Box** - SIN descuento, costo ~$42-53

### Impacto:
- Cada envío clasificado incorrectamente cuesta entre **$6 y $48 adicionales**
- En solo 2 facturas, el error suma **$725.70**
- Si esto ocurre semanalmente, podría representar **miles de dólares mensuales**

---

## ACCIÓN REQUERIDA

1. **Contactar a FedEx Revenue Services:**
   - Teléfono: 800.622.1147
   - Horario: L-V 7 AM a 8 PM CST, Sáb 7 AM a 6 PM CST
   - Web: fedex.com

2. **Solicitar corrección** de los 22 envíos listados arriba

3. **Solicitar crédito/reembolso** por la diferencia de $725.70

4. **Revisar facturas anteriores** - Es probable que este error haya ocurrido en otras facturas

---

## PRÓXIMOS PASOS

- [ ] Recopilar más facturas de FedEx (semanas/meses anteriores)
- [ ] Analizar todas las facturas con el script automatizado
- [ ] Documentar el total de errores históricos
- [ ] Presentar reclamo formal a FedEx con todos los Tracking IDs
- [ ] Solicitar que FedEx corrija el problema en el sistema para evitar errores futuros

---

## NOTAS TÉCNICAS

- **Script utilizado:** `analizador_fedex.js` (Node.js)
- **Archivos analizados:** 2 PDFs (33 + 78 páginas = 111 páginas total)
- **Tiempo de análisis:** < 5 segundos
- **Capacidad:** El script puede analizar cualquier cantidad de facturas

---

**Archivo Excel con datos completos:** `Reporte_Errores_FedEx_2025-12-12T19-23-11.xlsx`

---

*Reporte generado automáticamente - Diciembre 2025*
