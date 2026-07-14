/**
 * Módulo de lectura y extracción de información técnica de archivos DXF.
 * Se enfoca en extraer entidades de texto (cota, anotación, notas técnicas, tablas)
 * para realizar la comparación lógica y el cruce con el presupuesto.
 */
class DxfModule {
  constructor() {
    this.id = 'dxf';
    this.name = 'dxf';
    this.supportedExtensions = ['.dxf'];
  }

  /**
   * Parsea un archivo DXF y extrae sus elementos.
   * @param {File} file Objeto File de entrada
   * @returns {Promise<Element[]>} Colección de elementos del plano
   */
  async parse(file) {
    try {
      const text = await file.text();
      const lines = text.split(/\r\n|\r|\n/);
      const elements = [];
      
      let currentEntity = null;
      let groupCode = null;
      
      let waitingForValue = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // No saltar líneas vacías para no desalinear pares, a menos que no estemos esperando valor
        if (line === '' && !waitingForValue) continue;

        if (!waitingForValue) {
          groupCode = parseInt(line, 10);
          waitingForValue = true;
        } else {
          const val = line;
          waitingForValue = false;
          
          if (groupCode === 0) {
            if (currentEntity) {
              const el = this.createCoreElement(currentEntity, file.name);
              if (el) elements.push(el);
            }
            currentEntity = { type: val, layer: '0', text: '', x: 0, y: 0, x2: 0, y2: 0, vertices: [] };
          } else if (currentEntity) {
            switch (groupCode) {
              case 8:
                currentEntity.layer = val;
                break;
              case 1:
                currentEntity.text = val;
                break;
              case 3:
                currentEntity.text += val;
                break;
              case 10:
                if (currentEntity.type === 'LWPOLYLINE') {
                  currentEntity.vertices.push([parseFloat(val), 0]);
                } else {
                  currentEntity.x = parseFloat(val);
                }
                break;
              case 20:
                if (currentEntity.type === 'LWPOLYLINE' && currentEntity.vertices.length > 0) {
                  currentEntity.vertices[currentEntity.vertices.length - 1][1] = parseFloat(val);
                } else {
                  currentEntity.y = parseFloat(val);
                }
                break;
              case 11:
                currentEntity.x2 = parseFloat(val);
                break;
              case 21:
                currentEntity.y2 = parseFloat(val);
                break;
            }
          }
        }
      }
      
      if (currentEntity) {
        const el = this.createCoreElement(currentEntity, file.name);
        if (el) elements.push(el);
      }

      console.log(`DXF leído: ${file.name}, Elementos extraídos: ${elements.length}`);
      
      // Diagnóstico temporal en caso de que no cargue nada
      if (elements.length === 0) {
        alert("Diagnóstico de Lectura DXF:\nArchivo: " + file.name + "\nLíneas leídas: " + lines.length + "\nTamaño de texto: " + text.length + " caracteres.\nPrimeros 150 caracteres: " + text.substring(0, 150).replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
      }
      
      return elements;
    } catch (err) {
      console.error("Error al parsear el archivo DXF:", err);
      throw err;
    }
  }

  /**
   * Traduce la entidad DXF en un Elemento compatible con el ChangeEngine.
   */
  createCoreElement(entity, fileName) {
    const layer = entity.layer || '0';
    
    if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
      if (!entity.text || entity.text.trim() === '') return null;
      let cleanText = entity.text
        .replace(/\\[A-Za-z0-9]+;/g, '')
        .replace(/\\P/g, ' ')
        .replace(/[{}\n\r]/g, '')
        .trim();
      if (cleanText.length < 2) return null;
      
      return new Element(
        `dxf_txt___${layer.toLowerCase()}___${Math.round(entity.x)}_${Math.round(entity.y)}`,
        'plano_texto',
        `Anotación en Capa [${layer}]`,
        {
          text: cleanText,
          layer: layer,
          coords: [entity.x, entity.y],
          type: 'text',
          fileName: fileName
        },
        null
      );
    }
    
    if (entity.type === 'LINE') {
      const length = Math.sqrt((entity.x2 - entity.x) ** 2 + (entity.y2 - entity.y) ** 2);
      if (length < 0.5) return null; // Ignorar micro-líneas
      
      return new Element(
        `dxf_line___${layer.toLowerCase()}___${Math.round(entity.x)}_${Math.round(entity.y)}___${Math.round(entity.x2)}_${Math.round(entity.y2)}`,
        'plano_grafico',
        `Línea en Capa [${layer}]`,
        {
          type: 'line',
          layer: layer,
          start: [entity.x, entity.y],
          end: [entity.x2, entity.y2],
          length: length,
          fileName: fileName
        },
        null
      );
    }
    
    if (entity.type === 'LWPOLYLINE' && entity.vertices.length >= 2) {
      // Calcular perímetro
      let perimeter = 0;
      const n = entity.vertices.length;
      for (let i = 0; i < n; i++) {
        const p1 = entity.vertices[i];
        const p2 = entity.vertices[(i + 1) % n];
        perimeter += Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
      }
      
      // Calcular área usando la fórmula de Shoelace
      let area = 0;
      for (let i = 0; i < n; i++) {
        const p1 = entity.vertices[i];
        const p2 = entity.vertices[(i + 1) % n];
        area += p1[0] * p2[1] - p2[0] * p1[1];
      }
      area = Math.abs(area / 2);
      
      const centroidX = entity.vertices.reduce((sum, v) => sum + v[0], 0) / n;
      const centroidY = entity.vertices.reduce((sum, v) => sum + v[1], 0) / n;
      
      return new Element(
        `dxf_poly___${layer.toLowerCase()}___${Math.round(centroidX)}_${Math.round(centroidY)}`,
        'plano_grafico',
        `Polilínea en Capa [${layer}]`,
        {
          type: 'polyline',
          layer: layer,
          vertices: entity.vertices,
          area: area,
          perimeter: perimeter,
          fileName: fileName
        },
        null
      );
    }
    
    return null;
  }
}

// Registrar en el scope global y auto-registrar en el Registro de Módulos
window.DxfModule = DxfModule;
if (typeof moduleRegistry !== 'undefined') {
  moduleRegistry.registerModule(new DxfModule());
}
