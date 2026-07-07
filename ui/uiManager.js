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
      reports: new ReportsViewComponent(this)
    };

    this.setupViewNavigation();
    this.setupProjectNameSync();
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
    }

    // Refresh active view rendering
    this.refreshActiveView();
  }

  refreshActiveView() {
    const project = this.revisionManager.getCurrentProject();
    if (!project) return;

    const versions = project.getSortedVersions();
    if (versions.length === 0) return;

    const v1 = versions[0];
    const v2 = versions[versions.length - 1]; // latest version
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
}
