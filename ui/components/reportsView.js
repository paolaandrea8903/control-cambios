/**
 * Reports Preview and Export Component.
 * Visualizes a printable document representation of revision changes.
 */
class ReportsViewComponent {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.currentTemplate = 'changelog'; // 'changelog' | 'executive' | 'comparison'
    this.setupListeners();
  }

  setupListeners() {
    const btnExportCSV = document.getElementById('btn-export-csv');
    const btnPrint = document.getElementById('btn-print-report');
    const templateItems = document.querySelectorAll('.report-template-item');

    if (btnExportCSV) {
      btnExportCSV.onclick = () => {
        const currentProject = this.uiManager.revisionManager.getCurrentProject();
        if (currentProject) {
          const versions = currentProject.getSortedVersions();
          const v1 = versions[0];
          const v2 = versions[versions.length - 1];
          
          if (this.currentTemplate === 'changelog') {
            ReportGenerator.downloadChangesExcel(currentProject, v1, v2, currentProject.changes);
          } else if (this.currentTemplate === 'executive') {
            ReportGenerator.downloadExecutiveExcel(currentProject, v1, v2, currentProject.changes);
          } else if (this.currentTemplate === 'comparison') {
            ReportGenerator.downloadStyledExcel(v1, v2, currentProject.changes);
          }
        }
      };
    }

    if (btnPrint) {
      btnPrint.onclick = () => {
        this.printReport();
      };
    }

    // Dynamic selection of template
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.report-template-item');
      if (item) {
        document.querySelectorAll('.report-template-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.currentTemplate = item.getAttribute('data-template');
        this.renderPreview();
      }
    });

    // Dynamic signature inputs listeners to re-render in real-time
    const inputPrepared = document.getElementById('report-signer-prepared');
    const inputApproved = document.getElementById('report-signer-approved');
    if (inputPrepared) {
      inputPrepared.oninput = () => this.renderPreview();
    }
    if (inputApproved) {
      inputApproved.oninput = () => this.renderPreview();
    }
  }

  render(project, v1, v2, changes) {
    this.project = project;
    this.v1 = v1;
    this.v2 = v2;
    this.changes = changes;

    this.renderPreview();
  }

  renderPreview() {
    const previewPane = document.getElementById('report-preview-pane');
    if (!previewPane || !this.v2) return;

    const v1Name = this.v1 ? this.v1.name : 'N/A';
    const v2Name = this.v2.name;
    const dateStr = new Date().toLocaleDateString('es-ES');

    const netDeviation = this.changes.reduce((sum, c) => sum + c.impact.economic, 0);
    const directionText = netDeviation >= 0 ? 'SOBRECOSTE NETO' : 'AHORRO NETO';
    const netClass = netDeviation >= 0 ? 'text-danger' : 'text-success';

    // Get current values from the left configuration card
    const preparedName = document.getElementById('report-signer-prepared')?.value || 'Departamento de Estudios';
    const approvedName = document.getElementById('report-signer-approved')?.value || 'Jefe de Obra';

    let html = '';

    if (this.currentTemplate === 'changelog') {
      // 1. CHANGE RECORD REPORT
      html = `
        <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
          <!-- Header -->
          <div style="border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">INFORME DE CONTROL DE REVISIONES</h2>
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Registro de Cambios del Presupuesto</span>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Fecha: <b>${dateStr}</b></div>
              <div>Proyecto: <b>${this.project.name}</b></div>
            </div>
          </div>

          <!-- Metadata -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px;">
            <tr>
              <td style="padding: 6px; font-weight: 600; width: 140px; border-bottom: 1px solid #e2e8f0;">Versión de Origen (V1):</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #475569;">${v1Name}</td>
              <td style="padding: 6px; font-weight: 600; width: 140px; border-bottom: 1px solid #e2e8f0;">Revisado Por:</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: bold;">
                ${preparedName}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Versión de Destino (V2):</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #475569;">${v2Name}</td>
              <td style="padding: 6px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Desviación Económica:</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; font-weight: bold;" class="${netClass}">${this.formatCurrency(netDeviation)}</td>
            </tr>
          </table>

          <!-- Executive Summary Callout -->
          <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; border-radius: 4px; padding: 15px; margin-bottom: 30px; font-size: 12.5px; color: #334155;">
            <h4 style="margin-top: 0; color: #0f172a; font-weight: 700; margin-bottom: 8px;">Análisis de IA de Alto Nivel</h4>
            <p style="margin: 0; font-style: italic;">
              El análisis comparativo de la revisión arroja un <b>${directionText} de ${this.formatCurrency(Math.abs(netDeviation))}</b>. Se registran variaciones significativas por optimización de soluciones en fachadas y movimiento de tierras, con incrementos compensados en costes indirectos mensuales de obra.
            </p>
          </div>

          <!-- Table of Changes -->
          <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">Listado de Desviaciones</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; width: 80px;">Código</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; width: 90px;">Cambio</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Concepto / Elemento</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; width: 100px;">Importe (EUR)</th>
                <th style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; width: 250px;">Explicación IA / Justificación</th>
              </tr>
            </thead>
            <tbody>
              ${this.changes.map(chg => {
                const typeText = chg.changeType === 'added' ? 'AÑADIDO' : chg.changeType === 'deleted' ? 'ELIMINADO' : 'MODIFICADO';
                const typeColor = chg.changeType === 'added' ? '#10b981' : chg.changeType === 'deleted' ? '#ef4444' : '#f59e0b';
                const rowClass = chg.impact.economic > 0 ? 'color: #dc2626;' : chg.impact.economic < 0 ? 'color: #16a34a;' : '';
                let cellNameContent = chg.elementName;
                if (chg.changeType === 'modified' && (chg.fieldName.includes('name') || chg.fieldName.includes('longDesc'))) {
                  let nameDiff = '';
                  if (chg.fieldName.includes('name')) {
                    nameDiff = `
                      <div style="margin-bottom: 2px;">
                        <strong>Resumen Corto:</strong><br>
                        <span style="color: #dc2626; text-decoration: line-through;">V1: ${chg.oldValue.name}</span> | <span style="color: #16a34a; font-weight: bold;">V2: ${chg.newValue.name}</span>
                      </div>
                    `;
                  }
                  let longDescDiff = '';
                  if (chg.fieldName.includes('longDesc')) {
                    longDescDiff = `
                      <div>
                        <strong>Texto Largo:</strong><br>
                        <span style="color: #dc2626; text-decoration: line-through; display: block; max-height: 40px; overflow: hidden; text-overflow: ellipsis;">V1: ${chg.oldValue.longDesc || '(Vacío)'}</span>
                        <span style="color: #16a34a; display: block; font-weight: bold; max-height: 40px; overflow: hidden; text-overflow: ellipsis;">V2: ${chg.newValue.longDesc || '(Vacío)'}</span>
                      </div>
                    `;
                  }
                  cellNameContent = `
                    <div>${chg.elementName}</div>
                    <div style="font-size: 8.5px; color: #64748b; margin-top: 4px; padding: 4px 6px; background-color: #f8fafc; border-radius: 4px; border-left: 2px solid #6366f1; font-weight: normal; line-height: 1.3;">
                      ${nameDiff}
                      ${longDescDiff}
                    </div>
                  `;
                }
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0; vertical-align: top;">
                    <td style="padding: 8px 10px; font-family: monospace; font-weight: bold;">${chg.elementId}</td>
                    <td style="padding: 8px 10px; font-weight: 700; color: ${typeColor}; font-size: 9px; letter-spacing: 0.3px;">${typeText}</td>
                    <td style="padding: 8px 10px; font-weight: 500;">${cellNameContent}</td>
                    <td style="padding: 8px 10px; font-family: monospace; text-align: right; font-weight: bold; ${rowClass}">${chg.impact.economic >= 0 ? '+' : ''}${this.formatCurrency(chg.impact.economic)}</td>
                    <td style="padding: 8px 10px; color: #475569; font-size: 10px; line-height: 1.4;">${chg.aiExplanation}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Footer Signature -->
          <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
              <div style="font-weight: bold; margin-bottom: 4px;">Revisado / Preparado Por:</div>
              <div style="height: 45px;"></div>
              <div style="border-top: 1px solid #94a3b8; width: 180px; margin-bottom: 4px;"></div>
              <div style="font-weight: bold; color: #1e293b;">${preparedName}</div>
            </div>
            
            <div style="align-self: flex-end; font-size: 9px; color: #94a3b8; padding-bottom: 5px;">
              Generado por RevConstruct
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
              <div style="font-weight: bold; margin-bottom: 4px;">Aprobado Por:</div>
              <div style="height: 45px;"></div>
              <div style="border-top: 1px solid #94a3b8; width: 180px; margin-bottom: 4px;"></div>
              <div style="font-weight: bold; color: #1e293b;">${approvedName}</div>
            </div>
          </div>
        </div>
      `;
    } else if (this.currentTemplate === 'executive') {
      // 2. EXECUTIVE SUMMARY REPORT
      const addCount = this.changes.filter(c => c.changeType === 'added').length;
      const delCount = this.changes.filter(c => c.changeType === 'deleted').length;
      const modCount = this.changes.filter(c => c.changeType === 'modified').length;

      // Group changes by chapter
      const chapterGroups = {};
      this.changes.forEach(ch => {
        const el = this.v2.getElement('partida', ch.elementId) || (this.v1 ? this.v1.getElement('partida', ch.elementId) : null);
        const chapCode = el ? el.parentId : 'Otros';
        if (!chapterGroups[chapCode]) {
          chapterGroups[chapCode] = { sum: 0, count: 0 };
        }
        chapterGroups[chapCode].sum += ch.impact.economic;
        chapterGroups[chapCode].count += 1;
      });

      // Retrieve all chapters from V2
      const allChapters = this.v2.getElementsByType('capitulo');

      html = `
        <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px double #6366f1; padding-bottom: 20px;">
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px;">RESUMEN EJECUTIVO DE CONTROL DE COSTES</h1>
            <span style="font-size: 12px; color: #64748b; font-weight: 600;">Control de Revisiones en Fase de Construcción</span>
          </div>

          <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">1. Resumen de Variaciones</h3>
          <p style="font-size: 12.5px; color: #334155; margin-bottom: 20px;">
            En la revisión de presupuestos realizada el <b>${dateStr}</b>, se han comparado las partidas consolidadas de la versión original contra la última revisión entregada. Se identificaron <b>${this.changes.length} cambios en total</b>, que derivan en una desviación presupuestaria de <b class="${netClass}">${this.formatCurrency(netDeviation)}</b>.
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 30px; text-align: center; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Partidas Añadidas</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Partidas Eliminadas</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Partidas Modificadas</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Variación Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 12px; border: 1px solid #cbd5e1; font-weight: 600; color: #16a34a; font-size: 16px;">+${addCount}</td>
                <td style="padding: 12px; border: 1px solid #cbd5e1; font-weight: 600; color: #dc2626; font-size: 16px;">-${delCount}</td>
                <td style="padding: 12px; border: 1px solid #cbd5e1; font-weight: 600; color: #d97706; font-size: 16px;">${modCount}</td>
                <td style="padding: 12px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 16px;" class="${netClass}">${this.formatCurrency(netDeviation)}</td>
              </tr>
            </tbody>
          </table>

          <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">2. Desviaciones Críticas por Capítulos</h3>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 12px;">Se ordenan a continuación los capítulos que han sufrido mayor alteración de costes absolutos en esta revisión:</p>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f8fafc; text-align: left;">
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Código Capítulo</th>
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Nombre Capítulo</th>
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center; width: 80px;">Nº Cambios</th>
                <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right; width: 140px;">Desviación Acumulada</th>
              </tr>
            </thead>
            <tbody>
              ${allChapters.map(c => {
                const grp = chapterGroups[c.id] || { sum: 0, count: 0 };
                if (grp.count === 0) return '';
                const grpClass = grp.sum > 0 ? 'color: #dc2626;' : grp.sum < 0 ? 'color: #16a34a;' : '';
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; font-weight: bold; font-family: monospace;">${c.id}</td>
                    <td style="padding: 8px; font-weight: 500;">${c.name}</td>
                    <td style="padding: 8px; text-align: center; color: #64748b;">${grp.count}</td>
                    <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold; ${grpClass}">${grp.sum >= 0 ? '+' : ''}${this.formatCurrency(grp.sum)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">3. Recomendaciones Técnicas</h3>
          <div style="font-size: 12px; color: #475569; line-height: 1.5; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 30px;">
            <ul style="margin: 0; padding-left: 15px; display: flex; flex-direction: column; gap: 8px;">
              <li><b>Control de Mediciones:</b> Analizar y validar con el equipo de obra aquellas partidas que presenten desviaciones significativas de medición para asegurar que corresponden con el estado real de la ejecución.</li>
              <li><b>Unidades Nuevas (Añadidas):</b> Tramitar la aprobación formal de los precios contradictorios de todas las partidas añadidas en V2 antes de proceder a la contratación o acopio de materiales.</li>
              <li><b>Optimización de Costes:</b> Revisar las partidas modificadas a la baja para verificar que no afecten a las especificaciones mínimas del proyecto de ejecución aprobado.</li>
            </ul>
          </div>

          <!-- Footer Signature -->
          <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
              <div style="font-weight: bold; margin-bottom: 4px;">Revisado / Preparado Por:</div>
              <div style="height: 45px;"></div>
              <div style="border-top: 1px solid #94a3b8; width: 180px; margin-bottom: 4px;"></div>
              <div style="font-weight: bold; color: #1e293b;">${preparedName}</div>
            </div>
            
            <div style="align-self: flex-end; font-size: 9px; color: #94a3b8; padding-bottom: 5px;">
              Generado por RevConstruct
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
              <div style="font-weight: bold; margin-bottom: 4px;">Aprobado Por:</div>
              <div style="height: 45px;"></div>
              <div style="border-top: 1px solid #94a3b8; width: 180px; margin-bottom: 4px;"></div>
              <div style="font-weight: bold; color: #1e293b;">${approvedName}</div>
            </div>
          </div>
        </div>
      `;
    } else if (this.currentTemplate === 'comparison') {
      // 3. COMPARISON OF COMPLETE BUDGET (THE EXPLORER VIEW TABLE)
      const chaps1 = this.v1 ? this.v1.getElementsByType('capitulo') : [];
      const chaps2 = this.v2.getElementsByType('capitulo');
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

      let budgetRowsHtml = '';

      sortedChaps.forEach(chap => {
        const t1 = chap.t1;
        const t2 = chap.t2;
        const diff = t2 - t1;
        const diffText = `${diff >= 0 ? '+' : ''}${this.formatCurrency(diff)}`;
        const diffClass = diff > 0.01 ? 'text-danger' : diff < -0.01 ? 'text-success' : '';

        // Chapter Row
        budgetRowsHtml += `
          <tr style="background-color: #e2e8f0; font-weight: bold; font-size: 11px; border-bottom: 2px solid #cbd5e1;">
            <td style="padding: 6px 8px; font-family: monospace;">${chap.id}</td>
            <td style="padding: 6px 8px; text-align: center;">-</td>
            <td style="padding: 6px 8px; font-weight: bold;" colspan="5">${chap.name}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #475569;">${t1 ? this.formatCurrency(t1) : '-'}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${t2 ? this.formatCurrency(t2) : '-'}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;" class="${diffClass}">${diffText}</td>
            <td style="padding: 6px 8px; text-align: center;"><span class="badge ${diff > 0.01 ? 'badge-danger-subtle' : diff < -0.01 ? 'badge-success-subtle' : 'badge-neutral'}">${diff > 0.01 ? 'SOBRECOSTE' : diff < -0.01 ? 'AHORRO' : 'SIN CAMBIOS'}</span></td>
          </tr>
        `;

        // Get items for this chapter
        const items1 = this.v1 ? this.v1.getElementsByType('partida').filter(item => item.parentId === chap.id) : [];
        const items2 = this.v2.getElementsByType('partida').filter(item => item.parentId === chap.id);

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
          let typeText = 'SIN CAMBIOS';
          let typeColor = 'badge-neutral';
          let rowBg = '';

          let unit = el2 ? el2.data.unit : el1.data.unit;
          let desc = el2 ? el2.name : el1.name;
          
          let qty1 = el1 ? el1.data.qty_medicion : 0;
          let qty2 = el2 ? el2.data.qty_medicion : 0;
          let price1 = el1 ? el1.data.price : 0;
          let price2 = el2 ? el2.data.price : 0;
          
          let tot1 = el1 ? el1.data.total : 0;
          let tot2 = el2 ? el2.data.total : 0;
          let diffItem = tot2 - tot1;
          const diffItemText = `${diffItem >= 0 ? '+' : ''}${this.formatCurrency(diffItem)}`;
          const diffItemClass = diffItem > 0.01 ? 'text-danger' : diffItem < -0.01 ? 'text-success' : '';

          const change = this.changes.find(c => c.elementType === 'partida' && c.elementId === id);

          if (!el1 && el2) {
            typeText = 'AÑADIDO';
            typeColor = 'badge-success-subtle';
            rowBg = 'background-color: #f0fdf4;';
          } else if (el1 && !el2) {
            typeText = 'ELIMINADO';
            typeColor = 'badge-danger-subtle';
            rowBg = 'background-color: #fef2f2; text-decoration: line-through; color: #94a3b8;';
          } else if (change) {
            typeText = 'MODIFICADO';
            typeColor = 'badge-warning-subtle';
            rowBg = 'background-color: #fffbeb;';
          }

          budgetRowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; ${rowBg}">
              <td style="padding: 6px 8px; font-family: monospace;">${id}</td>
              <td style="padding: 6px 8px; text-align: center; color: #64748b; font-weight: bold;">${unit}</td>
              <td style="padding: 6px 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${desc}">${desc}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #64748b;">${el1 ? qty1.toFixed(2) : '-'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${el2 ? qty2.toFixed(2) : '-'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #64748b;">${el1 ? price1.toFixed(2) : '-'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${el2 ? price2.toFixed(2) : '-'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #64748b;">${el1 ? this.formatCurrency(tot1) : '-'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${el2 ? this.formatCurrency(tot2) : '-'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;" class="${diffItemClass}">${el1 && el2 && Math.abs(diffItem) <= 0.01 ? '-' : diffItemText}</td>
              <td style="padding: 6px 8px; text-align: center;"><span class="badge ${typeColor}">${typeText}</span></td>
            </tr>
          `;
        });
      });

      html = `
        <div style="padding: 20px; color: #1e293b; line-height: 1.5; font-family: inherit;">
          <!-- Header -->
          <div style="border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0;">INFORME COMPARATIVO DE PRESUPUESTO COMPLETO</h2>
              <span style="font-size: 11px; text-transform: uppercase; color: #16a34a; font-weight: 700; letter-spacing: 0.5px;">Comparativa Consolidada de Capítulos y Partidas</span>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div>Fecha: <b>${dateStr}</b></div>
              <div>Proyecto: <b>${this.project.name}</b></div>
            </div>
          </div>

          <!-- Metadata -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px;">
            <tr>
              <td style="padding: 6px; font-weight: 600; width: 140px; border-bottom: 1px solid #e2e8f0;">Versión de Origen (V1):</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #475569;">${v1Name}</td>
              <td style="padding: 6px; font-weight: 600; width: 140px; border-bottom: 1px solid #e2e8f0;">Analista Responsable:</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: bold;">
                ${preparedName}
              </td>
            </tr>
            <tr>
              <td style="padding: 6px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Versión de Destino (V2):</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; color: #475569;">${v2Name}</td>
              <td style="padding: 6px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Diferencia General:</td>
              <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; font-weight: bold;" class="${netClass}">${this.formatCurrency(netDeviation)}</td>
            </tr>
          </table>

          <!-- Comparative Budget Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #1e293b; color: #ffffff; text-align: left; font-size: 9px;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 65px;">Código</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 25px;">Ud</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 150px;">Descripción</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 45px;">Cant. V1</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 45px;">Cant. V2</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 50px;">Prc. V1</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 50px;">Prc. V2</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 70px;">Total V1</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 70px;">Total V2</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 65px;">Desv. (€)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 60px;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${budgetRowsHtml}
            </tbody>
          </table>

          <!-- Footer Signature -->
          <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
              <div style="font-weight: bold; margin-bottom: 4px;">Revisado / Preparado Por:</div>
              <div style="height: 45px;"></div>
              <div style="border-top: 1px solid #94a3b8; width: 180px; margin-bottom: 4px;"></div>
              <div style="font-weight: bold; color: #1e293b;">${preparedName}</div>
            </div>
            
            <div style="align-self: flex-end; font-size: 9px; color: #94a3b8; padding-bottom: 5px;">
              Generado por RevConstruct
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
              <div style="font-weight: bold; margin-bottom: 4px;">Aprobado Por:</div>
              <div style="height: 45px;"></div>
              <div style="border-top: 1px solid #94a3b8; width: 180px; margin-bottom: 4px;"></div>
              <div style="font-weight: bold; color: #1e293b;">${approvedName}</div>
            </div>
          </div>
        </div>
      `;
    }

    previewPane.innerHTML = html;
  }

  printReport() {
    const previewContent = document.getElementById('report-preview-pane').innerHTML;
    
    // Open a new print window with clean styled sheets
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Informe de Control de Revisiones</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Outfit', sans-serif;
              background-color: #fff;
              color: #1e293b;
              margin: 0;
              padding: 20px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .text-danger { color: #dc2626 !important; }
            .text-success { color: #16a34a !important; }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              font-size: 8px;
              font-weight: 700;
              border-radius: 4px;
              text-transform: uppercase;
            }
            .badge-neutral { background-color: #f1f5f9; color: #475569; }
            .badge-success-subtle { background-color: #d1fae5; color: #065f46; }
            .badge-danger-subtle { background-color: #fee2e2; color: #991b1b; }
            .badge-warning-subtle { background-color: #fef3c7; color: #92400e; }
            @media print {
              body { padding: 0; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${previewContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
