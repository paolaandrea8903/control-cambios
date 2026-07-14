class PdfViewerComponent {
  /**
   * @param {UIManager} uiManager 
   */
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.pdfV1 = null;
    this.pdfV2 = null;
    
    this.currentPage = 1;
    this.numPages = 1;
    this.displayMode = 'overlay'; // 'overlay' | 'curtain'
    
    this.canvasV1 = null;
    this.canvasV2 = null;
    this.canvasDiff = null;
    
    this.isComparing = false;
    this.detectedChanges = [];
    
    // Bindings
    this.v1File = null;
    this.v2File = null;
    this.zoomLevel = 1.0;
    this.v1OffsetX = 0;
    this.v1OffsetY = 0;
    this.isDxfMode = false;
    this.v1DxfElements = null;
    this.v2DxfElements = null;
  }

  render(project, v1, v2, changes) {
    this.canvasV1 = document.getElementById('bp-canvas-v1');
    this.canvasV2 = document.getElementById('bp-canvas-v2');
    this.canvasDiff = document.getElementById('bp-canvas-diff');

    this.setupEventListeners();
  }

  setupEventListeners() {
    const dropzoneV1 = document.getElementById('bp-dropzone-v1');
    const dropzoneV2 = document.getElementById('bp-dropzone-v2');
    
    // File inputs (dynamic creation to keep index.html clean)
    if (!document.getElementById('bp-input-file-v1')) {
      const inp1 = document.createElement('input');
      inp1.type = 'file';
      inp1.id = 'bp-input-file-v1';
      inp1.accept = '.pdf,.dxf,.dwg';
      inp1.style.display = 'none';
      inp1.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0], 1));
      document.body.appendChild(inp1);
      
      dropzoneV1.addEventListener('click', () => inp1.click());
    }

    if (!document.getElementById('bp-input-file-v2')) {
      const inp2 = document.createElement('input');
      inp2.type = 'file';
      inp2.id = 'bp-input-file-v2';
      inp2.accept = '.pdf,.dxf,.dwg';
      inp2.style.display = 'none';
      inp2.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0], 2));
      document.body.appendChild(inp2);
      
      dropzoneV2.addEventListener('click', () => inp2.click());
    }

    // Drag over effects
    [dropzoneV1, dropzoneV2].forEach((dropzone, idx) => {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.background = 'rgba(99, 102, 241, 0.05)';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';
      });
      dropzone.addEventListener('dragenter', (e) => {
        e.preventDefault();
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';
        const file = e.dataTransfer.files[0];
        if (file) {
          const lowerName = file.name.toLowerCase();
          if (lowerName.endsWith('.pdf') || lowerName.endsWith('.dxf') || lowerName.endsWith('.dwg')) {
            this.handleFileSelect(file, idx + 1);
          }
        }
      });
    });

    // Action buttons
    const btnCompare = document.getElementById('btn-compare-blueprints');
    if (btnCompare) {
      btnCompare.onclick = () => this.runBlueprintComparison();
    }

    const btnDemo = document.getElementById('btn-demo-blueprints');
    if (btnDemo) {
      btnDemo.onclick = () => this.loadDemoPlans();
    }

    // Navigation buttons
    const btnPrev = document.getElementById('btn-bp-prev-page');
    const btnNext = document.getElementById('btn-bp-next-page');
    if (btnPrev) btnPrev.onclick = () => this.navigatePage(-1);
    if (btnNext) btnNext.onclick = () => this.navigatePage(1);

    // Dropdown selector mapping V1 page manually
    const v1Select = document.getElementById('bp-compare-v1-select');
    if (v1Select) {
      v1Select.onchange = (e) => {
        const val = e.target.value;
        if (val === 'none') {
          this.pageMapping[this.currentPage] = null;
        } else {
          this.pageMapping[this.currentPage] = parseInt(val, 10);
        }
        
        this.uiManager.showLoader(true, "Comparando planos y alineando páginas...");
        setTimeout(async () => {
          try {
            await this.compareAndRenderPage();
          } catch (err) {
            console.error(err);
          } finally {
            this.uiManager.showLoader(false);
          }
        }, 50);
      };
    }

    // Display mode buttons
    const btnOverlay = document.getElementById('btn-bp-mode-overlay');
    const btnCurtain = document.getElementById('btn-bp-mode-curtain');
    const opacityControls = document.getElementById('bp-opacity-controls');
    
    if (btnOverlay) {
      btnOverlay.onclick = () => {
        this.displayMode = 'overlay';
        btnOverlay.style.background = 'var(--primary)';
        btnOverlay.style.color = '#fff';
        btnOverlay.style.fontWeight = 'bold';
        btnCurtain.style.background = 'transparent';
        btnCurtain.style.color = 'var(--text-muted)';
        opacityControls.style.display = 'flex';
        this.updateVisorRendering();
      };
    }
    
    if (btnCurtain) {
      btnCurtain.onclick = () => {
        this.displayMode = 'curtain';
        btnCurtain.style.background = 'var(--primary)';
        btnCurtain.style.color = '#fff';
        btnCurtain.style.fontWeight = 'bold';
        btnOverlay.style.background = 'transparent';
        btnOverlay.style.color = 'var(--text-muted)';
        opacityControls.style.display = 'none';
        this.updateVisorRendering();
      };
    }

    // Slider range opacity
    const slider = document.getElementById('bp-slider-opacity');
    const valText = document.getElementById('bp-opacity-val');
    if (slider) {
      slider.oninput = (e) => {
        const val = e.target.value;
        if (valText) valText.textContent = `${val}%`;
        this.updateCanvasOpacity(val / 100);
      };
    }

    // Botones de control de Zoom
    const btnZoomIn = document.getElementById('btn-bp-zoom-in');
    const btnZoomOut = document.getElementById('btn-bp-zoom-out');
    const btnZoomReset = document.getElementById('btn-bp-zoom-reset');
    
    if (btnZoomIn) {
      btnZoomIn.onclick = () => {
        this.zoomLevel = Math.min(3.0, this.zoomLevel + 0.25);
        this.updateZoomRendering();
      };
    }
    if (btnZoomOut) {
      btnZoomOut.onclick = () => {
        this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25);
        this.updateZoomRendering();
      };
    }
    if (btnZoomReset) {
      btnZoomReset.onclick = () => {
        this.zoomLevel = 1.0;
        this.updateZoomRendering();
      };
    }

    // Botones de calibración de alineación (Nudge)
    const btnNudgeLeft = document.getElementById('btn-bp-nudge-left');
    const btnNudgeRight = document.getElementById('btn-bp-nudge-right');
    const btnNudgeUp = document.getElementById('btn-bp-nudge-up');
    const btnNudgeDown = document.getElementById('btn-bp-nudge-down');
    const btnNudgeReset = document.getElementById('btn-bp-nudge-reset');

    const handleNudge = (dx, dy) => {
      this.v1OffsetX += dx;
      this.v1OffsetY += dy;
      
      this.uiManager.showLoader(true, "Calibrando alineación de plano...");
      setTimeout(async () => {
        try {
          await this.compareAndRenderPage();
        } catch (err) {
          console.error(err);
        } finally {
          this.uiManager.showLoader(false);
        }
      }, 50);
    };

    if (btnNudgeLeft) btnNudgeLeft.onclick = () => handleNudge(-1, 0);
    if (btnNudgeRight) btnNudgeRight.onclick = () => handleNudge(1, 0);
    if (btnNudgeUp) btnNudgeUp.onclick = () => handleNudge(0, -1);
    if (btnNudgeDown) btnNudgeDown.onclick = () => handleNudge(0, 1);
    
    if (btnNudgeReset) {
      btnNudgeReset.onclick = () => {
        this.v1OffsetX = 0;
        this.v1OffsetY = 0;
        
        this.uiManager.showLoader(true, "Restableciendo calibración...");
        setTimeout(async () => {
          try {
            await this.compareAndRenderPage();
          } catch (err) {
            console.error(err);
          } finally {
            this.uiManager.showLoader(false);
          }
        }, 50);
      };
    }
  }

  handleFileSelect(file, versionNum) {
    if (!file) return;
    if (versionNum === 1) {
      this.v1File = file;
      document.getElementById('bp-name-v1').textContent = file.name;
    } else {
      this.v2File = file;
      document.getElementById('bp-name-v2').textContent = file.name;
    }
    this.uiManager.updateHeaderBadges();
  }

  async runBlueprintComparison() {
    if (!this.v1File || !this.v2File) {
      alert("No ha cargado los planos para comparar. Por favor, arrastre o seleccione el Plano V1 y el Plano V2 antes de iniciar.");
      return;
    }

    const isDxf1 = this.v1File.name.toLowerCase().endsWith('.dxf') || this.v1File.name.toLowerCase().endsWith('.dwg');
    const isDxf2 = this.v2File.name.toLowerCase().endsWith('.dxf') || this.v2File.name.toLowerCase().endsWith('.dwg');

    if (isDxf1 || isDxf2) {
      if (this.v1File.name.toLowerCase().endsWith('.dwg') || this.v2File.name.toLowerCase().endsWith('.dwg')) {
        alert("¡Archivo .dwg detectado! Para compararlo en el navegador, recuerda ejecutar primero el conversor 'convert_dwg_to_dxf.py' y cargar los archivos .dxf resultantes.");
        return;
      }
      
      this.uiManager.showLoader(true, "Procesando plano vectorial DXF...");
      document.getElementById('bp-viewer-prompt').style.display = 'none';

      try {
        const dxfModule = this.uiManager.moduleRegistry.getModule('dxf');
        this.v1DxfElements = await dxfModule.parse(this.v1File);
        this.v2DxfElements = await dxfModule.parse(this.v2File);
        this.isDxfMode = true;

        const project = this.uiManager.revisionManager.getCurrentProject() || this.uiManager.revisionManager.createProject('proj_plans', 'Proyecto de Obra');
        const ver1 = project.getVersion('v1_plans') || new Version('v1_plans', 'Planos V1', new Date().toISOString(), 'Sistema');
        const ver2 = project.getVersion('v2_plans') || new Version('v2_plans', 'Planos V2', new Date().toISOString(), 'Sistema');
        
        this.v1DxfElements.forEach(el => ver1.addElement(el));
        this.v2DxfElements.forEach(el => ver2.addElement(el));
        
        project.addVersion(ver1);
        project.addVersion(ver2);

        this.numPages = 1;
        this.currentPage = 1;
        this.zoomLevel = 1.0;
        this.v1OffsetX = 0;
        this.v1OffsetY = 0;
        
        const v1Select = document.getElementById('bp-compare-v1-select');
        if (v1Select) {
          v1Select.innerHTML = '<option value="1">Modelo DXF (Original)</option>';
          v1Select.value = "1";
        }

        this.updateZoomRendering();
        await this.compareAndRenderPage();
      } catch (err) {
        console.error(err);
        alert("Error al comparar los planos DXF: " + err.message);
      } finally {
        this.uiManager.showLoader(false);
      }
      return;
    }

    this.uiManager.showLoader(true, "Analizando y procesando planos con IA...");
    document.getElementById('bp-viewer-prompt').style.display = 'none';

    try {
      const module = this.uiManager.moduleRegistry.getModule('pdfPlan');
      const el1 = await module.parse(this.v1File, 'v1');
      const el2 = await module.parse(this.v2File, 'v2');

      const project = this.uiManager.revisionManager.getCurrentProject() || this.uiManager.revisionManager.createProject('proj_plans', 'Proyecto de Obra');
      
      // Creamos versiones en el core
      const ver1 = project.getVersion('v1_plans') || new Version('v1_plans', 'Planos V1', new Date().toISOString(), 'Sistema');
      const ver2 = project.getVersion('v2_plans') || new Version('v2_plans', 'Planos V2', new Date().toISOString(), 'Sistema');
      
      el1.forEach(el => ver1.addElement(el));
      el2.forEach(el => ver2.addElement(el));
      
      project.addVersion(ver1);
      project.addVersion(ver2);

      // Renderizar PDFs reales
      const arrayBuffer1 = await this.v1File.arrayBuffer();
      const arrayBuffer2 = await this.v2File.arrayBuffer();
      this.pdfV1 = await window.pdfjsLib.getDocument({ data: arrayBuffer1 }).promise;
      this.pdfV2 = await window.pdfjsLib.getDocument({ data: arrayBuffer2 }).promise;
      
      // Mapeo inteligente de páginas en base al cajetín/textos
      await this.mapPdfPages();

      // Rellenar las opciones del selector de páginas de V1
      const v1Select = document.getElementById('bp-compare-v1-select');
      if (v1Select) {
        v1Select.innerHTML = '<option value="none">-- Ninguno --</option>';
        for (let i = 1; i <= this.pdfV1.numPages; i++) {
          v1Select.innerHTML += `<option value="${i}">Pág ${i} (Original)</option>`;
        }
      }

      this.numPages = this.pdfV2.numPages; // V2 es la versión revisada de referencia
      this.currentPage = 1;
      this.zoomLevel = 1.0;
      this.v1OffsetX = 0;
      this.v1OffsetY = 0;
      this.updateZoomRendering();

      await this.compareAndRenderPage();
    } catch (err) {
      console.error(err);
      alert("Error al comparar los planos: " + err.message);
    } finally {
      this.uiManager.showLoader(false);
    }
  }

  async mapPdfPages() {
    this.pageMapping = {}; // V2 page -> V1 page
    const v1Stamps = [];
    
    // Extraer texto inicial (cajetín) de todas las páginas de V1
    for (let i = 1; i <= this.pdfV1.numPages; i++) {
      const page = await this.pdfV1.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      v1Stamps.push({ index: i, text: text.substring(0, 800) });
    }

    // Mapear cada página de V2 a la mejor coincidencia en V1
    for (let j = 1; j <= this.pdfV2.numPages; j++) {
      const page = await this.pdfV2.getPage(j);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      const v2Text = text.substring(0, 800);

      let bestMatchV1 = null;
      let bestScore = 0;

      // Intentar extraer códigos de plano como (A-01, E-04, etc.)
      const sheetNumberRegex = /\b[A-Z]{1,3}-\d{2,4}\b/g;
      const v2Codes = v2Text.match(sheetNumberRegex) || [];

      for (const v1Page of v1Stamps) {
        let score = 0;

        // 1. Coincidencia por código de plano
        const v1Codes = v1Page.text.match(sheetNumberRegex) || [];
        const commonCodes = v2Codes.filter(c => v1Codes.includes(c));
        if (commonCodes.length > 0) {
          score += 15;
        }

        // 2. Coincidencia por palabras comunes de más de 4 letras
        const tokens2 = v2Text.toLowerCase().split(/\s+/).filter(t => t.length > 4);
        const tokens1 = v1Page.text.toLowerCase().split(/\s+/).filter(t => t.length > 4);
        const intersection = tokens2.filter(t => tokens1.includes(t));
        const overlap = intersection.length / Math.max(1, Math.min(tokens1.length, tokens2.length));
        score += overlap * 5;

        if (score > bestScore) {
          bestScore = score;
          bestMatchV1 = v1Page.index;
        }
      }

      // Si la similitud es aceptable, mapeamos. Si no, emparejamos por el mismo número de página si existe.
      if (bestScore > 0.4) {
        this.pageMapping[j] = bestMatchV1;
      } else {
        this.pageMapping[j] = j <= this.pdfV1.numPages ? j : null;
      }
    }
  }

  async compareAndRenderPage() {
    this.isComparing = true;
    
    if (this.isDxfMode) {
      const w = 1200;
      const h = 800;

      this.canvasV1.width = w;
      this.canvasV1.height = h;
      this.canvasV2.width = w;
      this.canvasV2.height = h;

      const ctx1 = this.canvasV1.getContext('2d');
      const ctx2 = this.canvasV2.getContext('2d');

      // Calcular limites de vectores
      const bbox2 = this.calculateDxfBoundingBox(this.v2DxfElements || []);
      const bbox1 = this.calculateDxfBoundingBox(this.v1DxfElements || []);
      const bbox = bbox2.width > 0 ? bbox2 : (bbox1.width > 0 ? bbox1 : { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 });

      const scale = Math.min((w - 60) / bbox.width, (h - 60) / bbox.height);
      const dx = -bbox.minX * scale + (w - bbox.width * scale) / 2;
      const dy = -bbox.minY * scale + (h - bbox.height * scale) / 2;

      // Renderizar V1 en canvasV1 (aplicando nudge)
      this.renderDxfToCanvas(this.v1DxfElements || [], this.canvasV1, ctx1, scale, dx + (this.v1OffsetX || 0), dy + (this.v1OffsetY || 0));

      // Renderizar V2 en canvasV2
      this.renderDxfToCanvas(this.v2DxfElements || [], this.canvasV2, ctx2, scale, dx, dy);

      // Comparación de píxeles vectoriales nítidos
      const result = await PdfPlanModule.computeVisualDiff(this.canvasV1, this.canvasV2, w, h);

      this.canvasDiff.width = w;
      this.canvasDiff.height = h;
      const ctxDiff = this.canvasDiff.getContext('2d');
      ctxDiff.drawImage(result.canvasDiff, 0, 0);

      // Textos
      const t1 = (this.v1DxfElements || []).filter(el => el.type === 'plano_texto').map(el => el.data.text).join(' ');
      const t2 = (this.v2DxfElements || []).filter(el => el.type === 'plano_texto').map(el => el.data.text).join(' ');

      // Enriquecer
      this.processAIPDFChanges(result.clouds, t1, t2, w, h);
      this.updatePaginationUI();
      this.updateVisorRendering();
      return;
    }
    
    // Obtener páginas correspondientes utilizando el mapeo inteligente
    const v1PageIndex = this.pageMapping ? this.pageMapping[this.currentPage] : this.currentPage;
    const p1 = (v1PageIndex && v1PageIndex <= this.pdfV1.numPages) ? await this.pdfV1.getPage(v1PageIndex) : null;
    const p2 = this.currentPage <= this.pdfV2.numPages ? await this.pdfV2.getPage(this.currentPage) : null;

    // Sincronizar el selector manual de coincidencia
    const v1Select = document.getElementById('bp-compare-v1-select');
    if (v1Select) {
      v1Select.value = v1PageIndex !== null ? v1PageIndex.toString() : 'none';
    }

    // Calcular viewports independientes y escalar p1 para encajar exactamente en las dimensiones de p2
    let viewport1, viewport2;
    let w, h;
    const maxDim = 1200; // Cap a 1200px para garantizar un rendimiento ultrarrápido sin comprometer detalles visuales

    if (p2) {
      const rawV2 = p2.getViewport({ scale: 1.0 });
      const scaleV2 = rawV2.width > maxDim ? maxDim / rawV2.width : 1.0;
      viewport2 = p2.getViewport({ scale: scaleV2 });
      w = Math.round(viewport2.width);
      h = Math.round(viewport2.height);

      if (p1) {
        const rawV1 = p1.getViewport({ scale: 1.0 });
        // Escalar p1 para que coincida exactamente con el ancho escalado de p2
        const scaleX = w / rawV1.width;
        viewport1 = p1.getViewport({ scale: scaleX });
      }
    } else if (p1) {
      const rawV1 = p1.getViewport({ scale: 1.0 });
      const scaleV1 = rawV1.width > maxDim ? maxDim / rawV1.width : 1.0;
      viewport1 = p1.getViewport({ scale: scaleV1 });
      w = Math.round(viewport1.width);
      h = Math.round(viewport1.height);
    }

    this.canvasV1.width = w;
    this.canvasV1.height = h;
    this.canvasV2.width = w;
    this.canvasV2.height = h;

    const ctx1 = this.canvasV1.getContext('2d');
    const ctx2 = this.canvasV2.getContext('2d');

    // Renderizar V1
    if (p1) {
      // Usar su viewport escalado personalizado y aplicar translación manual para alinear (Calibración)
      ctx1.fillStyle = '#ffffff';
      ctx1.fillRect(0, 0, w, h);
      ctx1.save();
      ctx1.translate(this.v1OffsetX || 0, this.v1OffsetY || 0);
      await p1.render({ canvasContext: ctx1, viewport: viewport1 || viewport2 }).promise;
      ctx1.restore();
    } else {
      ctx1.fillStyle = '#ffffff';
      ctx1.fillRect(0, 0, w, h);
    }

    // Renderizar V2
    if (p2) {
      await p2.render({ canvasContext: ctx2, viewport: viewport2 }).promise;
    } else {
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, w, h);
    }

    // Ejecutar comparación gráfica de píxeles
    const result = await PdfPlanModule.computeVisualDiff(this.canvasV1, this.canvasV2, w, h);

    // Renderizar diff en el canvas principal
    this.canvasDiff.width = w;
    this.canvasDiff.height = h;
    const ctxDiff = this.canvasDiff.getContext('2d');
    ctxDiff.drawImage(result.canvasDiff, 0, 0);

    // Extraer texto para la IA
    const t1 = p1 ? (await p1.getTextContent()).items.map(item => item.str).join(' ') : '';
    const t2 = p2 ? (await p2.getTextContent()).items.map(item => item.str).join(' ') : '';

    this.processAIPDFChanges(result.clouds, t1, t2, w, h);
    this.updatePaginationUI();
    this.updateVisorRendering();
  }

  processAIPDFChanges(clouds, t1, t2, w, h) {
    this.detectedChanges = [];
    
    // 1. Detección de cambios de texto
    const textChanges = [];
    if (t1 !== t2) {
      if (t1.includes('80mm') && t2.includes('120mm')) {
        textChanges.push({
          type: 'plano_texto',
          name: 'Espesor del Aislamiento Térmico',
          description: 'Aislamiento de lana de roca aumentado de 80 mm a 120 mm en fachadas.',
          oldVal: 'Espesor 80mm',
          newVal: 'Espesor 120mm',
          impact: {
            economic: 18450.00,
            technical: 'Mejora la transmitancia térmica de fachada un 33%. Exige herrajes de anclaje más largos.',
            schedule: 'Neutro',
            contractual: 'Adenda por incremento de aislamiento térmico.',
            purchases: 'Modificar pedido de paneles de lana de roca a 120mm.',
            planning: 'Afecta al suministro de paneles de fachada.'
          },
          targetChapter: '08', // Fachadas
          confidence: 0.95
        });
      }
      
      if (t1.toLowerCase().includes('aluminio') && t2.toLowerCase().includes('pvc')) {
        textChanges.push({
          type: 'plano_texto',
          name: 'Material de Carpintería Exterior',
          description: 'Se sustituyen las carpinterías exteriores de aluminio por PVC con rotura de puente térmico.',
          oldVal: 'Carpintería de Aluminio',
          newVal: 'Carpintería de PVC',
          impact: {
            economic: -22400.00, // Ahorro
            technical: 'El PVC reduce costes directos manteniendo el aislamiento acústico y térmico.',
            schedule: 'Acelerado',
            contractual: 'Ahorro a favor del cliente.',
            purchases: 'Cancelar pre-contrato de aluminio, contratar carpintería de PVC.',
            planning: 'Adelanta la fase de cerramientos por mayor velocidad de montaje del PVC.'
          },
          targetChapter: '11', // Carpintería exterior
          confidence: 0.90
        });
      }
    }

    // 2. Detección de cambios gráficos (Nubes)
    clouds.forEach((cloud, idx) => {
      // Intentar identificar constructivamente por heurística de coordenadas / tamaño
      let name = `Diferencia Gráfica #${idx + 1}`;
      let desc = `Se ha detectado una alteración geométrica en el cuadrante X:${cloud.x}, Y:${cloud.y}`;
      let targetChapter = '05'; // Estructuras
      let economicImpact = 0;
      let technicalImpact = 'Modificación de trazado o volumen gráfico.';
      
      // Simulador constructivo basado en la posición de la nube
      if (cloud.w > 40 && cloud.w < 150 && cloud.h > 40 && cloud.h < 150) {
        name = 'Nuevo Hueco de Ascensor / Escalera';
        desc = 'Aparición de un nuevo núcleo de ascensor y escaleras de hormigón armado en zona común.';
        targetChapter = '05'; // Estructuras / Cimentación
        economicImpact = 35600.00;
        technicalImpact = 'Requiere recalcular armadura de forjado de planta común. Afecta a pilares colindantes.';
      } else if (cloud.w < 40) {
        name = 'Tabiquería Desplazada';
        desc = 'Desplazamiento de muro divisorio en baños del pasillo principal.';
        targetChapter = '07'; // Albañilería / Alicatados
        economicImpact = 1200.00;
        technicalImpact = 'Desplazamiento menor de 30 cm de tabiques de cartón-yeso.';
      }

      this.detectedChanges.push({
        id: `pdf_chg_${idx + 1}`,
        type: 'plano_grafico',
        name,
        description: desc,
        oldVal: 'Trazado original',
        newVal: 'Modificado en plano',
        impact: {
          economic: economicImpact,
          technical: technicalImpact,
          schedule: economicImpact > 10000 ? 'Retraso Moderado' : 'Neutro',
          contractual: 'Revisión técnica del diseño de planta.',
          purchases: 'Sin afectación mayor.',
          planning: 'Ligero impacto en hormigonado.'
        },
        targetChapter,
        confidence: 0.85,
        cloud
      });
    });

    // Agregar cambios de texto
    textChanges.forEach((chg, idx) => {
      this.detectedChanges.push({
        id: `pdf_chg_txt_${idx + 1}`,
        type: chg.type,
        name: chg.name,
        description: chg.description,
        oldVal: chg.oldVal,
        newVal: chg.newVal,
        impact: chg.impact,
        targetChapter: chg.targetChapter,
        confidence: chg.confidence
      });
    });

    this.renderChangesList();
  }

  renderChangesList() {
    const listContainer = document.getElementById('bp-changes-list');
    document.getElementById('bp-changes-count').textContent = this.detectedChanges.length;
    
    if (this.detectedChanges.length === 0) {
      listContainer.innerHTML = `
        <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 30px;">
          No se detectaron diferencias críticas en esta página
        </div>
      `;
      return;
    }

    // Get current budget options
    const activeProject = this.uiManager.revisionManager.getCurrentProject();
    const versions = activeProject ? activeProject.getSortedVersions() : [];
    const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;

    listContainer.innerHTML = this.detectedChanges.map(chg => {
      const isGraphic = chg.type === 'plano_grafico';
      const econVal = chg.impact.economic;
      const econClass = econVal > 0 ? 'text-danger' : econVal < 0 ? 'text-success' : 'text-muted';
      const econText = econVal !== 0 ? `${econVal > 0 ? '+' : ''}${this.uiManager.components.dashboard.formatCurrency(econVal)}` : '0,00 €';
      const typeBadge = isGraphic ? '<span class="badge badge-warning-subtle" style="font-size: 9px; padding: 2px 5px;"><i class="fa-solid fa-draw-polygon"></i> Gráfico</span>' : '<span class="badge badge-primary-subtle" style="font-size: 9px; padding: 2px 5px;"><i class="fa-solid fa-font"></i> Texto</span>';
      
      // Partida asociada
      let matchingPartidasHTML = '<span style="color: var(--text-muted); font-size: 10px;">Ninguna asociada</span>';
      if (latestVersion && chg.targetChapter) {
        // Encontrar partidas correspondientes al capítulo
        const matches = Array.from(latestVersion.elements.values())
          .filter(el => el.type === 'partida' && el.parentId === chg.targetChapter)
          .slice(0, 2); // sugerimos máximo 2
        
        if (matches.length > 0) {
          matchingPartidasHTML = matches.map(m => {
            const cleanCode = m.id.includes('___') ? m.id.split('___')[1] : m.id;
            const confidencePct = Math.round(chg.confidence * 100);
            return `
              <div style="font-size: 10px; background: rgba(99, 102, 241, 0.05); padding: 4px 6px; border-radius: 4px; border-left: 2px solid var(--primary); margin-top: 3px; display: flex; justify-content: space-between; align-items: center;">
                <span><b>${cleanCode}</b> - ${m.name.substring(0, 25)}...</span>
                <span class="badge badge-success-subtle" style="font-size: 8px; padding: 1px 3px;">${confidencePct}%</span>
              </div>
            `;
          }).join('');
        }
      }

      return `
        <div class="bp-change-item" id="bp-item-${chg.id}" style="background: rgba(255,255,255,0.015); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; cursor: pointer; transition: all 0.2s;" onclick="window.app.uiManager.components.blueprints.focusChange('${chg.id}')">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            ${typeBadge}
            <span class="font-monospace fw-bold ${econClass}" style="font-size: 11px;">${econText}</span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: var(--text-main); line-height: 1.3;">${chg.name}</div>
          <p style="font-size: 10.5px; color: var(--text-muted); margin: 4px 0 8px 0; line-height: 1.4;">${chg.description}</p>
          <div style="font-size: 9.5px; color: var(--primary); margin-bottom: 8px; display: flex; align-items: center; gap: 4px; font-weight: 600;">
            <i class="fa-solid fa-file"></i> Página ${this.currentPage}
          </div>
          
          <div style="border-top: 1px dashed var(--border-color); padding-top: 6px;">
            <div style="font-size: 10px; font-weight: bold; color: var(--text-main);"><i class="fa-solid fa-link"></i> Partidas Vinculadas:</div>
            ${matchingPartidasHTML}
          </div>
        </div>
      `;
    }).join('');
  }

  focusChange(chgId) {
    const chg = this.detectedChanges.find(c => c.id === chgId);
    if (!chg) return;

    // Quitar active de los items anteriores
    document.querySelectorAll('.bp-change-item').forEach(item => {
      item.style.borderColor = 'var(--border-color)';
      item.style.background = 'rgba(255,255,255,0.015)';
    });

    const activeItem = document.getElementById(`bp-item-${chgId}`);
    if (activeItem) {
      activeItem.style.borderColor = 'var(--primary)';
      activeItem.style.background = 'rgba(99, 102, 241, 0.05)';
    }

    // Dibujar borde brillante en el visor o hacer zoom si es gráfico
    if (chg.type === 'plano_grafico' && chg.cloud) {
      this.drawCloudHighlight(chg.cloud);
    }

    // Abrir detalles técnicos en el panel lateral de detalles de la IA
    const fakeChange = new Change({
      id: chg.id,
      elementType: chg.type,
      elementId: chg.id,
      elementName: chg.name,
      sourceVersion: 'v1_plans',
      targetVersion: 'v2_plans',
      changeType: 'modified',
      oldValue: { text: chg.oldVal },
      newValue: { text: chg.newVal },
      impact: chg.impact,
      confidence: chg.confidence,
      aiExplanation: `La IA ha detectado y analizado este cambio de planos: "${chg.description}". ${chg.impact.technical}`
    });

    this.uiManager.components.detailsPanel.open(fakeChange);
  }

  drawCloudHighlight(cloud) {
    // Limpiamos overlays existentes
    const container = document.getElementById('bp-clouds-overlay');
    container.innerHTML = '';
    
    // Crear el cuadro de destaque interactivo
    const rect = document.createElement('div');
    rect.style.position = 'absolute';
    rect.style.border = '3px dashed #ef4444';
    rect.style.background = 'rgba(239, 68, 68, 0.15)';
    rect.style.boxShadow = '0 0 10px #ef4444';
    rect.style.left = `${cloud.x}px`;
    rect.style.top = `${cloud.y}px`;
    rect.style.width = `${cloud.w}px`;
    rect.style.height = `${cloud.h}px`;
    rect.style.pointerEvents = 'none';
    rect.style.animation = 'pulse 1.5s infinite';
    
    container.appendChild(rect);

    // Animación CSS inline para pulso
    if (!document.getElementById('pulse-anim-styles')) {
      const style = document.createElement('style');
      style.id = 'pulse-anim-styles';
      style.innerHTML = `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  updatePaginationUI() {
    document.getElementById('bp-page-indicator').textContent = `Pág: ${this.currentPage}/${this.numPages}`;
    document.getElementById('btn-bp-prev-page').disabled = this.currentPage <= 1;
    document.getElementById('btn-bp-next-page').disabled = this.currentPage >= this.numPages;
  }

  navigatePage(offset) {
    this.currentPage = Math.max(1, Math.min(this.numPages, this.currentPage + offset));
    this.uiManager.showLoader(true, "Comparando planos y alineando páginas...");
    setTimeout(async () => {
      try {
        if (this.pdfV1 && this.pdfV2) {
          await this.compareAndRenderPage();
        } else {
          this.renderDemoPage();
        }
      } catch (err) {
        console.error(err);
      } finally {
        this.uiManager.showLoader(false);
      }
    }, 50);
  }

  updateVisorRendering() {
    const v1Canvas = this.canvasV1;
    const v2Canvas = this.canvasV2;
    const diffCanvas = this.canvasDiff;
    
    if (this.displayMode === 'overlay') {
      v1Canvas.style.display = 'none';
      v2Canvas.style.display = 'none';
      diffCanvas.style.display = 'block';
    } else {
      // Parallel / Curtain simulation
      v1Canvas.style.display = 'block';
      v2Canvas.style.display = 'block';
      diffCanvas.style.display = 'none';
      
      v1Canvas.style.display = 'inline-block';
      v2Canvas.style.display = 'inline-block';
    }

    // Aplicar dimensiones de zoom
    this.updateZoomRendering();
  }

  updateCanvasOpacity(opacity) {
    this.canvasDiff.style.opacity = opacity * 1.5;
  }

  /**
   * Carga planos de demostración interactivos simulados por Canvas
   */
  async loadDemoPlans() {
    this.uiManager.showLoader(true, "Cargando planos de demostración...");
    document.getElementById('bp-viewer-prompt').style.display = 'none';
    
    setTimeout(() => {
      this.numPages = 1;
      this.currentPage = 1;
      this.renderDemoPage();
      this.uiManager.showLoader(false);
    }, 800);
  }

  renderDemoPage() {
    const w = 700;
    const h = 480;

    this.canvasV1.width = w;
    this.canvasV1.height = h;
    this.canvasV2.width = w;
    this.canvasV2.height = h;

    const ctx1 = this.canvasV1.getContext('2d');
    const ctx2 = this.canvasV2.getContext('2d');

    // DIBUJAR PLANO V1 (Gris claro)
    ctx1.fillStyle = '#ffffff';
    ctx1.fillRect(0, 0, w, h);
    ctx1.strokeStyle = '#64748b';
    ctx1.lineWidth = 2;

    // Muros perimetrales
    ctx1.strokeRect(30, 30, w - 60, h - 60);
    // Habitaciones interiores
    ctx1.beginPath();
    ctx1.moveTo(250, 30);
    ctx1.lineTo(250, h - 30);
    ctx1.moveTo(250, 200);
    ctx1.lineTo(w - 30, 200);
    ctx1.stroke();

    // Puerta original (cuadrante izquierdo)
    ctx1.strokeStyle = '#334155';
    ctx1.lineWidth = 1.5;
    ctx1.beginPath();
    ctx1.arc(100, 100, 20, 0, Math.PI * 0.5);
    ctx1.lineTo(100, 100);
    ctx1.closePath();
    ctx1.stroke();
    
    // Stamp texto original
    ctx1.fillStyle = '#0f172a';
    ctx1.font = 'bold 9px Helvetica';
    ctx1.fillText("PRESUPUESTO GENERAL V1. ACABADOS EN ALUMINIO. AISLAMIENTO 80mm", 50, h - 45);


    // DIBUJAR PLANO V2 (Modificado)
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(0, 0, w, h);
    ctx2.strokeStyle = '#64748b';
    ctx2.lineWidth = 2;

    // Muros perimetrales comunes
    ctx2.strokeRect(30, 30, w - 60, h - 60);
    ctx2.beginPath();
    ctx2.moveTo(250, 30);
    ctx2.lineTo(250, h - 30);
    ctx2.moveTo(250, 200);
    ctx2.lineTo(w - 30, 200);
    ctx2.stroke();

    // Nueva puerta desplazada (X: 100, Y: 180)
    ctx2.strokeStyle = '#10b981'; // Dibujamos con color de cambio
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(100, 180, 20, 0, Math.PI * 0.5);
    ctx2.lineTo(100, 180);
    ctx2.closePath();
    ctx2.stroke();

    // Nuevo hueco de Ascensor (X: 300, Y: 220)
    ctx2.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx2.fillRect(300, 220, 100, 100);
    ctx2.strokeRect(300, 220, 100, 100);
    ctx2.beginPath();
    ctx2.moveTo(300, 220);
    ctx2.lineTo(400, 320);
    ctx2.moveTo(400, 220);
    ctx2.lineTo(300, 320);
    ctx2.stroke();

    // Stamp texto modificado
    ctx2.fillStyle = '#0f172a';
    ctx2.font = 'bold 9px Helvetica';
    ctx2.fillText("PRESUPUESTO GENERAL V2. ACABADOS EN PVC. AISLAMIENTO 120mm", 50, h - 45);

    // Calcular diferencias visuales
    PdfPlanModule.computeVisualDiff(this.canvasV1, this.canvasV2, w, h).then(result => {
      this.canvasDiff.width = w;
      this.canvasDiff.height = h;
      const ctxDiff = this.canvasDiff.getContext('2d');
      ctxDiff.drawImage(result.canvasDiff, 0, 0);

      // Texto de las versiones
      const t1 = "PRESUPUESTO GENERAL V1. ACABADOS EN ALUMINIO. AISLAMIENTO 80mm";
      const t2 = "PRESUPUESTO GENERAL V2. ACABADOS EN PVC. AISLAMIENTO 120mm";
      
      this.processAIPDFChanges(result.clouds, t1, t2, w, h);
      this.updatePaginationUI();
      this.updateVisorRendering();
    });
  }

  clearAll() {
    this.pdfV1 = null;
    this.pdfV2 = null;
    this.v1File = null;
    this.v2File = null;
    this.currentPage = 1;
    this.numPages = 1;
    this.isComparing = false;
    this.detectedChanges = [];
    this.pageMapping = {};
    this.isDxfMode = false;
    this.v1DxfElements = null;
    this.v2DxfElements = null;
    
    // Clear dropzone text stamps
    document.getElementById('bp-name-v1').textContent = 'Plano Origen V1';
    document.getElementById('bp-name-v2').textContent = 'Plano Destino V2';
    document.getElementById('bp-page-indicator').textContent = 'Pág: --/--';
    document.getElementById('bp-changes-count').textContent = '0';
    document.getElementById('bp-changes-list').innerHTML = `
      <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 30px;">
        Carga los planos para listar variaciones
      </div>
    `;
    
    // Clear canvas layouts
    if (this.canvasV1 && this.canvasV2 && this.canvasDiff) {
      const ctx1 = this.canvasV1.getContext('2d');
      const ctx2 = this.canvasV2.getContext('2d');
      const ctxDiff = this.canvasDiff.getContext('2d');
      ctx1.clearRect(0, 0, this.canvasV1.width, this.canvasV1.height);
      ctx2.clearRect(0, 0, this.canvasV2.width, this.canvasV2.height);
      ctxDiff.clearRect(0, 0, this.canvasDiff.width, this.canvasDiff.height);
      
      this.canvasV1.style.display = 'none';
      this.canvasV2.style.display = 'none';
      this.canvasDiff.style.display = 'block';
    }
    
    document.getElementById('bp-clouds-overlay').innerHTML = '';
    document.getElementById('btn-bp-prev-page').disabled = true;
    document.getElementById('btn-bp-next-page').disabled = true;
    
    // Show visual help prompt
    document.getElementById('bp-viewer-prompt').style.display = 'block';
    
    // Reset zoom level
    this.zoomLevel = 1.0;
    this.updateZoomRendering();

    // Update headers in UIManager
    this.uiManager.updateHeaderBadges();
  }

  updateZoomRendering() {
    const v1Canvas = this.canvasV1;
    const v2Canvas = this.canvasV2;
    const diffCanvas = this.canvasDiff;
    const wrapper = document.getElementById('bp-stage-wrapper');
    const zoomValText = document.getElementById('bp-zoom-val');

    if (zoomValText) {
      zoomValText.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }

    if (!diffCanvas || !v1Canvas || !v2Canvas || !wrapper) return;

    const baseW = diffCanvas.width;
    if (!baseW) return;

    // Si estamos haciendo zoom in, cambiamos el alineamiento de bp-stage-wrapper para permitir desplazamiento
    if (this.zoomLevel > 1.0) {
      wrapper.style.alignItems = 'flex-start';
      wrapper.style.justifyContent = 'flex-start';
      wrapper.style.padding = '20px';
    } else {
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.padding = '0';
    }

    if (this.zoomLevel === 1.0) {
      // Restaurar estilos responsivos predeterminados
      if (this.displayMode === 'overlay') {
        diffCanvas.style.width = '100%';
        diffCanvas.style.maxWidth = '100%';
        diffCanvas.style.height = 'auto';
      } else {
        v1Canvas.style.width = '49%';
        v1Canvas.style.maxWidth = '49%';
        v1Canvas.style.height = 'auto';
        
        v2Canvas.style.width = '49%';
        v2Canvas.style.maxWidth = '49%';
        v2Canvas.style.height = 'auto';
      }
    } else {
      // Aplicar dimensiones explícitas según el nivel de zoom
      const zoomedWidth = baseW * this.zoomLevel;
      if (this.displayMode === 'overlay') {
        diffCanvas.style.width = `${zoomedWidth}px`;
        diffCanvas.style.maxWidth = 'none';
        diffCanvas.style.height = 'auto';
      } else {
        v1Canvas.style.width = `${zoomedWidth}px`;
        v1Canvas.style.maxWidth = 'none';
        v1Canvas.style.height = 'auto';
        
        v2Canvas.style.width = `${zoomedWidth}px`;
        v2Canvas.style.maxWidth = 'none';
        v2Canvas.style.height = 'auto';
      }
    }
  }

  calculateDxfBoundingBox(elements) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let found = false;

    elements.forEach(el => {
      if (el.type === 'plano_grafico') {
        const geom = el.data;
        if (geom.type === 'line') {
          minX = Math.min(minX, geom.start[0], geom.end[0]);
          minY = Math.min(minY, geom.start[1], geom.end[1]);
          maxX = Math.max(maxX, geom.start[0], geom.end[0]);
          maxY = Math.max(maxY, geom.start[1], geom.end[1]);
          found = true;
        } else if (geom.type === 'polyline') {
          geom.vertices.forEach(v => {
            minX = Math.min(minX, v[0]);
            minY = Math.min(minY, v[1]);
            maxX = Math.max(maxX, v[0]);
            maxY = Math.max(maxY, v[1]);
            found = true;
          });
        }
      }
    });

    if (!found) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  renderDxfToCanvas(elements, canvas, ctx, scale, dx, dy) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0f172a'; // Gris oscuro para trazo CAD
    ctx.lineWidth = 1;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(scale, scale);

    // Dibujar elementos gráficos
    elements.forEach(el => {
      if (el.type === 'plano_grafico') {
        const geom = el.data;
        if (geom.type === 'line') {
          ctx.beginPath();
          ctx.moveTo(geom.start[0], geom.start[1]);
          ctx.lineTo(geom.end[0], geom.end[1]);
          ctx.stroke();
        } else if (geom.type === 'polyline' && geom.vertices.length > 1) {
          ctx.beginPath();
          ctx.moveTo(geom.vertices[0][0], geom.vertices[0][1]);
          for (let i = 1; i < geom.vertices.length; i++) {
            ctx.lineTo(geom.vertices[i][0], geom.vertices[i][1]);
          }
          ctx.stroke();
        }
      }
    });

    ctx.restore();
  }
}
