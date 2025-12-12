/**
 * ANALIZADOR DE FACTURAS FEDEX
 * Detecta errores de Package Type (Medium Box y X-Large Box)
 * cuando la empresa solo usa Large Box
 *
 * Uso:
 *   node scripts/analizador_fedex.js
 *   node scripts/analizador_fedex.js archivo.pdf
 *   node scripts/analizador_fedex.js carpeta/
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const XLSX = require('xlsx');

// Configuración
const PRECIO_LARGE_BOX = 4.82; // Precio correcto con desconto
const PACKAGE_TYPES_ERROR = ['FedEx Medium Box', 'FedEx X-Large Box'];

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(msg, color = '') {
  console.log(color + msg + colors.reset);
}

/**
 * Extrae información de un envío del texto del PDF
 */
function extraerEnvios(texto) {
  const envios = [];
  const lineas = texto.split('\n');

  let envioActual = null;
  let capturandoEnvio = false;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();

    // Detectar inicio de un envío (Ship Date)
    if (linea.includes('Ship Date:')) {
      if (envioActual && envioActual.trackingId) {
        envios.push(envioActual);
      }

      const shipDateMatch = linea.match(/Ship Date:\s*([A-Za-z]+\s+\d+,?\s*\d{4})/);
      envioActual = {
        shipDate: shipDateMatch ? shipDateMatch[1] : '',
        trackingId: '',
        packageType: '',
        recipient: '',
        totalCharge: 0,
        zone: ''
      };
      capturandoEnvio = true;
    }

    // Capturar Tracking ID
    if (capturandoEnvio && linea.includes('Tracking ID')) {
      // El tracking ID puede estar en la misma línea o en la siguiente
      const trackingMatch = linea.match(/\b(39\d{10}|28\d{10})\b/);
      if (trackingMatch) {
        envioActual.trackingId = trackingMatch[1];
      } else if (i + 1 < lineas.length) {
        const nextLine = lineas[i + 1].trim();
        const nextMatch = nextLine.match(/\b(39\d{10}|28\d{10})\b/);
        if (nextMatch) {
          envioActual.trackingId = nextMatch[1];
        }
      }
    }

    // Buscar tracking ID en cualquier línea (backup)
    if (capturandoEnvio && !envioActual.trackingId) {
      const trackingMatch = linea.match(/\b(39\d{10}|28\d{10})\b/);
      if (trackingMatch) {
        envioActual.trackingId = trackingMatch[1];
      }
    }

    // Capturar Package Type
    if (capturandoEnvio && linea.includes('Package Type')) {
      const packageTypes = ['FedEx Large Box', 'FedEx Medium Box', 'FedEx X-Large Box', 'Customer Packaging'];
      for (const pt of packageTypes) {
        if (linea.includes(pt) || (i + 1 < lineas.length && lineas[i + 1].includes(pt))) {
          envioActual.packageType = pt;
          break;
        }
      }

      // Si no encontró en la línea, buscar en las siguientes
      if (!envioActual.packageType) {
        for (let j = i; j < Math.min(i + 5, lineas.length); j++) {
          for (const pt of packageTypes) {
            if (lineas[j].includes(pt)) {
              envioActual.packageType = pt;
              break;
            }
          }
          if (envioActual.packageType) break;
        }
      }
    }

    // Detectar Package Type directamente si aparece en la línea
    if (capturandoEnvio) {
      for (const pt of ['FedEx Large Box', 'FedEx Medium Box', 'FedEx X-Large Box']) {
        if (linea === pt || linea.includes(pt)) {
          envioActual.packageType = pt;
        }
      }
    }

    // Capturar Recipient
    if (capturandoEnvio && linea.includes('Recipient')) {
      if (i + 1 < lineas.length) {
        const recipientLine = lineas[i + 1].trim();
        if (recipientLine && !recipientLine.includes('Tracking') && !recipientLine.includes('Service')) {
          envioActual.recipient = recipientLine;
        }
      }
    }

    // Capturar Total Charge
    if (capturandoEnvio && linea.includes('Total Charge')) {
      const chargeMatch = linea.match(/\$?([\d,]+\.?\d*)/);
      if (chargeMatch) {
        envioActual.totalCharge = parseFloat(chargeMatch[1].replace(',', ''));
      }
    }

    // Capturar Zone
    if (capturandoEnvio && linea.includes('Zone')) {
      const zoneMatch = linea.match(/Zone\s+(\d+)/);
      if (zoneMatch) {
        envioActual.zone = zoneMatch[1];
      }
    }
  }

  // No olvidar el último envío
  if (envioActual && envioActual.trackingId) {
    envios.push(envioActual);
  }

  return envios;
}

/**
 * Método alternativo: buscar directamente los Package Types con error
 */
function buscarErroresDirectamente(texto) {
  const errores = [];
  const lineas = texto.split('\n');

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();

    // Buscar FedEx Medium Box o FedEx X-Large Box
    if (linea === 'FedEx Medium Box' || linea === 'FedEx X-Large Box') {
      const packageType = linea;

      // Buscar el Tracking ID cercano (hacia arriba)
      let trackingId = '';
      let shipDate = '';
      let totalCharge = 0;
      let recipient = '';

      // Buscar hacia arriba
      for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
        const lineaAnterior = lineas[j].trim();

        if (!trackingId) {
          const trackingMatch = lineaAnterior.match(/\b(39\d{10}|28\d{10})\b/);
          if (trackingMatch) {
            trackingId = trackingMatch[1];
          }
        }

        if (!shipDate && lineaAnterior.includes('Ship Date:')) {
          const shipDateMatch = lineaAnterior.match(/Ship Date:\s*([A-Za-z]+\s+\d+,?\s*\d{4})/);
          if (shipDateMatch) {
            shipDate = shipDateMatch[1];
          }
        }
      }

      // Buscar Total Charge hacia abajo
      for (let j = i + 1; j < Math.min(lineas.length, i + 40); j++) {
        const lineaSiguiente = lineas[j].trim();

        // Buscar Total Charge en varias formas
        if (lineaSiguiente.includes('Total Charge')) {
          // Formato: "Total Charge USD $42.14" o "Total Charge                        USD           $42.14"
          const chargeMatch = lineaSiguiente.match(/\$([\d,]+\.?\d*)/);
          if (chargeMatch) {
            totalCharge = parseFloat(chargeMatch[1].replace(',', ''));
            break;
          }
          // Si el valor está en la siguiente línea
          if (j + 1 < lineas.length) {
            const nextLine = lineas[j + 1].trim();
            const nextMatch = nextLine.match(/^\$?([\d,]+\.?\d*)$/);
            if (nextMatch) {
              totalCharge = parseFloat(nextMatch[1].replace(',', ''));
              break;
            }
          }
        }

        // Buscar patrón específico: número al final de línea después de USD
        if (lineaSiguiente.match(/USD\s+\$?([\d,]+\.?\d*)$/)) {
          const chargeMatch = lineaSiguiente.match(/\$([\d,]+\.?\d*)$/);
          if (chargeMatch) {
            totalCharge = parseFloat(chargeMatch[1].replace(',', ''));
            break;
          }
        }

        // También buscar recipient
        if (!recipient && lineaSiguiente.includes('Recipient')) {
          if (j + 1 < lineas.length) {
            recipient = lineas[j + 1].trim();
          }
        }
      }

      // Si no encontró Total Charge, buscar Transportation Charge (para X-Large sin descuento)
      if (totalCharge === 0) {
        for (let j = i + 1; j < Math.min(lineas.length, i + 30); j++) {
          const lineaSiguiente = lineas[j].trim();
          if (lineaSiguiente.includes('Transportation Charge')) {
            const chargeMatch = lineaSiguiente.match(/([\d,]+\.?\d*)$/);
            if (chargeMatch) {
              const transportCharge = parseFloat(chargeMatch[1].replace(',', ''));
              // Para X-Large Box sin descuento, el Transportation Charge es el Total
              if (packageType === 'FedEx X-Large Box' && transportCharge > 40) {
                totalCharge = transportCharge;
                break;
              }
            }
          }
        }
      }

      if (trackingId) {
        errores.push({
          trackingId,
          packageType,
          shipDate,
          totalCharge,
          recipient
        });
      }
    }
  }

  return errores;
}

/**
 * Extrae información general de la factura
 */
function extraerInfoFactura(texto) {
  const info = {
    invoiceNumber: '',
    invoiceDate: '',
    accountNumber: '',
    totalInvoice: 0,
    expressShipments: 0,
    groundShipments: 0,
    discounts: 0
  };

  // Invoice Number
  const invoiceMatch = texto.match(/Invoice Number\s*[\n\r]*\s*([\d-]+)/);
  if (invoiceMatch) info.invoiceNumber = invoiceMatch[1];

  // Invoice Date
  const dateMatch = texto.match(/Invoice Date\s*[\n\r]*\s*([A-Za-z]+\s+\d+,?\s*\d{4})/);
  if (dateMatch) info.invoiceDate = dateMatch[1];

  // Account Number
  const accountMatch = texto.match(/Account Number\s*[\n\r]*\s*([\w-]+)/);
  if (accountMatch) info.accountNumber = accountMatch[1];

  // Total Invoice
  const totalMatch = texto.match(/TOTAL THIS INVOICE\s+USD\s+\$?([\d,]+\.?\d*)/);
  if (totalMatch) info.totalInvoice = parseFloat(totalMatch[1].replace(',', ''));

  // Express Shipments
  const expressMatch = texto.match(/Total FedEx Express\s+(\d+)/);
  if (expressMatch) info.expressShipments = parseInt(expressMatch[1]);

  // También buscar en el summary
  const expressSummaryMatch = texto.match(/Shipper\s+(\d+)\s+[\d.]+\s+[\d,]+\.\d+/);
  if (expressSummaryMatch) info.expressShipments = parseInt(expressSummaryMatch[1]);

  // Ground Shipments
  const groundMatch = texto.match(/Total FedEx Ground\s+(\d+)/);
  if (groundMatch) info.groundShipments = parseInt(groundMatch[1]);

  // Discounts
  const discountMatch = texto.match(/You saved \$([\d,]+\.?\d*)/);
  if (discountMatch) info.discounts = parseFloat(discountMatch[1].replace(',', ''));

  return info;
}

/**
 * Cuenta los diferentes Package Types
 */
function contarPackageTypes(texto) {
  const counts = {
    'FedEx Large Box': 0,
    'FedEx Medium Box': 0,
    'FedEx X-Large Box': 0,
    'Customer Packaging': 0
  };

  // Contar ocurrencias de cada tipo
  const largeMatches = texto.match(/FedEx Large Box/g);
  const mediumMatches = texto.match(/FedEx Medium Box/g);
  const xlargeMatches = texto.match(/FedEx X-Large Box/g);
  const customerMatches = texto.match(/Customer Packaging/g);

  if (largeMatches) counts['FedEx Large Box'] = largeMatches.length;
  if (mediumMatches) counts['FedEx Medium Box'] = mediumMatches.length;
  if (xlargeMatches) counts['FedEx X-Large Box'] = xlargeMatches.length;
  if (customerMatches) counts['Customer Packaging'] = customerMatches.length;

  return counts;
}

/**
 * Analiza un archivo PDF
 */
async function analizarPDF(filePath) {
  log(`\n${'─'.repeat(60)}`, colors.cyan);
  log(`📄 Analizando: ${path.basename(filePath)}`, colors.bright);
  log('─'.repeat(60), colors.cyan);

  const dataBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(dataBuffer);
  const parser = new PDFParse(uint8Array);
  await parser.load();

  const info = await parser.getInfo();
  const textResult = await parser.getText();
  // getText() retorna { pages: [...], text: "...", total: N }
  const texto = textResult.text || textResult.pages.map(p => p.text).join('\n');
  const numPaginas = textResult.total || textResult.pages?.length || info.pages || 0;

  // Extraer información de la factura
  const infoFactura = extraerInfoFactura(texto);

  log(`   📑 Páginas: ${numPaginas}`);
  log(`   📋 Invoice: ${infoFactura.invoiceNumber} (${infoFactura.invoiceDate})`);
  log(`   💰 Total factura: $${infoFactura.totalInvoice.toFixed(2)}`);
  log(`   💵 Descuentos aplicados: $${infoFactura.discounts.toFixed(2)}`);

  // Contar Package Types
  const packageTypeCounts = contarPackageTypes(texto);

  log(`\n   📊 Distribución de Package Types:`, colors.yellow);
  for (const [tipo, count] of Object.entries(packageTypeCounts)) {
    if (count > 0) {
      const icon = PACKAGE_TYPES_ERROR.includes(tipo) ? '⚠️ ' : '✅ ';
      const color = PACKAGE_TYPES_ERROR.includes(tipo) ? colors.red : colors.green;
      log(`      ${icon}${tipo}: ${count}`, color);
    }
  }

  // Buscar errores directamente
  const errores = buscarErroresDirectamente(texto);

  log(`\n   🔍 Errores encontrados: ${errores.length}`, errores.length > 0 ? colors.red : colors.green);

  if (errores.length > 0) {
    const mediumCount = errores.filter(e => e.packageType === 'FedEx Medium Box').length;
    const xlargeCount = errores.filter(e => e.packageType === 'FedEx X-Large Box').length;

    if (mediumCount > 0) log(`      ⚠️  FedEx Medium Box: ${mediumCount}`, colors.yellow);
    if (xlargeCount > 0) log(`      ⚠️  FedEx X-Large Box: ${xlargeCount}`, colors.yellow);

    // Calcular impacto financiero
    const totalCobrado = errores.reduce((sum, e) => sum + e.totalCharge, 0);
    const totalCorrecto = errores.length * PRECIO_LARGE_BOX;
    const diferencia = totalCobrado - totalCorrecto;

    log(`\n   💰 Impacto financiero estimado:`, colors.magenta);
    log(`      Cobrado incorrectamente: $${totalCobrado.toFixed(2)}`, colors.red);
    log(`      Debería ser (estimado): $${totalCorrecto.toFixed(2)}`, colors.green);
    log(`      Diferencia a reclamar: $${diferencia.toFixed(2)}`, colors.bright + colors.red);
  }

  return {
    archivo: path.basename(filePath),
    infoFactura,
    packageTypeCounts,
    errores,
    numPaginas
  };
}

/**
 * Genera el reporte Excel
 */
function generarReporteExcel(resultados) {
  const workbook = XLSX.utils.book_new();

  // Aba 1: Resumen
  const resumenData = resultados.map(r => ({
    'Archivo': r.archivo,
    'Invoice Number': r.infoFactura.invoiceNumber,
    'Invoice Date': r.infoFactura.invoiceDate,
    'Páginas': r.numPaginas,
    'Total Factura USD': r.infoFactura.totalInvoice,
    'Descuentos USD': r.infoFactura.discounts,
    'Large Box': r.packageTypeCounts['FedEx Large Box'] || 0,
    'Medium Box (ERROR)': r.packageTypeCounts['FedEx Medium Box'] || 0,
    'X-Large Box (ERROR)': r.packageTypeCounts['FedEx X-Large Box'] || 0,
    'Total Errores': r.errores.length,
    'Cobrado con Error USD': r.errores.reduce((sum, e) => sum + e.totalCharge, 0),
    'Diferencia a Reclamar USD': r.errores.reduce((sum, e) => sum + e.totalCharge, 0) - (r.errores.length * PRECIO_LARGE_BOX)
  }));

  const wsResumen = XLSX.utils.json_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen');

  // Aba 2: Órdenes con Error
  const erroresData = [];
  for (const r of resultados) {
    for (const e of r.errores) {
      erroresData.push({
        'Invoice': r.infoFactura.invoiceNumber,
        'Invoice Date': r.infoFactura.invoiceDate,
        'Tracking ID': e.trackingId,
        'Package Type': e.packageType,
        'Ship Date': e.shipDate,
        'Recipient': e.recipient,
        'Cobrado USD': e.totalCharge,
        'Precio Correcto USD': PRECIO_LARGE_BOX,
        'Diferencia USD': e.totalCharge - PRECIO_LARGE_BOX
      });
    }
  }

  if (erroresData.length > 0) {
    const wsErrores = XLSX.utils.json_to_sheet(erroresData);
    XLSX.utils.book_append_sheet(workbook, wsErrores, 'Órdenes con Error');
  }

  // Aba 3: Lista de Tracking IDs
  const trackingData = [];
  for (const r of resultados) {
    for (const e of r.errores) {
      trackingData.push({
        'Tracking ID': e.trackingId,
        'Package Type': e.packageType,
        'Invoice': r.infoFactura.invoiceNumber
      });
    }
  }

  if (trackingData.length > 0) {
    const wsTracking = XLSX.utils.json_to_sheet(trackingData);
    XLSX.utils.book_append_sheet(workbook, wsTracking, 'Lista Tracking IDs');
  }

  // Guardar archivo en la carpeta reportes
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportesDir = path.join(__dirname, 'reportes');

  // Crear carpeta reportes si no existe
  if (!fs.existsSync(reportesDir)) {
    fs.mkdirSync(reportesDir, { recursive: true });
  }

  const outputPath = path.join(reportesDir, `Reporte_Errores_FedEx_${timestamp}.xlsx`);
  XLSX.writeFile(workbook, outputPath);

  return outputPath;
}

/**
 * Función principal
 */
async function main() {
  log('\n' + '═'.repeat(70), colors.cyan);
  log('📦 ANALIZADOR DE FACTURAS FEDEX - Detector de Errores de Package Type', colors.bright + colors.cyan);
  log('═'.repeat(70), colors.cyan);

  // Determinar qué archivos analizar
  let archivos = [];
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Si se pasó un argumento
    const inputPath = args[0];
    if (fs.existsSync(inputPath)) {
      const stat = fs.statSync(inputPath);
      if (stat.isDirectory()) {
        // Es un directorio, buscar PDFs
        const files = fs.readdirSync(inputPath);
        archivos = files
          .filter(f => f.toLowerCase().endsWith('.pdf'))
          .map(f => path.join(inputPath, f));
      } else if (inputPath.toLowerCase().endsWith('.pdf')) {
        // Es un archivo PDF
        archivos = [inputPath];
      }
    }
  } else {
    // Buscar PDFs en la carpeta 'facturas' relativa al script
    const scriptDir = __dirname;
    const facturasDir = path.join(scriptDir, 'facturas');

    if (fs.existsSync(facturasDir)) {
      const files = fs.readdirSync(facturasDir);
      archivos = files
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .map(f => path.join(facturasDir, f));
    }

    // Si no hay en facturas, buscar en directorio actual
    if (archivos.length === 0) {
      const files = fs.readdirSync(process.cwd());
      archivos = files
        .filter(f => f.toLowerCase().endsWith('.pdf') && f.includes('99999'))
        .map(f => path.join(process.cwd(), f));
    }
  }

  if (archivos.length === 0) {
    log('\n❌ No se encontraron archivos PDF para analizar.', colors.red);
    log('   Coloca los PDFs en la carpeta: scripts/fedex/facturas/', colors.yellow);
    log('   O usa: node scripts/fedex/analizador_fedex.js [archivo.pdf | carpeta]', colors.yellow);
    return;
  }

  log(`\n📂 PDFs encontrados: ${archivos.length}`, colors.green);

  // Analizar cada PDF
  const resultados = [];
  for (const archivo of archivos) {
    try {
      const resultado = await analizarPDF(archivo);
      resultados.push(resultado);
    } catch (error) {
      log(`\n❌ Error analizando ${path.basename(archivo)}: ${error.message}`, colors.red);
    }
  }

  // Generar reporte Excel
  if (resultados.length > 0) {
    log('\n' + '═'.repeat(70), colors.cyan);
    log('📊 GENERANDO REPORTE EXCEL', colors.bright + colors.cyan);
    log('═'.repeat(70), colors.cyan);

    const reportePath = generarReporteExcel(resultados);
    log(`\n✅ Reporte generado: ${path.basename(reportePath)}`, colors.green);

    // Resumen final
    log('\n' + '═'.repeat(70), colors.cyan);
    log('📈 RESUMEN FINAL', colors.bright + colors.cyan);
    log('═'.repeat(70), colors.cyan);

    const totalErrores = resultados.reduce((sum, r) => sum + r.errores.length, 0);
    const totalCobrado = resultados.reduce((sum, r) =>
      sum + r.errores.reduce((s, e) => s + e.totalCharge, 0), 0);
    const totalDiferencia = totalCobrado - (totalErrores * PRECIO_LARGE_BOX);

    log(`   PDFs analizados: ${resultados.length}`);
    log(`   Total errores encontrados: ${totalErrores}`, totalErrores > 0 ? colors.red : colors.green);

    if (totalErrores > 0) {
      log(`\n   💰 IMPACTO FINANCIERO TOTAL:`, colors.magenta);
      log(`      Cobrado incorrectamente: $${totalCobrado.toFixed(2)}`, colors.red);
      log(`      Diferencia a reclamar: $${totalDiferencia.toFixed(2)}`, colors.bright + colors.red);

      log(`\n   📋 TRACKING IDs CON ERROR:`, colors.yellow);
      for (const r of resultados) {
        for (const e of r.errores) {
          log(`      • ${e.trackingId} (${e.packageType}) - $${e.totalCharge.toFixed(2)}`);
        }
      }
    }
  }

  log('\n' + '═'.repeat(70), colors.cyan);
  log('✅ ANÁLISIS COMPLETADO', colors.bright + colors.green);
  log('═'.repeat(70) + '\n', colors.cyan);
}

// Ejecutar
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
