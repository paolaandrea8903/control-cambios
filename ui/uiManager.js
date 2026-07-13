class UIManager {
  /**
   * @param {RevisionManager} revisionManager Core revision manager instance
   * @param {ModuleRegistry} moduleRegistry Core module registry instance
   */
  constructor(revisionManager, moduleRegistry) {
    this.revisionManager = revisionManager;
    this.moduleRegistry = moduleRegistry;
    
    this.activeView = 'dashboard';
    
    // Instantiate all subcomponents
    this.components = {
      dashboard: new DashboardComponent(this),
      explorer: new ExplorerComponent(this),
      changelog: new ChangeLogComponent(this),
      detailsPanel: new DetailsPanelComponent(this),
      history: new VersionHistoryComponent(this),
      reports: new ReportsViewComponent(this),
      blueprints: new PdfViewerComponent(this)
    };

    this.setupViewNavigation();
    this.setupProjectNameSync();
    this.setupResetButton();
  }

  setupViewNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = item.getAttribute('data-view');
        this.showView(viewId);
      });
    });
  }

  showView(viewId) {
    this.activeView = viewId;

    // Toggle menu items highlights
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Toggle view visibility
    const views = document.querySelectorAll('.app-view');
    views.forEach(view => {
      if (view.id === `view-${viewId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update headers text
    const title = document.getElementById('view-title');
    const subtitle = document.getElementById('view-subtitle');

    switch (viewId) {
      case 'dashboard':
        title.textContent = 'Dashboard';
        subtitle.textContent = 'Resumen ejecutivo y variaciones del proyecto';
        break;
      case 'explorer':
        title.textContent = 'Explorador de Capítulos';
        subtitle.textContent = 'Navega por las partidas agrupadas jerárquicamente';
        break;
      case 'changelog':
        title.textContent = 'Registro de Cambios';
        subtitle.textContent = 'Listado detallado de todas las desviaciones detectadas';
        break;
      case 'history':
        title.textContent = 'Historial de Versiones';
        subtitle.textContent = 'Gestión de revisiones y subida de nuevos documentos';
        break;
      case 'reports':
        title.textContent = 'Informes de Revisión';
        subtitle.textContent = 'Generación de informes ejecutivos y exportación de datos';
        break;
      case 'blueprints':
        title.textContent = 'Comparador de Planos PDF';
        subtitle.textContent = 'Análisis técnico y comparación visual de planos de obra';
        break;
    }

    // Dynamic sidebar and header badges updates
    const sidebarBadge = document.querySelector('.sidebar-header .badge');
    if (sidebarBadge) {
      if (viewId === 'blueprints') {
        sidebarBadge.textContent = 'Módulo Planos v1.0';
        sidebarBadge.style.backgroundColor = 'var(--primary)';
      } else {
        sidebarBadge.textContent = 'Módulo Presupuestos v1.0';
        sidebarBadge.style.backgroundColor = '';
      }
    }
    this.updateHeaderBadges();

    // Refresh active view rendering
    this.refreshActiveView();
  }

  refreshActiveView() {
    const project = this.revisionManager.getCurrentProject();
    if (!project) return;

    const versions = project.getSortedVersions();
    if (versions.length === 0 && this.activeView !== 'blueprints' && this.activeView !== 'history') return;

    const v1 = versions[0] || null;
    const v2 = versions[versions.length - 1] || null;
    const changes = project.changes;

    // Render active component
    switch (this.activeView) {
      case 'dashboard':
        this.components.dashboard.render(project, v1, v2, changes);
        break;
      case 'explorer':
        this.components.explorer.render(project, v1, v2, changes);
        break;
      case 'changelog':
        this.components.changelog.render(project, v1, v2, changes);
        break;
      case 'history':
        this.components.history.render(project);
        break;
      case 'reports':
        this.components.reports.render(project, v1, v2, changes);
        break;
      case 'blueprints':
        this.components.blueprints.render(project, v1, v2, changes);
        break;
    }
  }

  showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
      if (show) {
        loader.classList.remove('hidden');
      } else {
        loader.classList.add('hidden');
      }
    }
  }

  setupProjectNameSync() {
    const headerProjectInput = document.getElementById('project-name-header-input');
    if (headerProjectInput) {
      headerProjectInput.addEventListener('input', (e) => {
        const newName = e.target.value;
        const currentProject = this.revisionManager.getCurrentProject();
        if (currentProject) {
          currentProject.name = newName;
          
          // Also sync the input in the upload form
          const formProjectInput = document.getElementById('project-name-input');
          if (formProjectInput) {
            formProjectInput.value = newName;
          }
          
          // Refresh the reports preview if active
          if (this.activeView === 'reports') {
            this.components.reports.renderPreview();
          }
        }
      });
    }
  }

  setupResetButton() {
    const btnReset = document.getElementById('btn-clear-analysis');
    if (btnReset) {
      btnReset.onclick = () => {
        if (this.activeView === 'blueprints') {
          if (confirm('¿Estás seguro de que deseas vaciar los planos actuales? Se limpiará el visor y los archivos cargados.')) {
            this.components.blueprints.clearAll();
          }
        } else {
          if (confirm('¿Estás seguro de que deseas iniciar un nuevo análisis de presupuesto? Se borrarán los datos actuales de la pantalla.')) {
            this.components.history.clearAll();
            this.showView('history');
          }
        }
      };
    }
  }

  updateHeaderBadges() {
    const srcBadge = document.getElementById('src-version-badge');
    const tgtBadge = document.getElementById('tgt-version-badge');
    if (!srcBadge || !tgtBadge) return;
    
    if (this.activeView === 'blueprints') {
      const bp = this.components.blueprints;
      srcBadge.textContent = bp.v1File ? bp.v1File.name : 'Plano V1 (No cargado)';
      tgtBadge.textContent = bp.v2File ? bp.v2File.name : 'Plano V2 (No cargado)';
    } else {
      const project = this.revisionManager.getCurrentProject();
      if (project) {
        const versions = project.getSortedVersions();
        if (versions.length > 0) {
          const v1 = versions[0];
          const v2 = versions[versions.length - 1];
          srcBadge.textContent = `${v1.name} (V1)`;
          tgtBadge.textContent = `${v2.name} (V${versions.length})`;
        } else {
          srcBadge.textContent = 'Presupuesto 1 (Original)';
          tgtBadge.textContent = 'Presupuesto 2 (Revisado)';
        }
      }
    }
  }
}
