class DetailsPanelComponent {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.setupListeners();
  }

  setupListeners() {
    const btnClose = document.getElementById('btn-close-details');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.close();
      });
    }

    // Close slideout on escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  open(change) {
    const slideout = document.getElementById('details-slideout');
    if (!slideout) return;

    // Set header details
    const title = document.getElementById('details-element-title');
    title.textContent = `${change.elementType === 'capitulo' ? 'Capítulo' : 'Partida'} ${change.elementId.includes('___') ? change.elementId.split('___')[1] : change.elementId}`;
    
    const badge = document.getElementById('details-change-type-badge');
    badge.textContent = change.changeType === 'added' ? 'Añadido' : change.changeType === 'deleted' ? 'Eliminado' : 'Modificado';
    badge.className = `badge ${change.changeType === 'added' ? 'badge-success-subtle' : change.changeType === 'deleted' ? 'badge-danger-subtle' : 'badge-warning-subtle'}`;

    // Get chapter name for contextual AI analysis
    let chapterName = '';
    const currentProject = this.uiManager.revisionManager.getCurrentProject();
    if (currentProject) {
      const activeVersion = currentProject.getVersion(change.targetVersion || change.sourceVersion);
      if (activeVersion && change.elementType === 'partida') {
        const chapCode = change.newValue ? change.newValue.parentId : change.oldValue ? change.oldValue.parentId : null;
        if (chapCode) {
          const chap = activeVersion.getElement('capitulo', chapCode);
          if (chap) {
            chapterName = chap.name;
          }
        }
      }
    }

    // Generate AI explanation dynamically if not pre-populated
    if (!change.aiExplanation) {
      const aiResult = AIEngine.analyzeChange(change, { chapterName });
      change.aiExplanation = aiResult.aiExplanation;
      change.impact = aiResult.impact;
      change.confidence = aiResult.confidence;
    }

    // Render properties side-by-side
    const oldV = change.oldValue || {};
    const newV = change.newValue || {};

    const elementDesc = newV.name || oldV.name || change.elementName;
    document.getElementById('details-slideout-content').querySelector('h4').insertAdjacentHTML('afterend', `
      <div id="details-elem-desc-header" style="font-size: 13.5px; font-weight: 600; margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.02); border-left: 2px solid var(--primary); border-radius: 0 4px 4px 0;">
        ${elementDesc}
      </div>
    `);

    // Remove old header desc if present
    const oldHeader = document.getElementById('details-elem-desc-header');
    if (oldHeader) oldHeader.remove();

    document.getElementById('prop-old-code').textContent = change.sourceVersion ? (change.elementId.includes('___') ? change.elementId.split('___')[1] : change.elementId) : '-';
    document.getElementById('prop-new-code').textContent = change.targetVersion ? (change.elementId.includes('___') ? change.elementId.split('___')[1] : change.elementId) : '-';

    document.getElementById('prop-old-unit').textContent = oldV.unit || '-';
    document.getElementById('prop-new-unit').textContent = newV.unit || '-';

    document.getElementById('prop-old-qty').textContent = oldV.qty_medicion !== undefined ? oldV.qty_medicion.toFixed(2) : '-';
    document.getElementById('prop-new-qty').textContent = newV.qty_medicion !== undefined ? newV.qty_medicion.toFixed(2) : '-';

    document.getElementById('prop-old-price').textContent = oldV.price !== undefined ? this.formatCurrency(oldV.price) : '-';
    document.getElementById('prop-new-price').textContent = newV.price !== undefined ? this.formatCurrency(newV.price) : '-';

    document.getElementById('prop-old-total').textContent = oldV.total !== undefined ? this.formatCurrency(oldV.total) : '-';
    document.getElementById('prop-new-total').textContent = newV.total !== undefined ? this.formatCurrency(newV.total) : '-';

    // Economic Variance Strip
    const varianceVal = document.getElementById('details-net-variance-val');
    const varianceStrip = document.getElementById('details-net-variance-strip');
    const netDev = change.impact.economic;
    
    varianceVal.textContent = `${netDev >= 0 ? '+' : ''}${this.formatCurrency(netDev)}`;
    if (netDev > 0.01) {
      varianceVal.className = 'variance-val cost';
      varianceStrip.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      varianceStrip.style.backgroundColor = 'rgba(239, 68, 68, 0.02)';
    } else if (netDev < -0.01) {
      varianceVal.className = 'variance-val saving';
      varianceStrip.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      varianceStrip.style.backgroundColor = 'rgba(16, 185, 129, 0.02)';
    } else {
      varianceVal.className = 'variance-val none';
      varianceStrip.style.borderColor = 'var(--border-color)';
      varianceStrip.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
    }

    // Description Diff
    const descSection = document.getElementById('desc-diff-section');
    if (change.fieldName.includes('name') && oldV.name && newV.name) {
      descSection.classList.remove('hidden');
      document.getElementById('desc-old-text').innerHTML = `<b>Anterior:</b> ${oldV.name}`;
      document.getElementById('desc-new-text').innerHTML = `<b>Nuevo:</b> ${newV.name}`;
    } else {
      descSection.classList.add('hidden');
    }

    // AI bubble
    document.getElementById('details-ai-explanation').innerHTML = change.aiExplanation;

    // Multi dimensional impacts
    this.renderImpact('tech', change.impact.technical, 'warning');
    this.renderImpact('schedule', change.impact.schedule, 'neutral');
    this.renderImpact('contractual', change.impact.contractual, 'warning');
    this.renderImpact('purchases', change.impact.purchases, 'neutral');

    // Open slideout panel
    slideout.classList.add('open');
  }

  renderImpact(typeId, contentText, defaultState = 'neutral') {
    const descEl = document.getElementById(`impact-${typeId}-desc`);
    const badgeEl = document.getElementById(`impact-${typeId}-badge`);
    
    descEl.textContent = contentText;

    // Dynamically color badges based on text content
    let state = defaultState;
    if (contentText.includes('Ahorro') || contentText.includes('Acelerado') || contentText.includes('Mech') || contentText.includes('favorable')) {
      state = 'saving';
      badgeEl.textContent = 'Favorable / Ahorro';
    } else if (contentText.includes('Retraso') || contentText.includes('sobrecoste') || contentText.includes('Crítico') || contentText.includes('contradictorio')) {
      state = 'cost';
      badgeEl.textContent = 'Riesgo / Coste';
    } else if (contentText.includes('Revisión') || contentText.includes('Negociar') || contentText.includes('Ajustar')) {
      state = 'warning';
      badgeEl.textContent = 'Atención / Compras';
    } else {
      state = 'neutral';
      badgeEl.textContent = 'Estable / Neutro';
    }

    badgeEl.className = `metric-status ${state}`;
  }

  close() {
    const slideout = document.getElementById('details-slideout');
    if (slideout) {
      slideout.classList.remove('open');
    }
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
