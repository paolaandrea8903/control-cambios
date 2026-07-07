// Global variables
let revisionManager;
let uiManager;

/**
 * Loads Excel files using fetch and SheetJS. Fallbacks to preloaded data if fetch fails.
 * @param {string} url File URL to fetch
 * @returns {Promise<Array[]>} 2D row array
 */
async function loadExcelFile(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  } catch (err) {
    console.warn(`Could not fetch or parse ${url} directly: ${err.message}. Falling back to preloaded sample data.`);
    return null;
  }
}

/**
 * Initializes and bootstraps the application.
 */
async function initApp() {
  // 1. Core Manager and Registry setup
  revisionManager = new RevisionManager();
  
  // Register Presto module
  const prestoModule = new PrestoModule();
  moduleRegistry.registerModule(prestoModule);

  // 2. Create clean empty Project
  const project = revisionManager.createProject('p01', 'Nuevo Proyecto');

  // 3. Setup UI
  uiManager = new UIManager(revisionManager, moduleRegistry);
  
  // Expose on window for debugging/subcomponents integration
  window.uiManager = uiManager;
  window.revisionManager = revisionManager;
  window.moduleRegistry = moduleRegistry;

  // Set default empty project names in the DOM
  const headerProjectInput = document.getElementById('project-name-header-input');
  if (headerProjectInput) headerProjectInput.value = 'Nuevo Proyecto';
  const formProjectInput = document.getElementById('project-name-input');
  if (formProjectInput) formProjectInput.value = 'Nuevo Proyecto';

  // Render initial upload (history) view on boot
  uiManager.showView('history');
  uiManager.components.history.render(project);
}

// Bootstrap app on DOM content loaded
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
