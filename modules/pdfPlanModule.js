/**
 * Module 2: PDF Blueprints comparison module.
 * Parsea e interpreta planos en PDF, extrayendo textos y diferencias gráficas.
 */

class PdfPlanModule {
  constructor() {
    this.id = 'pdfPlan';
    this.name = 'Comparador de Planos PDF';
    this.supportedExtensions = ['.pdf'];
  }

  /**
   * Parsea un archivo PDF cargado localmente.
   * @param {File} file Objeto File del input html
   * @param {string} versionId ID de versión
   * @returns {Promise<Element[]>} Lista de elementos construidos del plano
   */
  async parse(file, versionId) {
    if (!window.pdfjsLib) {
      throw new Error("Librería PDF.js no cargada.");
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const elements = [];

      console.log(`Leyendo PDF: ${file.name}, Páginas: ${pdf.numPages}`);

      // Recorremos las páginas para extraer textos vectoriales
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Unir cadenas de texto
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        // Creamos elementos de texto del plano
        elements.push(new Element(
          `pdf_txt___page_${pageNum}_raw`,
          'plano_texto',
          `Texto de Página ${pageNum}`,
          {
            text: pageText,
            page: pageNum,
            type: 'note',
            fileName: file.name
          },
          null
        ));

        // Analizar y estructurar zonas críticas si se encuentran en el texto
        this.extractTechnicalSections(pageText, pageNum, file.name, elements);
      }

      // Guardamos la referencia de imagen / renderizado en caché si procede
      elements.push(new Element(
        `pdf_meta___info`,
        'plano_meta',
        `Metadatos del Plano`,
        {
          fileName: file.name,
          numPages: pdf.numPages,
          fileSize: file.size,
          lastModified: file.lastModified
        },
        null
      ));

      return elements;
    } catch (err) {
      console.error("Error al parsear el PDF:", err);
      throw err;
    }
  }

  /**
   * Extrae secciones del plano como leyendas, cajetines y acabados.
   */
  extractTechnicalSections(text, pageNum, fileName, elements) {
    // 1. Buscar leyendas o cuadros de carpintería/acabados
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('leyenda') || lowerText.includes('carpintería') || lowerText.includes('acabados')) {
      let sectionType = 'legend';
      let title = 'Leyenda del Plano';
      if (lowerText.includes('carpintería')) {
        sectionType = 'carpinterias';
        title = 'Cuadro de Carpinterías';
      } else if (lowerText.includes('acabados')) {
        sectionType = 'acabados';
        title = 'Cuadro de Acabados';
      }

      elements.push(new Element(
        `pdf_txt___page_${pageNum}_${sectionType}`,
        'plano_texto',
        title,
        {
          text: text.substring(0, 1000), // guardamos primer bloque crítico
          page: pageNum,
          type: sectionType,
          fileName: fileName
        },
        null
      ));
    }

    // 2. Buscar notas técnicas y pliegos
    if (lowerText.includes('nota') || lowerText.includes('observaciones') || lowerText.includes('especificaciones')) {
      elements.push(new Element(
        `pdf_txt___page_${pageNum}_notes`,
        'plano_texto',
        'Notas y Observaciones Técnicas',
        {
          text: text,
          page: pageNum,
          type: 'note',
          fileName: fileName
        },
        null
      ));
    }
  }

  /**
   * Compara visualmente dos páginas de PDF renderizadas en canvases
   * y genera las diferencias espaciales y nubes de revisión.
   */
  static async computeVisualDiff(canvas1, canvas2, width, height) {
    const canvasDiff = document.createElement('canvas');
    canvasDiff.width = width;
    canvasDiff.height = height;
    const ctxDiff = canvasDiff.getContext('2d');

    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');

    const imgData1 = ctx1.getImageData(0, 0, width, height);
    const imgData2 = ctx2.getImageData(0, 0, width, height);
    const diffData = ctxDiff.createImageData(width, height);

    const buf1 = new Uint32Array(imgData1.data.buffer);
    const buf2 = new Uint32Array(imgData2.data.buffer);
    const bufDiff = new Uint32Array(diffData.data.buffer);

    let diffPixelsCount = 0;
    const gridSize = 20;
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));

    // Colores Little-Endian (Formato: 0xAABBGGRR)
    const COLOR_WHITE = 0xFFFFFFFF;
    const COLOR_RED = 0xFF4444EF;     // (239, 68, 68, 255) -> Rojo (Eliminado)
    const COLOR_GREEN = 0xFF81B910;   // (16, 185, 129, 255) -> Verde (Añadido)
    const COLOR_YELLOW = 0xFF0B9EF5;  // (245, 158, 11, 255) -> Amarillo (Modificado)
    const COLOR_GREY = 0xFFB8A394;    // (148, 163, 184, 255) -> Gris (Común)

    const len = buf1.length;
    for (let i = 0; i < len; i++) {
      const val1 = buf1[i];
      const val2 = buf2[i];

      // Fast-path: si los píxeles son idénticos
      if (val1 === val2) {
        if (val1 === 0 || val1 === COLOR_WHITE) {
          bufDiff[i] = COLOR_WHITE;
        } else {
          bufDiff[i] = COLOR_GREY;
        }
        continue;
      }

      // Extraer canales de color
      const r1 = val1 & 0xFF, g1 = (val1 >> 8) & 0xFF, b1 = (val1 >> 16) & 0xFF, a1 = (val1 >> 24) & 0xFF;
      const r2 = val2 & 0xFF, g2 = (val2 >> 8) & 0xFF, b2 = (val2 >> 16) & 0xFF, a2 = (val2 >> 24) & 0xFF;

      const isBg1 = (r1 > 240 && g1 > 240 && b1 > 240) || a1 === 0;
      const isBg2 = (r2 > 240 && g2 > 240 && b2 > 240) || a2 === 0;

      const x = i % width;
      const y = Math.floor(i / width);
      const gridX = Math.floor(x / gridSize);
      const gridY = Math.floor(y / gridSize);

      // Limitar coordenadas de grid para evitar desbordamiento
      const gY = Math.min(gridY, rows - 1);
      const gX = Math.min(gridX, cols - 1);

      if (isBg1 && isBg2) {
        bufDiff[i] = COLOR_WHITE;
      } else if (!isBg1 && isBg2) {
        bufDiff[i] = COLOR_RED;
        diffPixelsCount++;
        grid[gY][gX]++;
      } else if (isBg1 && !isBg2) {
        bufDiff[i] = COLOR_GREEN;
        diffPixelsCount++;
        grid[gY][gX]++;
      } else {
        const colorDiff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        if (colorDiff > 60) {
          bufDiff[i] = COLOR_YELLOW;
          diffPixelsCount++;
          grid[gY][gX]++;
        } else {
          bufDiff[i] = COLOR_GREY;
        }
      }
    }

    ctxDiff.putImageData(diffData, 0, 0);

    // Agrupamiento (Clustering) de celdas adyacentes para nubes de revisión
    const clusters = [];
    const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] > 5 && !visited[r][c]) {
          const queue = [[r, c]];
          visited[r][c] = true;
          let minR = r, maxR = r, minC = c, maxC = c;

          while (queue.length > 0) {
            const [cr, cc] = queue.shift();
            minR = Math.min(minR, cr);
            maxR = Math.max(maxR, cr);
            minC = Math.min(minC, cc);
            maxC = Math.max(maxC, cc);

            // Búsqueda en 8 direcciones de hasta 2 celdas de distancia
            for (let dr = -2; dr <= 2; dr++) {
               for (let dc = -2; dc <= 2; dc++) {
                 const nr = cr + dr;
                 const nc = cc + dc;
                 if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                   if (grid[nr][nc] > 5 && !visited[nr][nc]) {
                     visited[nr][nc] = true;
                     queue.push([nr, nc]);
                   }
                 }
               }
            }
          }

          // Convertir de rejilla a píxeles absolutos
          const borderPadding = 10;
          clusters.push({
            x: Math.max(0, minC * gridSize - borderPadding),
            y: Math.max(0, minR * gridSize - borderPadding),
            w: Math.min(width, (maxC - minC + 1) * gridSize + borderPadding * 2),
            h: Math.min(height, (maxR - minR + 1) * gridSize + borderPadding * 2)
          });
        }
      }
    }

    return {
      canvasDiff,
      diffPixelsCount,
      clouds: clusters
    };
  }
}

// Registro global del módulo
moduleRegistry.registerModule(new PdfPlanModule());
