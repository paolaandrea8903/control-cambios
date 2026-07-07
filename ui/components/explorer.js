/**
 * Explorer View Component.
 * Handles the chapter tree and detail table of elements.
 */
class ExplorerComponent {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.currentChapterId = null;
    this.setupListeners();
  }

  setupListeners() {
    const searchInput = document.getElementById('tree-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterChapters(e.target.value);
      });
    }

    const btnExport = document.getElementById('btn-export-styled-budget');
    if (btnExport) {
      btnExport.onclick = () => {
        this.exportCompleteBudgetExcel();
      };
    }
  }

  selectChapter(chapterId) {
    this.currentChapterId = chapterId;
    
    // Highlight node in tree
    const nodes = document.querySelectorAll('.tree-node');
    nodes.forEach(n => {
      if (n.getAttribute('data-id') === chapterId) {
        n.classList.add('active');
        n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        n.classList.remove('active');
      }
    });

    // Render elements
    this.renderChapterElements();
  }

  filterChapters(query) {
    const q = query.toLowerCase().trim();
    const nodes = document.querySelectorAll('.tree-node');
    nodes.forEach(node => {
      const name = node.querySelector('.node-name').textContent.toLowerCase();
      const code = node.querySelector('.node-code').textContent.toLowerCase();
      if (name.includes(q) || code.includes(q)) {
        node.style.display = 'flex';
      } else {
        node.style.display = 'none';
      }
    });
  }

  render(project, v1, v2, changes) {
    this.project = project;
    this.v1 = v1;
    this.v2 = v2;
    this.changes = changes;

    const treeContainer = document.getElementById('explorer-tree');
    treeContainer.innerHTML = '';

    if (!v2) return;

    // Get all chapters in both versions
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

    sortedChaps.forEach(c => {
      const diff = c.t2 - c.t1;
      
      // Determine dot color based on changes inside chapter
      const chapChanges = changes.filter(ch => ch.newValue?.parentId === c.id || ch.oldValue?.parentId === c.id);
      let dotColor = 'bg-secondary';
      if (chapChanges.length > 0) {
        if (chapChanges.some(ch => ch.changeType === 'deleted')) {
          dotColor = 'bg-danger';
        } else if (chapChanges.some(ch => ch.changeType === 'added')) {
          dotColor = 'bg-success';
        } else if (chapChanges.some(ch => ch.changeType === 'modified')) {
          dotColor = 'bg-warning';
        }
      }

      const node = document.createElement('div');
      node.className = `tree-node ${this.currentChapterId === c.id ? 'active' : ''}`;
      node.setAttribute('data-id', c.id);
      node.innerHTML = `
        <div class="node-left">
          <span class="node-code">${c.id}</span>
          <span class="node-name" title="${c.name}">${c.name}</span>
        </div>
        <span class="node-status-dot ${dotColor}"></span>
      `;

      node.addEventListener('click', () => {
        this.selectChapter(c.id);
      });

      treeContainer.appendChild(node);
    });

    // Auto-select first chapter if none selected
    if (!this.currentChapterId && sortedChaps.length > 0) {
      this.selectChapter(sortedChaps[0].id);
    } else if (this.currentChapterId) {
      this.selectChapter(this.currentChapterId);
    }
  }

  renderChapterElements() {
    const tbody = document.getElementById('chapter-elements-body');
    const title = document.getElementById('explorer-current-chapter-title');
    const badge = document.getElementById('explorer-chapter-badge');
    const totalV1Span = document.getElementById('chapter-total-v1');
    const totalV2Span = document.getElementById('chapter-total-v2');
    const diffSpan = document.getElementById('chapter-total-diff');

    tbody.innerHTML = '';

    if (!this.currentChapterId || !this.v2) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">Selecciona un capítulo.</td></tr>`;
      return;
    }

    const chap1 = this.v1 ? this.v1.getElement('capitulo', this.currentChapterId) : null;
    const chap2 = this.v2.getElement('capitulo', this.currentChapterId);

    const name = chap2 ? chap2.name : chap1 ? chap1.name : 'Desconocido';
    title.textContent = `${this.currentChapterId}. ${name}`;
    
    const t1 = chap1 ? (chap1.data.total || 0) : 0;
    const t2 = chap2 ? (chap2.data.total || 0) : 0;
    const diff = t2 - t1;

    totalV1Span.textContent = this.formatCurrency(t1);
    totalV2Span.textContent = this.formatCurrency(t2);
    diffSpan.textContent = `${diff >= 0 ? '+' : ''}${this.formatCurrency(diff)}`;
    
    if (diff > 0.01) {
      diffSpan.className = 'chapter-diff cost';
      badge.textContent = 'Sobrecoste';
      badge.className = 'badge badge-danger-subtle';
    } else if (diff < -0.01) {
      diffSpan.className = 'chapter-diff saving';
      badge.textContent = 'Ahorro';
      badge.className = 'badge badge-success-subtle';
    } else {
      diffSpan.className = 'chapter-diff none';
      badge.textContent = 'Sin Cambios';
      badge.className = 'badge badge-neutral';
    }

    // Get all items in this chapter for both versions
    const items1 = this.v1 ? this.v1.getElementsByType('partida').filter(item => item.parentId === this.currentChapterId) : [];
    const items2 = this.v2.getElementsByType('partida').filter(item => item.parentId === this.currentChapterId);

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

    if (sortedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">No hay partidas en este capítulo.</td></tr>`;
      return;
    }

    sortedItems.forEach(({ id, el1, el2 }) => {
      const tr = document.createElement('tr');
      
      let stateBadge = '<span class="badge badge-neutral">Sin Cambios</span>';
      
      let unit = el2 ? el2.data.unit : el1.data.unit;
      let desc = el2 ? el2.name : el1.name;
      
      let qty1 = el1 ? el1.data.qty_medicion : 0;
      let qty2 = el2 ? el2.data.qty_medicion : 0;
      let price1 = el1 ? el1.data.price : 0;
      let price2 = el2 ? el2.data.price : 0;
      
      let tot1 = el1 ? el1.data.total : 0;
      let tot2 = el2 ? el2.data.total : 0;

      // Find if this element has a change in our change engine list
      const change = this.changes.find(c => c.elementType === 'partida' && c.elementId === id);

      if (!el1 && el2) {
        stateBadge = '<span class="badge badge-success-subtle">Añadido</span>';
        tr.className = 'row-added';
      } else if (el1 && !el2) {
        stateBadge = '<span class="badge badge-danger-subtle">Eliminado</span>';
        tr.className = 'row-deleted';
      } else if (change) {
        stateBadge = '<span class="badge badge-warning-subtle">Modificado</span>';
        tr.className = 'row-modified';
      }

      const isQtyChanged = el1 && el2 && Math.abs(qty1 - qty2) > 0.0001;
      const isPriceChanged = el1 && el2 && Math.abs(price1 - price2) > 0.0001;
      
      const qty1Text = el1 ? qty1.toFixed(2) : '-';
      const qty2Text = el2 ? qty2.toFixed(2) : '-';
      const price1Text = el1 ? price1.toFixed(2) : '-';
      const price2Text = el2 ? price2.toFixed(2) : '-';
      
      const qty2HTML = isQtyChanged ? `<b class="text-warning">${qty2Text}</b>` : qty2Text;
      const price2HTML = isPriceChanged ? `<b class="text-warning">${price2Text}</b>` : price2Text;

      tr.innerHTML = `
        <td class="node-code">${id}</td>
        <td class="text-muted" style="font-size: 11px; font-weight: bold;">${unit}</td>
        <td style="max-width: 350px; font-weight: 500;" title="${desc}">${desc}</td>
        <td class="text-end font-monospace text-muted">${qty1Text}</td>
        <td class="text-end font-monospace">${qty2HTML}</td>
        <td class="text-end font-monospace text-muted">${price1Text}</td>
        <td class="text-end font-monospace">${price2HTML}</td>
        <td class="text-end font-monospace text-muted">${el1 ? this.formatCurrency(tot1) : '-'}</td>
        <td class="text-end font-monospace fw-bold">${el2 ? this.formatCurrency(tot2) : '-'}</td>
        <td class="text-center">${stateBadge}</td>
      `;

      // If change is present, make the row clickable to view details
      if (change) {
        tr.style.cursor = 'pointer';
        tr.onclick = () => {
          this.uiManager.components.detailsPanel.open(change);
        };
      }

      tbody.appendChild(tr);
    });
  }

  exportCompleteBudgetExcel() {
    if (!this.v2) return;
    
    const v1Name = this.v1 ? this.v1.name : 'Original';
    const v2Name = this.v2.name;
    
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

        const change = this.changes.find(c => c.elementType === 'partida' && c.elementId === id);

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

  formatCurrency(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
