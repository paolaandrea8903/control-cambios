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
      // Dividir por líneas
      const lines = text.split(/\r?\n/);
      const elements = [];
      
      let currentEntity = null;
      let groupCode = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        // En DXF, las líneas impares (0-indexed 0, 2, 4...) contienen el código de grupo
        if (i % 2 === 0) {
          groupCode = parseInt(line, 10);
        } else {
          // Las líneas pares contienen el valor del grupo
          const val = line;
          
          if (groupCode === 0) {
            // Se inicia una nueva entidad
            if (currentEntity) {
              const el = this.createCoreElement(currentEntity, file.name);
              if (el) elements.push(el);
            }
            currentEntity = { type: val, layer: '0', text: '', x: 0, y: 0 };
          } else if (currentEntity) {
            // Asignación de propiedades según código de grupo DXF estándar
            switch (groupCode) {
              case 8: // Nombre de la capa
                currentEntity.layer = val;
                break;
              case 1: // Valor de texto principal
                currentEntity.text = val;
                break;
              case 3: // Texto secundario o extensión de MTEXT
                currentEntity.text += val;
                break;
              case 10: // Coordenada X
                currentEntity.x = parseFloat(val);
                break;
              case 20: // Coordenada Y
                currentEntity.y = parseFloat(val);
                break;
            }
          }
        }
      }
      
      // Procesar última entidad
      if (currentEntity) {
        const el = this.createCoreElement(currentEntity, file.name);
        if (el) elements.push(el);
      }

      console.log(`DXF leído: ${file.name}, Elementos de texto extraídos: ${elements.length}`);
      return elements;
    } catch (err) {
      console.error("Error al parsear el archivo DXF:", err);
      throw err;
    }
  }

  /**
   * Traduce la entidad DXF en un Elemento compatible con el ChangeEngine del núcleo.
   */
  createCoreElement(entity, fileName) {
    // Nos centramos en textos (TEXT y MTEXT) ya que contienen las especificaciones técnicas y cotas
    if (entity.type !== 'TEXT' && entity.type !== 'MTEXT') {
      return null;
    }
    
    if (!entity.text || entity.text.trim() === '') return null;
    
    // Limpiar códigos de escape de AutoCAD (ej: \A1; \P, etc.)
    let cleanText = entity.text
      .replace(/\\[A-Za-z0-9]+;/g, '')
      .replace(/\\P/g, ' ')
      .replace(/[{}\n\r]/g, '')
      .trim();

    if (cleanText.length < 2) return null;
    
    // ID único basado en capa y coordenadas espaciales
    const elementId = `dxf_txt___${entity.layer.toLowerCase()}___${Math.round(entity.x)}_${Math.round(entity.y)}`;
    
    return new Element(
      elementId,
      'plano_texto',
      `Texto en Capa [${entity.layer}]`,
      {
        text: cleanText,
        layer: entity.layer,
        coords: [entity.x, entity.y],
        fileName: fileName
      },
      null
    );
  }
}

// Registrar en el scope global y auto-registrar en el Registro de Módulos
window.DxfModule = DxfModule;
if (typeof moduleRegistry !== 'undefined') {
  moduleRegistry.registerModule(new DxfModule());
}
