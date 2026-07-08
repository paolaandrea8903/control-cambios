/**
 * Report Generator Service to export comparisons to styled Excel.
 */
class ReportGenerator {
  /**
   * Triggers a download of a styled, highly professional Excel sheet (.xls)
   * containing the complete chapters and items comparison.
   * @param {Version} v1 Version 1 (Original)
   * @param {Version} v2 Version 2 (Revisado)
   * @param {Change[]} changes Detected changes
   */
  static downloadStyledExcel(v1, v2, changes) {
    if (!v2) return;
    
    const v1Name = v1 ? v1.name : 'Original';
    const v2Name = v2.name;
    
    // Build styled HTML Excel layout
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11px; }
        .title-row { background-color: #0f172a; color: #ffffff; font-size: 14px; font-weight: bold; height: 35px; text-align: center; }
        .sub-title-row { background-color: #1e293b; color: #cbd5e1; font-size: 11px; height: 22px; text-align: center; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 8px 6px; }
        td { border: 1px solid #cbd5e1; padding: 6px; }
        .chapter-row { background-color: #e2e8f0; font-weight: bold; font-size: 11px; height: 28px; color: #0f172a; }
        .added { background-color: #d1fae5; color: #065f46; }
        .deleted { background-color: #fee2e2; color: #991b1b; text-decoration: line-through; }
        .modified { background-color: #fef3c7; color: #92400e; }
        .number { text-align: right; }
        .text-center { text-align: center; }
        .fw-bold { font-weight: bold; }
        .total-row { background-color: #0f172a; color: #ffffff; font-weight: bold; height: 32px; }
      </style>
      </head>
      <body>
      <table>
        <tr class="title-row">
          <td colspan="11">INFORME COMPARATIVO CONSOLIDADO DE PRESUPUESTOS</td>
        </tr>
        <tr class="sub-title-row">
          <td colspan="11">Proyecto: Presupuesto Viviendas Pinarejos | Origen (V1): ${v1Name} vs Destino (V2): ${v2Name}</td>
        </tr>
        <tr><td colspan="11"></td></tr>
        <thead>
          <tr>
            <th>Código</th>
            <th>Unidad</th>
            <th>Descripción</th>
            <th>Cantidad V1</th>
            <th>Cantidad V2</th>
            <th>Precio V1 (€)</th>
            <th>Precio V2 (€)</th>
            <th>Importe V1 (€)</th>
            <th>Importe V2 (€)</th>
            <th>Desviación (€)</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
    `;

    const chaps1 = v1 ? v1.getElementsByType('capitulo') : [];
    const chaps2 = v2.getElementsByType('capitulo');
    const chapMap = new Map();
    chaps1.forEach(c => chapMap.set(c.id, { id: c.id, name: c.name, t1: c.data.total || 0, t2: 0 }));
    chaps2.forEach(c => {
      if (chapMap.has(c.id)) {
        chapMap.get(c.id).t2 = c.data.total || 0;
      } else {
        chapMap.set(c.id, { id: c.id, name: c.name, t1: 0, t2: c.data.total || 0 });
      }
    });

    const sortedChaps = Array.from(chapMap.values()).sort((a, b) => {
      const na = parseInt(a.id);
      const nb = parseInt(b.id);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.id.localeCompare(b.id);
    });

    let grandTotalV1 = 0;
    let grandTotalV2 = 0;

    sortedChaps.forEach(chap => {
      const t1 = chap.t1;
      const t2 = chap.t2;
      const diff = t2 - t1;
      
      grandTotalV1 += t1;
      grandTotalV2 += t2;

      html += `
        <tr class="chapter-row">
          <td class="fw-bold">${chap.id}</td>
          <td class="text-center">-</td>
          <td>${chap.name}</td>
          <td class="number">-</td>
          <td class="number">-</td>
          <td class="number">-</td>
          <td class="number">-</td>
          <td class="number fw-bold">${t1 ? t1.toFixed(2) : '0.00'}</td>
          <td class="number fw-bold">${t2 ? t2.toFixed(2) : '0.00'}</td>
          <td class="number fw-bold">${diff ? (diff >= 0 ? '+' : '') + diff.toFixed(2) : '0.00'}</td>
          <td class="text-center">${diff > 0.01 ? 'SOBRECOSTE' : diff < -0.01 ? 'AHORRO' : 'SIN CAMBIOS'}</td>
        </tr>
      `;

      const items1 = v1 ? v1.getElementsByType('partida').filter(item => item.parentId === chap.id) : [];
      const items2 = v2.getElementsByType('partida').filter(item => item.parentId === chap.id);

      const itemMap = new Map();
      items1.forEach(item => itemMap.set(item.id, { id: item.id, el1: item, el2: null }));
      items2.forEach(item => {
        if (itemMap.has(item.id)) {
          itemMap.get(item.id).el2 = item;
        } else {
          itemMap.set(item.id, { id: item.id, el1: null, el2: item });
        }
      });

      const sortedItems = Array.from(itemMap.values()).sort((a, b) => a.id.localeCompare(b.id));

      sortedItems.forEach(({ id, el1, el2 }) => {
        let state = 'SIN CAMBIOS';
        let rowClass = '';
        
        let unit = el2 ? el2.data.unit : el1.data.unit;
        let desc = el2 ? el2.name : el1.name;
        
        let qty1 = el1 ? el1.data.qty_medicion : 0;
        let qty2 = el2 ? el2.data.qty_medicion : 0;
        let price1 = el1 ? el1.data.price : 0;
        let price2 = el2 ? el2.data.price : 0;
        
        let tot1 = el1 ? el1.data.total : 0;
        let tot2 = el2 ? el2.data.total : 0;
        let diffItem = tot2 - tot1;

        const change = changes.find(c => c.elementType === 'partida' && c.elementId === id);

        if (!el1 && el2) {
          state = 'AÑADIDO';
          rowClass = 'added';
        } else if (el1 && !el2) {
          state = 'ELIMINADO';
          rowClass = 'deleted';
        } else if (change) {
          state = 'MODIFICADO';
          rowClass = 'modified';
        }

        html += `
          <tr class="${rowClass}">
            <td style="mso-number-format:'\\@';">${id}</td>
            <td class="text-center">${unit}</td>
            <td>${desc}</td>
            <td class="number">${el1 ? qty1.toFixed(2) : '-'}</td>
            <td class="number">${el2 ? qty2.toFixed(2) : '-'}</td>
            <td class="number">${el1 ? price1.toFixed(2) : '-'}</td>
            <td class="number">${el2 ? price2.toFixed(2) : '-'}</td>
            <td class="number">${el1 ? tot1.toFixed(2) : '-'}</td>
            <td class="number">${el2 ? tot2.toFixed(2) : '-'}</td>
            <td class="number fw-bold">${diffItem ? (diffItem >= 0 ? '+' : '') + diffItem.toFixed(2) : '-'}</td>
            <td class="text-center fw-bold">${state}</td>
          </tr>
        `;
      });
    });

    const grandDiff = grandTotalV2 - grandTotalV1;
    html += `
        <tr class="total-row">
          <td colspan="3" class="fw-bold">PRESUPUESTO GENERAL CONSOLIDADO</td>
          <td class="number">-</td>
          <td class="number">-</td>
          <td class="number">-</td>
          <td class="number">-</td>
          <td class="number">${grandTotalV1.toFixed(2)}</td>
          <td class="number">${grandTotalV2.toFixed(2)}</td>
          <td class="number">${(grandDiff >= 0 ? '+' : '') + grandDiff.toFixed(2)}</td>
          <td class="text-center">${grandDiff > 0.01 ? 'SOBRECOSTE' : grandDiff < -0.01 ? 'AHORRO' : 'SIN CAMBIOS'}</td>
        </tr>
      </tbody>
      </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `comparativo_presupuestos_pinarejos.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Triggers download of the changes log report.
   */
  static downloadChangesExcel(project, v1, v2, changes) {
    if (!v2) return;
    
    const v1Name = v1 ? v1.name : 'Original';
    const v2Name = v2.name;
    const dateStr = new Date().toLocaleDateString('es-ES');
    const netDeviation = changes.reduce((sum, c) => sum + c.impact.economic, 0);

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11px; }
        .title-row { background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: bold; height: 35px; text-align: center; }
        .sub-title-row { background-color: #1e293b; color: #cbd5e1; font-size: 11px; height: 22px; text-align: center; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 8px 6px; }
        td { border: 1px solid #cbd5e1; padding: 6px; }
        .added { background-color: #d1fae5; color: #065f46; font-weight: bold; }
        .deleted { background-color: #fee2e2; color: #991b1b; font-weight: bold; text-decoration: line-through; }
        .modified { background-color: #fef3c7; color: #92400e; font-weight: bold; }
        .number { text-align: right; }
        .text-center { text-align: center; }
        .fw-bold { font-weight: bold; }
        .net-deviation-row { background-color: #f8fafc; font-weight: bold; height: 28px; }
      </style>
      </head>
      <body>
      <table>
        <tr class="title-row">
          <td colspan="5">INFORME DETALLADO DEL REGISTRO DE CAMBIOS</td>
        </tr>
        <tr class="sub-title-row">
          <td colspan="5">Proyecto: ${project.name} | V1: ${v1Name} vs V2: ${v2Name} | Fecha: ${dateStr}</td>
        </tr>
        <tr><td colspan="5"></td></tr>
        <thead>
          <tr>
            <th>Código</th>
            <th>Tipo Cambio</th>
            <th>Concepto / Elemento</th>
            <th>Importe (EUR)</th>
            <th>Explicación IA / Justificación</th>
          </tr>
        </thead>
        <tbody>
    `;

    changes.forEach(chg => {
      const typeText = chg.changeType === 'added' ? 'AÑADIDO' : chg.changeType === 'deleted' ? 'ELIMINADO' : 'MODIFICADO';
      const rowClass = chg.changeType;
      const econVal = chg.impact.economic;
      const econText = `${econVal >= 0 ? '+' : ''}${econVal.toFixed(2)}`;

      let cellNameContent = chg.elementName;
      if (chg.changeType === 'modified' && chg.fieldName.includes('name')) {
        cellNameContent += ` [CAMBIO DE ALCANCE - V1: "${chg.oldValue.name}" -> V2: "${chg.newValue.name}"]`;
      }

      html += `
        <tr>
          <td style="mso-number-format:'\\@'; font-family: monospace;">${chg.elementId}</td>
          <td class="${rowClass} text-center">${typeText}</td>
          <td>${cellNameContent}</td>
          <td class="number fw-bold">${econText}</td>
          <td style="color: #475569;">${chg.aiExplanation}</td>
        </tr>
      `;
    });

    html += `
        <tr class="net-deviation-row">
          <td colspan="3" class="text-center">DESVIACIÓN NETO CONSOLIDADA</td>
          <td class="number" style="color: ${netDeviation >= 0 ? '#b91c1c' : '#15803d'}; font-size: 12px;">${netDeviation >= 0 ? '+' : ''}${netDeviation.toFixed(2)}</td>
          <td></td>
        </tr>
      </tbody>
      </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `registro_cambios_${project.name.toLowerCase().replace(/\s+/g, '_')}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generates and downloads a scope change audit report in Excel format.
   * @param {Project} project
   * @param {Version} v1
   * @param {Version} v2
   * @param {Change[]} changes
   */
  static downloadScopeExcel(project, v1, v2, changes) {
    if (!v2) return;
    
    const v1Name = v1 ? v1.name : 'Original';
    const v2Name = v2.name;
    const dateStr = new Date().toLocaleDateString('es-ES');
    
    const scopeChanges = changes.filter(chg => 
      chg.changeType === 'added' || 
      chg.changeType === 'deleted' || 
      chg.fieldName.includes('name') || 
      chg.fieldName.includes('longDesc')
    );

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11px; }
        .title-row { background-color: #6366f1; color: #ffffff; font-size: 14px; font-weight: bold; height: 35px; text-align: center; }
        .sub-title-row { background-color: #1e293b; color: #cbd5e1; font-size: 11px; height: 22px; text-align: center; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 8px 6px; }
        td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
        .added { background-color: #d1fae5; color: #065f46; font-weight: bold; }
        .deleted { background-color: #fee2e2; color: #991b1b; font-weight: bold; text-decoration: line-through; }
        .modified { background-color: #fef3c7; color: #92400e; font-weight: bold; }
        .text-center { text-align: center; }
        .diff-v1 { color: #dc2626; text-decoration: line-through; }
        .diff-v2 { color: #16a34a; font-weight: bold; }
      </style>
      </head>
      <body>
      <table>
        <tr class="title-row">
          <td colspan="5">INFORME DE CONTROL DE CAMBIOS DE ALCANCE (TEXTOS Y PLIEGOS)</td>
        </tr>
        <tr class="sub-title-row">
          <td colspan="5">Proyecto: ${project.name} | V1: ${v1Name} vs V2: ${v2Name} | Fecha: ${dateStr}</td>
        </tr>
        <tr><td colspan="5"></td></tr>
        <thead>
          <tr>
            <th>Código</th>
            <th>Tipo Cambio</th>
            <th>Concepto / Elemento</th>
            <th>Especificación Anterior (V1)</th>
            <th>Especificación Nueva (V2)</th>
          </tr>
        </thead>
        <tbody>
    `;

    scopeChanges.forEach(chg => {
      const typeText = chg.changeType === 'added' ? 'AÑADIDO' : chg.changeType === 'deleted' ? 'ELIMINADO' : 'MODIFICADO';
      const rowClass = chg.changeType;
      
      let v1Text = '-';
      let v2Text = '-';

      if (chg.changeType === 'added') {
        v2Text = chg.newValue.longDesc || chg.newValue.name || 'Nueva partida';
      } else if (chg.changeType === 'deleted') {
        v1Text = chg.oldValue.longDesc || chg.oldValue.name || 'Partida anulada';
      } else {
        if (chg.fieldName.includes('name')) {
          v1Text = `[Resumen] ${chg.oldValue.name}`;
          v2Text = `[Resumen] ${chg.newValue.name}`;
        }
        if (chg.fieldName.includes('longDesc')) {
          v1Text = (v1Text !== '-' ? v1Text + '\n' : '') + `[Pliego] ${chg.oldValue.longDesc || ''}`;
          v2Text = (v2Text !== '-' ? v2Text + '\n' : '') + `[Pliego] ${chg.newValue.longDesc || ''}`;
        }
      }

      html += `
        <tr>
          <td style="mso-number-format:'\\@'; font-family: monospace;">${chg.elementId}</td>
          <td class="${rowClass} text-center">${typeText}</td>
          <td style="font-weight: bold;">${chg.elementName}</td>
          <td class="diff-v1" style="white-space: pre-wrap;">${v1Text}</td>
          <td class="diff-v2" style="white-space: pre-wrap;">${v2Text}</td>
        </tr>
      `;
    });

    html += `
      </tbody>
      </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Informe_Alcance_${project.name.replace(/\s+/g, '_')}_${v2Name.replace(/\s+/g, '_')}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Triggers download of the executive summary report.
   */
  static downloadExecutiveExcel(project, v1, v2, changes) {
    if (!v2) return;

    const v1Name = v1 ? v1.name : 'Original';
    const v2Name = v2.name;
    const dateStr = new Date().toLocaleDateString('es-ES');
    
    const netDeviation = changes.reduce((sum, c) => sum + c.impact.economic, 0);
    
    const addCount = changes.filter(c => c.changeType === 'added').length;
    const delCount = changes.filter(c => c.changeType === 'deleted').length;
    const modCount = changes.filter(c => c.changeType === 'modified').length;

    // Group changes by chapter
    const chapterGroups = {};
    changes.forEach(ch => {
      const el = v2.getElement('partida', ch.elementId) || (v1 ? v1.getElement('partida', ch.elementId) : null);
      const chapCode = el ? el.parentId : 'Otros';
      if (!chapterGroups[chapCode]) {
        chapterGroups[chapCode] = { sum: 0, count: 0 };
      }
      chapterGroups[chapCode].sum += ch.impact.economic;
      chapterGroups[chapCode].count += 1;
    });

    const allChapters = v2.getElementsByType('capitulo');

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11px; }
        .title-row { background-color: #1e1b4b; color: #ffffff; font-size: 14px; font-weight: bold; height: 35px; text-align: center; }
        .section-header { background-color: #312e81; color: #ffffff; font-weight: bold; height: 24px; padding-left: 6px; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px; }
        td { border: 1px solid #cbd5e1; padding: 6px; }
        .number { text-align: right; }
        .text-center { text-align: center; }
        .fw-bold { font-weight: bold; }
        .summary-label { background-color: #f1f5f9; font-weight: bold; width: 200px; }
      </style>
      </head>
      <body>
      <table>
        <tr class="title-row">
          <td colspan="4">RESUMEN EJECUTIVO DE CONTROL DE COSTES</td>
        </tr>
        <tr>
          <td class="summary-label">Proyecto:</td>
          <td colspan="3">${project.name}</td>
        </tr>
        <tr>
          <td class="summary-label">Fecha del Reporte:</td>
          <td colspan="3">${dateStr}</td>
        </tr>
        <tr>
          <td class="summary-label">Origen (V1):</td>
          <td>${v1Name}</td>
          <td class="summary-label">Destino (V2):</td>
          <td>${v2Name}</td>
        </tr>
        <tr>
          <td class="summary-label">Desviación Total:</td>
          <td colspan="3" class="fw-bold" style="color: ${netDeviation >= 0 ? '#b91c1c' : '#15803d'};">${netDeviation >= 0 ? '+' : ''}${netDeviation.toFixed(2)} €</td>
        </tr>
        
        <tr><td colspan="4"></td></tr>
        
        <!-- Partidas counts summary -->
        <tr class="section-header">
          <td colspan="4">1. RESUMEN DE CAMBIOS EN PARTIDAS</td>
        </tr>
        <thead>
          <tr>
            <th colspan="2">Tipo de Variación</th>
            <th colspan="2">Nº Partidas Afectadas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="2" style="color: #15803d; font-weight: bold;">Partidas Añadidas</td>
            <td colspan="2" class="text-center fw-bold">${addCount}</td>
          </tr>
          <tr>
            <td colspan="2" style="color: #b91c1c; font-weight: bold;">Partidas Eliminadas</td>
            <td colspan="2" class="text-center fw-bold">${delCount}</td>
          </tr>
          <tr>
            <td colspan="2" style="color: #b45309; font-weight: bold;">Partidas Modificadas</td>
            <td colspan="2" class="text-center fw-bold">${modCount}</td>
          </tr>
        </tbody>

        <tr><td colspan="4"></td></tr>

        <!-- Chapter list summary -->
        <tr class="section-header">
          <td colspan="4">2. DESVIACIONES POR CAPÍTULOS</td>
        </tr>
        <thead>
          <tr>
            <th>Código Capítulo</th>
            <th>Nombre Capítulo</th>
            <th class="text-center">Nº Cambios</th>
            <th class="number">Desviación Acumulada (€)</th>
          </tr>
        </thead>
        <tbody>
    `;

    allChapters.forEach(c => {
      const grp = chapterGroups[c.id] || { sum: 0, count: 0 };
      if (grp.count === 0) return;
      const grpColor = grp.sum > 0 ? 'color: #b91c1c;' : grp.sum < 0 ? 'color: #15803d;' : '';
      
      html += `
        <tr>
          <td style="mso-number-format:'\\@'; font-weight: bold;">${c.id}</td>
          <td>${c.name}</td>
          <td class="text-center">${grp.count}</td>
          <td class="number fw-bold" style="${grpColor}">${grp.sum >= 0 ? '+' : ''}${grp.sum.toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
        
        <tr><td colspan="4"></td></tr>
        
        <!-- Recommendations -->
        <tr class="section-header">
          <td colspan="4">3. RECOMENDACIONES TÉCNICAS</td>
        </tr>
        <tr>
          <td colspan="4" style="color: #475569;">
            <b>Control de Mediciones:</b> Analizar y validar con el equipo de obra aquellas partidas que presenten desviaciones significativas de medición para asegurar que corresponden con el estado real de la ejecución.<br><br>
            <b>Unidades Nuevas (Añadidas):</b> Tramitar la aprobación formal de los precios contradictorios de todas las partidas añadidas en V2 antes de proceder a la contratación o acopio de materiales.<br><br>
            <b>Optimización de Costes:</b> Revisar las partidas modificadas a la baja para verificar que no afecten a las especificaciones mínimas del proyecto de ejecución aprobado.
          </td>
        </tr>
      </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `resumen_ejecutivo_${project.name.toLowerCase().replace(/\s+/g, '_')}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
