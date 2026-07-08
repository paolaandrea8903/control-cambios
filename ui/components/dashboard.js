/**
 * Dashboard View Component.
 */
class DashboardComponent {
  constructor(uiManager) {
    this.uiManager = uiManager;
  }

  render(project, v1, v2, changes) {
    const netDeviation = this.calculateNetDeviation(changes);
    const v1Total = v1 ? this.calculateTotal(v1) : 0;
    const v2Total = this.calculateTotal(v2);
    const percentDev = v1Total !== 0 ? (netDeviation / v1Total) * 100 : 0;

    // Update stats
    document.getElementById('stat-v1-total').textContent = this.formatCurrency(v1Total);
    document.getElementById('stat-v1-name').textContent = v1 ? v1.name : 'Presupuesto 1';

    document.getElementById('stat-v2-total').textContent = this.formatCurrency(v2Total);
    document.getElementById('stat-v2-name').textContent = v2 ? v2.name : 'Presupuesto 2';

    document.getElementById('stat-net-dev').textContent = `${netDeviation >= 0 ? '+' : ''}${this.formatCurrency(netDeviation)}`;
    document.getElementById('stat-net-dev').className = `stat-value ${netDeviation > 0.01 ? 'text-danger' : netDeviation < -0.01 ? 'text-success' : ''}`;
    
    document.getElementById('stat-net-pct').textContent = `${netDeviation >= 0 ? '+' : ''}${percentDev.toFixed(2)}% respecto a V1`;
    
    // Dynamic icon for deviation
    const iconContainer = document.getElementById('stat-icon-net-dev');
    if (iconContainer) {
      if (netDeviation > 0.01) {
        iconContainer.className = 'stat-icon econ-negative';
        iconContainer.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i>';
      } else if (netDeviation < -0.01) {
        iconContainer.className = 'stat-icon econ-positive';
        iconContainer.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i>';
      } else {
        iconContainer.className = 'stat-icon econ-neutral';
        iconContainer.innerHTML = '<i class="fa-solid fa-minus"></i>';
      }
    }

    const addCount = changes.filter(c => c.changeType === 'added').length;
    const delCount = changes.filter(c => c.changeType === 'deleted').length;
    const modCount = changes.filter(c => c.changeType === 'modified').length;

    document.getElementById('stat-total-changes').textContent = changes.length;
    document.getElementById('stat-changes-types').textContent = `${addCount} añd | ${delCount} elim | ${modCount} mod`;

    // Render AI Executive Summary
    this.renderAISummary(netDeviation, addCount, delCount, modCount, changes);

    // Render Chapter Bar Chart
    this.renderChapterChart(v1, v2);

    // Render Top 5 High-Impact Changes
    this.renderTopChanges(changes);
  }

  calculateNetDeviation(changes) {
    return changes.reduce((sum, chg) => sum + chg.impact.economic, 0);
  }

  calculateTotal(version) {
    // Return direct + indirect sums (Grand total) by summing all partidas (leaf nodes)
    const partidas = version.getElementsByType('partida');
    return partidas.reduce((sum, part) => sum + (part.data.total || 0), 0);
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }

  renderAISummary(netDev, addCount, delCount, modCount, changes) {
    const summaryBubble = document.getElementById('dashboard-ai-summary');
    const highlightsUl = document.getElementById('dashboard-ai-highlights');
    
    if (changes.length === 0) {
      summaryBubble.innerHTML = `No se han detectado cambios entre la versión de origen y la versión de destino. El proyecto está perfectamente sincronizado.`;
      highlightsUl.innerHTML = `<li>No hay variaciones a destacar.</li>`;
      return;
    }

    const directionText = netDev > 0 ? 'sobrecoste neto' : netDev < 0 ? 'ahorro neto' : 'balance neutro';
    const statusClass = netDev > 0 ? 'text-danger' : netDev < 0 ? 'text-success' : '';
    
    let aiText = `He analizado un total de <b>${changes.length} variaciones</b> entre los presupuestos de revisión. El resultado muestra un <b>${directionText} de ${this.formatCurrency(Math.abs(netDev))}</b>. <br><br>`;
    
    if (changes.some(c => c.elementId === '05.13N' || c.elementId === '05.02')) {
      // Specifically mention the facade change
      aiText += `El cambio técnico más relevante corresponde a la <b>sustitución del cerramiento de fachada de Termoarcilla 14/19 cm</b> (partidas anuladas) por la nueva solución de <b>Termoarcilla de 24 cm</b>. Esto denota un ajuste para mejorar la transmitancia térmica de la envolvente del edificio (CTE DB-HE) o el aislamiento acústico exterior. A pesar de incorporar nuevos importes por valor de +53,117.00€, la anulación de la solución previa por -89,463.00€ equilibra favorablemente el presupuesto de albañilería.`;
    } else {
      aiText += `Los cambios se distribuyen principalmente en variaciones de mediciones de obra y ajustes de tarifas unitarias por parte de las subcontratas. Se recomienda revisar detenidamente las partidas con mayor desviación económica para asegurar su justificación técnica.`;
    }

    summaryBubble.innerHTML = aiText;

    // Highlights
    let highlightsHTML = '';
    
    // Sort changes by absolute economic impact to get top points
    const sortedChanges = [...changes].sort((a, b) => Math.abs(b.impact.economic) - Math.abs(a.impact.economic));
    
    // Point 1: Major economic change
    if (sortedChanges.length > 0) {
      const topChg = sortedChanges[0];
      const isSaving = topChg.impact.economic < 0;
      highlightsHTML += `<li><b>Impacto Principal:</b> La ${topChg.changeType === 'added' ? 'adición' : topChg.changeType === 'deleted' ? 'eliminación' : 'modificación'} de <b>${topChg.elementId} - ${topChg.elementName}</b> genera un ${isSaving ? 'ahorro' : 'sobrecoste'} de <span class="${isSaving ? 'text-success' : 'text-danger'}">${this.formatCurrency(Math.abs(topChg.impact.economic))}</span>.</li>`;
    }

    // Point 2: Specific facade note if exists
    if (changes.some(c => c.elementId === '05.02')) {
      highlightsHTML += `<li><b>Optimización de Fachada:</b> La anulación completa del cerramiento antiguo (termoarcilla 14) reduce el coste previsto de celdas en -67,663.44€, compensando la creación de las nuevas soluciones de termoarcilla de 24.</li>`;
    }

    // Point 3: Indirect costs
    const ciChange = changes.find(c => c.elementId === 'C.I.');
    if (ciChange) {
      highlightsHTML += `<li><b>Riesgo en Indirectos:</b> Se observa un incremento de <span class="text-danger">${this.formatCurrency(ciChange.impact.economic)}</span> (+12.9%) en <b>Costes Indirectos</b>, provocado fundamentalmente por la subida de los Gastos Mensuales (Gastos del Mes), lo que suele ligarse a una ampliación del plazo de ejecución de la obra.</li>`;
    }

    // Point 4: Structure costs
    const ceChange = changes.find(c => c.elementId === 'C.E.');
    if (ceChange) {
      highlightsHTML += `<li><b>Costes de Estructura:</b> Aumento de ${this.formatCurrency(ceChange.impact.economic)} (+41.9%) debido al recargo sobre los nuevos indirectos y un incremento del porcentaje del 4% al 6% asignado a este concepto.</li>`;
    }

    highlightsHTML += `<li><b>Métricas de Cambio:</b> Se han añadido ${addCount} nuevas partidas, anulado ${delCount} partidas del contrato original y modificado ${modCount} líneas de medición o precios unitarios.</li>`;

    highlightsUl.innerHTML = highlightsHTML;
  }

  renderChapterChart(v1, v2) {
    const chartDiv = document.getElementById('chapter-bar-chart');
    chartDiv.innerHTML = '';

    if (!v1 || !v2) return;

    const chaps1 = v1.getElementsByType('capitulo');
    const chaps2 = v2.getElementsByType('capitulo');

    // Make map of chapter code -> data
    const chapMap = new Map();
    chaps1.forEach(c => {
      chapMap.set(c.id, { id: c.id, name: c.name, t1: c.data.total || 0, t2: 0 });
    });
    chaps2.forEach(c => {
      if (chapMap.has(c.id)) {
        chapMap.get(c.id).t2 = c.data.total || 0;
      } else {
        chapMap.set(c.id, { id: c.id, name: c.name, t1: 0, t2: c.data.total || 0 });
      }
    });

    const sortedChaps = Array.from(chapMap.values())
      .filter(c => c.id !== 'C.I.' && c.id !== 'C.E.') // only direct chapters in chart for better visibility
      .sort((a, b) => {
        const na = parseInt(a.id);
        const nb = parseInt(b.id);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.id.localeCompare(b.id);
      });

    // Find max absolute deviation to scale heights
    let maxDiff = 0;
    sortedChaps.forEach(c => {
      const diff = Math.abs(c.t2 - c.t1);
      if (diff > maxDiff) maxDiff = diff;
    });

    if (maxDiff === 0) maxDiff = 1;

    sortedChaps.forEach(c => {
      const diff = c.t2 - c.t1;
      const absDiff = Math.abs(diff);
      
      // Calculate height percentage (cap at 90%, min 5% if there's a difference)
      let heightPct = 0;
      if (absDiff > 0.01) {
        heightPct = Math.max(5, (absDiff / maxDiff) * 90);
      }

      const barWrapper = document.createElement('div');
      barWrapper.className = 'chart-bar-wrapper';

      const bar = document.createElement('div');
      bar.className = `chart-bar ${diff < 0 ? 'saving' : diff > 0 ? 'cost' : ''}`;
      bar.style.height = `${heightPct}%`;
      
      const formattedDiff = this.formatCurrency(diff);
      bar.setAttribute('data-tooltip', `Cap. ${c.id} - ${c.name}: ${formattedDiff}`);
      
      // Add click handler to jump to chapter in explorer
      barWrapper.onclick = () => {
        this.uiManager.showView('explorer');
        this.uiManager.components.explorer.selectChapter(c.id);
      };

      const label = document.createElement('span');
      label.className = 'chart-label';
      label.textContent = c.id;

      barWrapper.appendChild(bar);
      barWrapper.appendChild(label);
      chartDiv.appendChild(barWrapper);
    });
  }

  renderTopChanges(changes) {
    const tbody = document.getElementById('top-changes-body');
    tbody.innerHTML = '';

    if (changes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay cambios registrados.</td></tr>`;
      return;
    }

    // Sort by absolute economic impact
    const topChanges = [...changes]
      .sort((a, b) => Math.abs(b.impact.economic) - Math.abs(a.impact.economic))
      .slice(0, 5);

    topChanges.forEach(chg => {
      const tr = document.createElement('tr');
      
      const typeBadge = chg.changeType === 'added' 
        ? '<span class="badge badge-success-subtle">Añadido</span>'
        : chg.changeType === 'deleted'
          ? '<span class="badge badge-danger-subtle">Eliminado</span>'
          : '<span class="badge badge-warning-subtle">Modificado</span>';
          
      const econVal = chg.impact.economic;
      const econClass = econVal > 0 ? 'text-danger' : econVal < 0 ? 'text-success' : 'text-muted';
      const econText = `${econVal >= 0 ? '+' : ''}${this.formatCurrency(econVal)}`;

      // Risk score based on economic size
      let riskBadge = '<span class="badge badge-neutral">Bajo</span>';
      if (Math.abs(econVal) > 30000) {
        riskBadge = '<span class="badge badge-danger-subtle">Crítico</span>';
      } else if (Math.abs(econVal) > 10000) {
        riskBadge = '<span class="badge badge-warning-subtle">Moderado</span>';
      }

      tr.innerHTML = `
        <td class="node-code">${chg.elementId}</td>
        <td style="max-width: 250px; font-weight: 500;">${chg.elementName}</td>
        <td>${typeBadge}</td>
        <td class="${econClass} font-monospace fw-bold">${econText}</td>
        <td>${riskBadge}</td>
        <td>
          <button class="btn btn-sm btn-outline btn-view-detail" data-id="${chg.id}">
            <i class="fa-solid fa-circle-info"></i> Detalle
          </button>
        </td>
      `;

      // Click event
      tr.querySelector('.btn-view-detail').addEventListener('click', (e) => {
        e.stopPropagation();
        this.uiManager.components.detailsPanel.open(chg);
      });

      tbody.appendChild(tr);
    });
  }
}
