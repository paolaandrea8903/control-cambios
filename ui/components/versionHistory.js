/**
 * Version History and Dual Upload Component.
 * Supports uploading V1 and V2 budgets simultaneously, in-browser parsing, and reset.
 */
class VersionHistoryComponent {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.fileDataV1 = null;
    this.fileNameV1 = '';
    this.fileDataV2 = null;
    this.fileNameV2 = '';
    this.setupListeners();
  }

  setupListeners() {
    // Top bar reset button
    const btnReset = document.getElementById('btn-clear-analysis');
    if (btnReset) {
      btnReset.onclick = () => {
        if (confirm('¿Estás seguro de que deseas iniciar un nuevo análisis? Se borrarán los datos actuales de la pantalla.')) {
          this.clearAll();
          this.uiManager.showView('history');
        }
      };
    }

    // Bind V1 upload slot
    this.bindUploadSlot('v1');

    // Bind V2 upload slot
    this.bindUploadSlot('v2');

    // Form submit
    const form = document.getElementById('upload-dual-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      };
    }

    // Demo load button listener
    const btnDemo = document.getElementById('btn-load-demo');
    if (btnDemo) {
      btnDemo.onclick = async () => {
        this.uiManager.showLoader(true);
        try {
          const prestoMod = this.uiManager.moduleRegistry.getModule('presto-budget');
          if (!prestoMod) throw new Error("El módulo presto-budget no está registrado.");

          const project = this.uiManager.revisionManager.createProject('p01', 'Proyecto Demo de Edificación');

          const v1Raw = budgetVersion1Raw;
          const v2Raw = budgetVersion2Raw;

          const v1 = new Version('v1', 'Presupuesto Inicial (V1)', '2026-07-06', 'Departamento de Estudios', 'Presupuesto original de base.');
          const parsedElementsV1 = prestoMod.parse(v1Raw);
          parsedElementsV1.forEach(el => v1.addElement(el));

          const v2 = new Version('v2', 'Presupuesto Ajustado (V2)', '2026-07-07', 'Departamento de Estudios', 'Revisión técnica de cantidades e inclusión de encofrados adicionales.');
          const parsedElementsV2 = prestoMod.parse(v2Raw);
          parsedElementsV2.forEach(el => v2.addElement(el));

          project.addVersion(v1);
          project.addVersion(v2);

          const changes = ChangeEngine.compare(v1, v2, 'Departamento de Estudios');
          project.changes = changes;

          document.getElementById('project-name-header-input').value = project.name;
          document.getElementById('project-name-input').value = project.name;
          document.getElementById('src-version-badge').textContent = `${v1.name} (V1)`;
          document.getElementById('tgt-version-badge').textContent = `${v2.name} (V2)`;

          this.uiManager.refreshActiveView();
          this.uiManager.showView('dashboard');
        } catch (err) {
          console.error(err);
          alert(`Error al cargar los datos demo: ${err.message}`);
        } finally {
          this.uiManager.showLoader(false);
        }
      };
    }
  }

  bindUploadSlot(id) {
    const zone = document.getElementById(`drag-drop-zone-${id}`);
    const input = document.getElementById(`file-input-${id}`);
    const btnRemove = document.getElementById(`btn-remove-file-${id}`);

    if (zone && input) {
      zone.onclick = () => input.click();
      
      input.onchange = (e) => {
        if (e.target.files.length > 0) {
          this.handleFileSelected(id, e.target.files[0]);
        }
      };

      zone.ondragover = (e) => {
        e.preventDefault();
        zone.classList.add('drag-active');
      };

      ['dragleave', 'dragend', 'drop'].forEach(evt => {
        zone.addEventListener(evt, () => {
          zone.classList.remove('drag-active');
        });
      });

      zone.ondrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
          this.handleFileSelected(id, e.dataTransfer.files[0]);
        }
      };
    }

    if (btnRemove) {
      btnRemove.onclick = () => {
        this.clearFileSelection(id);
      };
    }
  }

  handleFileSelected(id, file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (id === 'v1') {
        this.fileDataV1 = e.target.result;
        this.fileNameV1 = file.name;
      } else {
        this.fileDataV2 = e.target.result;
        this.fileNameV2 = file.name;
      }
      
      // Update UI
      document.getElementById(`drag-drop-zone-${id}`).classList.add('hidden');
      document.getElementById(`file-name-display-${id}`).classList.remove('hidden');
      document.getElementById(`uploaded-file-name-${id}`).textContent = file.name;
    };
    reader.readAsArrayBuffer(file);
  }

  clearFileSelection(id) {
    if (id === 'v1') {
      this.fileDataV1 = null;
      this.fileNameV1 = '';
    } else {
      this.fileDataV2 = null;
      this.fileNameV2 = '';
    }
    
    document.getElementById(`file-input-${id}`).value = '';
    document.getElementById(`drag-drop-zone-${id}`).classList.remove('hidden');
    document.getElementById(`file-name-display-${id}`).classList.add('hidden');
  }

  clearAll() {
    this.clearFileSelection('v1');
    this.clearFileSelection('v2');
  }

  async handleFormSubmit() {
    if (!this.fileDataV1 || !this.fileDataV2) {
      alert("Por favor, sube los archivos de presupuesto de V1 (Origen) y V2 (Destino) para continuar.");
      return;
    }

    const projectName = document.getElementById('project-name-input').value;
    const authorName = document.getElementById('author-name-input').value;

    this.uiManager.showLoader(true);

    setTimeout(async () => {
      try {
        // Get module
        const prestoMod = this.uiManager.moduleRegistry.getModule('presto-budget');
        if (!prestoMod) throw new Error("El módulo presto-budget no está registrado.");

        // 1. Re-initialize project data in Revision Manager
        const project = this.uiManager.revisionManager.createProject('p01', projectName);

        // 2. Parse V1
        const v1 = new Version('v1', 'Presupuesto Base (Original)', new Date().toISOString().split('T')[0], authorName, 'Presupuesto inicial de comparación.');
        let elV1;
        if (this.fileNameV1.toLowerCase().endsWith('.bc3')) {
          const decoder = new TextDecoder('windows-1252');
          const textV1 = decoder.decode(this.fileDataV1);
          elV1 = prestoMod.parseBC3(textV1);
        } else {
          const dataV1 = new Uint8Array(this.fileDataV1);
          const wb1 = XLSX.read(dataV1, { type: 'array' });
          const rowsV1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });
          elV1 = prestoMod.parse(rowsV1);
        }
        elV1.forEach(el => v1.addElement(el));

        // 3. Parse V2
        const v2 = new Version('v2', 'Presupuesto Revisado', new Date().toISOString().split('T')[0], authorName, 'Revisión cargada por el usuario.');
        let elV2;
        if (this.fileNameV2.toLowerCase().endsWith('.bc3')) {
          const decoder = new TextDecoder('windows-1252');
          const textV2 = decoder.decode(this.fileDataV2);
          elV2 = prestoMod.parseBC3(textV2);
        } else {
          const dataV2 = new Uint8Array(this.fileDataV2);
          const wb2 = XLSX.read(dataV2, { type: 'array' });
          const rowsV2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 });
          elV2 = prestoMod.parse(rowsV2);
        }
        elV2.forEach(el => v2.addElement(el));

        // 4. Add to project
        project.addVersion(v1);
        project.addVersion(v2);

        // 5. Compare V1 and V2
        const changes = ChangeEngine.compare(v1, v2, authorName);
        project.changes = changes;

        // 6. Update selector header text
        document.getElementById('project-name-header-input').value = projectName;
        document.getElementById('src-version-badge').textContent = `${v1.name} (V1)`;
        document.getElementById('tgt-version-badge').textContent = `${v2.name} (V2)`;

        // Refresh UI Views
        this.uiManager.refreshActiveView();
        
        alert(`¡Análisis completado! Se han detectado ${changes.length} cambios entre presupuestos.`);
        
        // Go to dashboard
        this.uiManager.showView('dashboard');

      } catch (err) {
        console.error(err);
        alert(`Error al procesar los archivos Excel: ${err.message}`);
      } finally {
        this.uiManager.showLoader(false);
      }
    }, 200);
  }

  // Not used in this layout anymore since timeline was removed
  render(project) {}
}
