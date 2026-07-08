class PrestoModule {
  constructor() {
    this.id = 'presto-budget';
    this.name = 'Presupuestos de Construcción (Presto/BC3/Excel)';
    this.supportedExtensions = ['.xlsx', '.xls', '.bc3', '.obx'];
  }

  /**
   * Parses the file content (binary or SheetJS raw data) and extracts Elements.
   * @param {ArrayBuffer|Array[]} fileData Raw array data (SheetJS sheet_to_json result or ArrayBuffer)
   * @param {object} options
   * @returns {Element[]} Array of generic Element objects
   */
  parse(fileData, options = {}) {
    let rows = [];
    if (Array.isArray(fileData)) {
      rows = fileData;
    } else {
      // In case we receive an ArrayBuffer, caller should parse it with SheetJS.
      // But we will handle it in the uiManager or loader.
      throw new Error("presto-budget module expects parsed 2D row array.");
    }

    const elements = [];
    let currentChapterCode = null;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      if (!row || row.length === 0) continue;

      // Extract code (Col 0)
      let code = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
      if (code === '' || code.toLowerCase() === 'nan') {
        continue;
      }

      // Extract details
      const unit = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '';
      const desc = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';
      const multiplier = row[4] !== undefined && row[4] !== null ? Number(row[4]) : 1;
      const qty1 = row[5] !== undefined && row[5] !== null ? Number(row[5]) : 0;
      const qty2 = row[6] !== undefined && row[6] !== null ? Number(row[6]) : 0;
      const price = row[8] !== undefined && row[8] !== null ? Number(row[8]) : 0;
      const total = row[10] !== undefined && row[10] !== null ? Number(row[10]) : 0;
      const longDesc = row[11] !== undefined && row[11] !== null ? String(row[11]).trim() : '';

      // Check if it's a chapter: unit is empty or 'nan'
      const isChapter = (unit === '' || unit.toLowerCase() === 'nan');

      if (isChapter) {
        currentChapterCode = code;
        elements.push(new Element(
          code,
          'capitulo',
          desc,
          {
            total: total,
            longDesc: longDesc
          },
          null
        ));
      } else {
        // It's a work item (partida)
        elements.push(new Element(
          code,
          'partida',
          desc,
          {
            unit: unit,
            multiplier: multiplier,
            qty_presupuesto: qty1,
            qty_medicion: qty2,
            price: price,
            total: total,
            longDesc: longDesc
          },
          currentChapterCode || 'ORFANAS' // fallback if no preceding chapter
        ));
      }
    }

    return elements;
  }

  /**
   * Parses standard FIEBDC-3 (.bc3) file content and extracts Elements.
   * @param {string} text Raw text content of the BC3 file
   * @returns {Element[]} Array of generic Element objects
   */
  parseBC3(text) {
    const lines = text.split(/\r?\n/);
    const concepts = new Map(); // code -> { code, unit, desc, price, longDesc, isChapter }
    const relations = []; // { parent, child, factor, qty }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('~')) continue;
      
      const parts = line.substring(1).split('|');
      const type = parts[0];

      if (type === 'C') {
        const code = parts[1] ? parts[1].trim() : '';
        const unit = parts[2] ? parts[2].trim() : '';
        const desc = parts[3] ? parts[3].trim() : '';
        const price = parts[4] ? parseFloat(parts[4].replace(',', '.')) || 0 : 0;
        
        if (code) {
          concepts.set(code, {
            code,
            unit,
            desc,
            price,
            longDesc: '',
            isChapter: (unit === '' || unit.toLowerCase() === 'nan')
          });
        }
      } else if (type === 'D') {
        const code = parts[1] ? parts[1].trim() : '';
        const textContent = parts.slice(2).join('|').trim();
        const cleanText = textContent.replace(/\\/g, '\n').trim();
        if (code && concepts.has(code)) {
          concepts.get(code).longDesc = cleanText;
        }
      } else if (type === 'R') {
        const parent = parts[1] ? parts[1].trim() : '';
        const child = parts[2] ? parts[2].trim() : '';
        const factor = parts[3] ? parseFloat(parts[3].replace(',', '.')) || 1 : 1;
        const qty = parts[4] ? parseFloat(parts[4].replace(',', '.')) || 0 : 0;
        if (parent && child) {
          relations.push({ parent, child, factor, qty });
        }
      }
    }

    const childToParent = new Map();
    const childQuantities = new Map();
    const childFactors = new Map();

    for (const rel of relations) {
      childToParent.set(rel.child, rel.parent);
      childQuantities.set(rel.child, rel.qty);
      childFactors.set(rel.child, rel.factor);
    }

    const elements = [];
    for (const [code, concept] of concepts.entries()) {
      const parentId = childToParent.get(code) || null;
      const qty = childQuantities.get(code) !== undefined ? childQuantities.get(code) : 1;
      const factor = childFactors.get(code) !== undefined ? childFactors.get(code) : 1;

      if (concept.isChapter) {
        elements.push(new Element(
          code,
          'capitulo',
          concept.desc,
          {
            total: 0 // Will be calculated by system summary totals
          },
          parentId
        ));
      } else {
        const total = qty * concept.price;
        elements.push(new Element(
          code,
          'partida',
          concept.desc,
          {
            unit: concept.unit,
            multiplier: factor,
            qty_presupuesto: qty,
            qty_medicion: qty,
            price: concept.price,
            total: total,
            longDesc: concept.longDesc
          },
          parentId || 'ORFANAS'
        ));
      }
    }

    return elements;
  }
}
