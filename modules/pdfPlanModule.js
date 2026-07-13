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

    const d1 = imgData1.data;
    const d2 = imgData2.data;
    const df = diffData.data;

    let diffPixelsCount = 0;
    const gridSize = 20;
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r1 = d1[idx], g1 = d1[idx+1], b1 = d1[idx+2], a1 = d1[idx+3];
        const r2 = d2[idx], g2 = d2[idx+1], b2 = d2[idx+2], a2 = d2[idx+3];

        // Fondo es considerado blanco o transparente
        const isBg1 = (r1 > 240 && g1 > 240 && b1 > 240) || a1 === 0;
        const isBg2 = (r2 > 240 && g2 > 240 && b2 > 240) || a2 === 0;

        if (isBg1 && isBg2) {
          // Fondo oscuro para encajar con el tema visual de la plataforma
          df[idx] = 11;
          df[idx+1] = 15;
          df[idx+2] = 25;
          df[idx+3] = 255;
        } else if (!isBg1 && isBg2) {
          // Eliminado (Rojo)
          df[idx] = 239;
          df[idx+1] = 68;
          df[idx+2] = 68;
          df[idx+3] = 255;
          diffPixelsCount++;
          grid[Math.floor(y / gridSize)][Math.floor(x / gridSize)]++;
        } else if (isBg1 && !isBg2) {
          // Añadido (Verde)
          df[idx] = 16;
          df[idx+1] = 185;
          df[idx+2] = 129;
          df[idx+3] = 255;
          diffPixelsCount++;
          grid[Math.floor(y / gridSize)][Math.floor(x / gridSize)]++;
        } else {
          // Coincidencia o cambio de color
          const colorDiff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          if (colorDiff > 60) {
            // Modificado (Amarillo)
            df[idx] = 245;
            df[idx+1] = 158;
            df[idx+2] = 11;
            df[idx+3] = 255;
            diffPixelsCount++;
            grid[Math.floor(y / gridSize)][Math.floor(x / gridSize)]++;
          } else {
            // Elemento común sin cambios (Gris azulado atenuado)
            const gray = Math.round((r2 + g2 + b2) / 3);
            df[idx] = Math.round(gray * 0.25) + 30;
            df[idx+1] = Math.round(gray * 0.25) + 40;
            df[idx+2] = Math.round(gray * 0.25) + 55;
            df[idx+3] = 255;
          }
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
