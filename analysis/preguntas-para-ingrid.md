PREGUNTAS SOBRE SISTEMA CDE - PARA INGRID

Fecha: 03/01/2026
Tema: Sincronización Galería y CDE (PASES y Sistema de Etiquetas)

---

CONTEXTO

Hola Ingrid,

Estamos desarrollando el Inventory Monitor para la galería online, que debe sincronizar automáticamente los datos entre:
- CDE (MySQL) - Fuente de verdad del warehouse
- MongoDB - Base de datos de la galería
- R2 (Cloudflare) - Almacenamiento de fotos

Para implementar correctamente la detección y aplicación de PASES, necesitamos entender completamente cómo funciona el sistema de etiquetas en el CDE.

---

LO QUE YA ENTENDIMOS

Después de analizar las tablas tbetiqueta, tbpases, tbinventario y tbretornosf, hemos identificado:

1. QRHISTORY guarda el estado ANTERIOR de la etiqueta
   - Formato: {codigo}-{QB_anterior};{campos_separados_por_punto_y_coma}
   - Ejemplo: 35525-5203BLW;0;1481;200135561;0;0;0;CUR-1226;S32;0;5125;0

2. tbpases.DESCRIPCION contiene el mismo formato que QRHISTORY

3. PASES se detectan cuando OLDQBITEM es diferente de NEWQBITEM en tbpases

4. AIDH (IDH) no cambia durante un PASE

---

PREGUNTAS CRUCIALES

1. Código inicial en QRHISTORY/DESCRIPCION

En el campo QRHISTORY, antes del guión "-", hay un código:

Ejemplo 1 - Foto 35561:
QRHISTORY: 35525-5203BLW;0;1481;200135561;0;0;0;CUR-1226;S32;0;5125;0
           (código: 35525)

- La foto 35525 EXISTE en el CDE como foto separada (QB: 5201EXO)
- La foto 35561 también existe (QB: 5203BRW)

Ejemplo 2 - Fotos 35505, 35504, 35503, etc:
DESCRIPCION: 35225-5202BRW;0;1468;200135505;0;0;0;CUR-1226;S32;0;5125;0
             (código: 35225)

- El código 35225 NO EXISTE como foto en el CDE
- Pero generó 9 fotos: 35505, 35504, 35503, 35502, 35501, 35500, 35499, 35498, 35497
- En tbpases: ASUMA = 9 (cantidad de fotos)

PREGUNTAS:
a) Qué significa ese código inicial? (35525, 35225, etc)
b) Es un código de lote/remesa?
c) Es un código de semana/período?
d) Es el número de la etiqueta original antes de dividirse?
e) Cuándo ese código existe como foto y cuándo no?

Por qué necesitamos saberlo:
Para entender si debemos renombrar archivos en R2 o solo moverlos de carpeta.

---

2. Número de foto (ATIPOETIQUETA) - Cambia en un PASE?

Caso específico - Foto 35561:
- QRHISTORY dice: 35525-5203BLW;...
- AIDH: 200135561 (no cambió)
- QB anterior: 5203BLW
- QB actual: 5203BRW

PREGUNTAS:
a) El número de foto siempre fue 35561 desde el inicio?
b) O hubo renombramiento de 35525 a 35561?
c) En general, cuando se hace un PASE, se mantiene el número de foto o puede cambiar?

Por qué necesitamos saberlo:
Para saber si en R2 debemos:
- Solo mover de carpeta: .../Black & White XL/35561.webp a .../Brown & White XL/35561.webp
- O también renombrar: .../35525.webp a .../35561.webp

---

3. Campo ASEMANAS

En la foto 35561:
- ASEMANAS anterior (QRHISTORY): 5125
- ASEMANAS actual: 5225

PREGUNTAS:
a) Qué significa el campo ASEMANAS?
b) Es semana del año + año? (ej: 52 = semana 52, 25 = 2025)
c) Está relacionado con el código inicial del QRHISTORY?
d) Es importante para el sistema de sincronización?

---

4. RETORNOS - Ciclo de vida

Vimos las tablas tbretornosf (328 registros) y tbreturnordenes (1.085 órdenes).

PREGUNTAS:
a) Cuando una foto retorna del marketplace, cómo vuelve al inventario?
b) Se crea un nuevo registro en tbetiqueta con estado INGRESADO?
c) El número de foto se mantiene igual?
d) Puede cambiar el QB Item cuando retorna? (se convierte en PASE?)
e) Campo ARF en tbretornosf: RF = Return FBA, P = PASE?
f) Cómo identificar si un retorno ya fue procesado y está de vuelta en stock?

Por qué necesitamos saberlo:
Para que el monitor detecte:
- Fotos que retornaron y necesitan reingreso en la galería
- Cambios de QB Item en retornos (PASES)
- Estado de procesamiento de retornos

---

5. Campo AUBICACION

Observamos que AUBICACION tiene dos usos:
- Ubicación física: PH-208, CR-111, etc (82% de casos)
- QB Item anterior: 5203BLW (en algunos PASES)

PREGUNTAS:
a) Cuándo AUBICACION guarda el QB anterior y cuándo guarda ubicación física?
b) Hay alguna regla para diferenciarlo?
c) Es confiable usar AUBICACION para detectar PASES o debemos usar solo QRHISTORY?

---

RESUMEN DE LO QUE NECESITAMOS IMPLEMENTAR

Con las respuestas, podremos implementar correctamente:

1. Detector de PASES: Identificar cuando CDE tiene QB diferente a MongoDB
2. Sincronizador:
   - Actualizar MongoDB (qbItem, category, r2Path)
   - Mover/renombrar fotos en R2 (4 versiones)
3. Monitor de RETORNOS: Detectar fotos que volvieron al stock
4. Interface de confirmación: Mostrar PASES para aprobación manual antes de aplicar

---

EJEMPLOS CONCRETOS PARA REFERENCIA

Foto 35561:
- ATIPOETIQUETA: 35561
- AIDH: 200135561
- QB anterior: 5203BLW (Black & White XL)
- QB actual: 5203BRW (Brown & White XL)
- QRHISTORY: 35525-5203BLW;0;1481;200135561;0;0;0;CUR-1226;S32;0;5125;0
- Fecha PASE: 22/12/2025

Lote 35225 - Fotos múltiples:
- Código: 35225 (no existe como foto)
- Generó: 35505, 35504, 35503, 35502, 35501, 35500, 35499, 35498, 35497
- QB anterior: 5202BRW
- QB nuevo: 5202BLW
- Cantidad: 9 fotos (ASUMA = 9)
- Fecha: 19/12/2025

---

AGRADECIMIENTO

Cualquier aclaración sobre estos puntos nos ayudará enormemente a implementar el sistema de sincronización de forma correcta y robusta.

Muchas gracias por tu ayuda.

Equipo de Desarrollo - Galería Online
