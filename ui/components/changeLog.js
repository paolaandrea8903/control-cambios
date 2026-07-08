/**
 * Change Log View Component.
 * Displays all detected changes with filtering, searching, and pagination support.
 */
class ChangeLogComponent {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.filters = {
      search: '',
      type: 'all',
      elementType: 'all',
      impact: 'all'
    };
    this.setupListeners();
  }

  setupListeners() {
    const searchInput = document.getElementById('search-changes');
    const filterType = document.getElementById('filter-type');
    const filterElementType = document.getElementById('filter-element-type');
    const filterImpact = document.getElementById('filter-impact');
    const btnClear = document.getElementById('btn-clear-filters');
    const linkAllDashboard = document.getElementById('link-view-all-changelog');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.applyFilters();
      });
    }

    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.filters.type = e.target.value;
        this.applyFilters();
      });
    }

    if (filterElementType) {
      filterElementType.addEventListener('change', (e) => {
        this.filters.elementType = e.target.value;
        this.applyFilters();
      });
    }

    if (filterImpact) {
      filterImpact.addEventListener('change', (e) => {
        this.filters.impact = e.target.value;
        this.applyFilters();
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearFilters();
      });
    }

    if (linkAllDashboard) {
      linkAllDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        this.uiManager.showView('changelog');
      });
    }
  }

  clearFilters() {
    this.filters = {
      search: '',
      type: 'all',
      elementType: 'all',
      impact: 'all'
    };

    document.getElementById('search-changes').value = '';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-element-type').value = 'all';
    document.getElementById('filter-impact').value = 'all';

    this.applyFilters();
  }

  render(project, v1, v2, changes) {
    this.project = project;
    this.v1 = v1;
    this.v2 = v2;
    this.changes = changes;

    this.applyFilters();
  }

  applyFilters() {
    if (!this.changes) return;

    let filtered = [...this.changes];

    // Filter by text search
    if (this.filters.search) {
      const q = this.filters.search.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.elementId.toLowerCase().includes(q) || 
        c.elementName.toLowerCase().includes(q) ||
        (c.aiExplanation && c.aiExplanation.toLowerCase().includes(q))
      );
    }

    // Filter by change type
    if (this.filters.type !== 'all') {
      if (this.filters.type === 'scope') {
        filtered = filtered.filter(c => c.changeType === 'modified' && c.fieldName.includes('name'));
      } else {
        filtered = filtered.filter(c => c.changeType === this.filters.type);
      }
    }

    // Filter by element type
    if (this.filters.elementType !== 'all') {
      filtered = filtered.filter(c => c.elementType === this.filters.elementType);
    }

    // Filter by economic impact
    if (this.filters.impact !== 'all') {
      if (this.filters.impact === 'cost') {
        filtered = filtered.filter(c => c.impact.economic > 0.01);
      } else if (this.filters.impact === 'saving') {
        filtered = filtered.filter(c => c.impact.economic < -0.01);
      } else if (this.filters.impact === 'none') {
        filtered = filtered.filter(c => Math.abs(c.impact.economic) <= 0.01);
      }
    }

    this.renderTableRows(filtered);
  }

  renderTableRows(filteredChanges) {
    const tbody = document.getElementById('changelog-table-body');
    const showingCount = document.getElementById('changes-showing-count');
    
    tbody.innerHTML = '';
    showingCount.textContent = `Mostrando ${filteredChanges.length} de ${this.changes.length} cambios`;

    if (filteredChanges.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-5"><i class="fa-solid fa-filter-circle-xmark d-block mb-3 fs-2"></i>No hay cambios que coincidan con los filtros aplicados.</td></tr>`;
      return;
    }

    // Sort by elementId
    filteredChanges.sort((a, b) => {
      // Custom sort: put chapters first, then items sorted by ID
      if (a.elementType !== b.elementType) {
        return a.elementType === 'capitulo' ? -1 : 1;
      }
      return a.elementId.localeCompare(b.elementId);
    });

    filteredChanges.forEach(chg => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      
      const typeBadge = chg.changeType === 'added' 
        ? '<span class="badge badge-success-subtle">Añadido</span>'
        : chg.changeType === 'deleted'
          ? '<span class="badge badge-danger-subtle">Eliminado</span>'
          : '<span class="badge badge-warning-subtle">Modificado</span>';
          
      const econVal = chg.impact.economic;
      const econClass = econVal > 0 ? 'text-danger' : econVal < 0 ? 'text-success' : 'text-muted';
      const econText = `${econVal >= 0 ? '+' : ''}${this.formatCurrency(econVal)}`;

      // Describe modifications
      let modDescription = '-';
      if (chg.changeType === 'added') {
        modDescription = `Alta de ${chg.elementType === 'capitulo' ? 'capítulo' : 'partida'} en el proyecto.`;
      } else if (chg.changeType === 'deleted') {
        modDescription = `Baja de ${chg.elementType === 'capitulo' ? 'capítulo' : 'partida'} en el proyecto.`;
      } else {
        const fields = chg.fieldName.map(f => {
          if (f === 'qty_medicion') return 'cantidad';
          if (f === 'price') return 'precio';
          if (f === 'description' || f === 'name') return 'resumen corto';
          if (f === 'longDesc') return 'texto largo (pliego)';
          return f;
        });
        modDescription = `Cambio en: <b>${fields.join(', ')}</b>`;
      }

      // Schedule impact icon
      let schedText = '<i class="fa-solid fa-minus text-muted"></i> Neutro';
      if (chg.impact.schedule.includes('retraso') || chg.impact.schedule.includes('Riesgo')) {
        schedText = `<i class="fa-solid fa-triangle-exclamation text-danger"></i> <span class="text-danger">${chg.impact.schedule}</span>`;
      } else if (chg.impact.schedule.includes('Acelerado') || chg.impact.schedule.includes('Ahorro')) {
        schedText = `<i class="fa-solid fa-bolt text-success"></i> <span class="text-success">${chg.impact.schedule}</span>`;
      }

      let cellNameContent = chg.elementName;
      if (chg.changeType === 'modified' && (chg.fieldName.includes('name') || chg.fieldName.includes('longDesc'))) {
        let nameDiff = '';
        if (chg.fieldName.includes('name')) {
          nameDiff = `
            <div style="margin-bottom: 4px;">
              <strong>Resumen Corto:</strong><br>
              <span style="color: #ef4444; text-decoration: line-through;">V1: ${chg.oldValue.name}</span><br>
              <span style="color: #10b981; font-weight: 600;">V2: ${chg.newValue.name}</span>
            </div>
          `;
        }
        
        let longDescDiff = '';
        if (chg.fieldName.includes('longDesc')) {
          longDescDiff = `
            <div>
              <strong>Texto Largo / Pliego:</strong><br>
              <span style="color: #ef4444; text-decoration: line-through; display: block; max-height: 50px; overflow: hidden; text-overflow: ellipsis;">V1: ${chg.oldValue.longDesc || '(Vacío)'}</span>
              <span style="color: #10b981; display: block; font-weight: 600; max-height: 50px; overflow: hidden; text-overflow: ellipsis;">V2: ${chg.newValue.longDesc || '(Vacío)'}</span>
            </div>
          `;
        }

        cellNameContent = `
          <div>${chg.elementName}</div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 5px; padding: 6px 8px; background-color: var(--body-bg); border-radius: 4px; border-left: 3px solid var(--primary); text-decoration: none !important; font-weight: normal; line-height: 1.3;">
            ${nameDiff}
            ${longDescDiff}
          </div>
        `;
      }

      tr.innerHTML = `
        <td class="font-monospace text-muted" style="font-size: 11px;">${chg.id}</td>
        <td>${typeBadge}</td>
        <td class="node-code">${chg.elementId}</td>
        <td style="max-width: 250px; font-weight: 500;">${cellNameContent}</td>
        <td>${modDescription}</td>
        <td class="${econClass} font-monospace fw-bold text-end">${econText}</td>
        <td>${schedText}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline btn-view-slide">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.uiManager.components.detailsPanel.open(chg);
      });

      tbody.appendChild(tr);
    });
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
