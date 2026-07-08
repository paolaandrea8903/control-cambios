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
      rows = [...fileData]; // clone to avoid mutating original
    } else {
      throw new Error("presto-budget module expects parsed 2D row array.");
    }

    // Default column mapping (fallback for the first Excel format)
    let colMapping = {
      code: 0,
      unit: 2,
      desc: 3,
      multiplier: 4,
      qty1: 5,
      qty2: 6,
      price: 8,
      total: 10,
      longDesc: 11
    };

    // Scan the first 15 rows to see if there is a header row to match columns dynamically
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;
      
      let foundCode = -1;
      let foundDesc = -1;
      let foundUnit = -1;
      let foundPrice = -1;
      let foundTotal = -1;
      let foundQty = -1;
      let foundLongDesc = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase().trim();
        if (val === 'código' || val === 'cod.' || val === 'cód. presupuesto' || val === 'codigo' || val === 'cód.') {
          foundCode = c;
        } else if (val === 'resumen' || val === 'descripción' || val === 'descripcion' || val === 'concepto' || val === 'concepto / elemento') {
          foundDesc = c;
        } else if (val === 'ud' || val === 'unidad' || val === 'unidades') {
          foundUnit = c;
        } else if (val === 'precio' || val === 'prpres' || val === 'precio pres.' || val === 'pr. pres.' || val === 'precios' || val === 'precio unitario') {
          foundPrice = c;
        } else if (val === 'importe' || val === 'imppres' || val === 'total' || val === 'imp. pres.' || val === 'importe pres.' || val === 'importe total') {
          foundTotal = c;
        } else if (val === 'medición' || val === 'medicion' || val === 'cantidad' || val === 'canpres' || val === 'cantidades') {
          foundQty = c;
        } else if (val === 'texto' || val === 'pliego' || val === 'texto largo' || val === 'ctexto' || val === 'texto_largo') {
          foundLongDesc = c;
        }
      }

      // If we found at least Code and Description, we consider this a valid header row!
      if (foundCode !== -1 && foundDesc !== -1) {
        colMapping.code = foundCode;
        if (foundUnit !== -1) colMapping.unit = foundUnit;
        if (foundDesc !== -1) colMapping.desc = foundDesc;
        if (foundPrice !== -1) colMapping.price = foundPrice;
        if (foundTotal !== -1) colMapping.total = foundTotal;
        if (foundQty !== -1) {
          colMapping.qty1 = foundQty;
          colMapping.qty2 = foundQty;
        }
        if (foundLongDesc !== -1) colMapping.longDesc = foundLongDesc;
        
        // Remove the header row and everything preceding it from our data rows
        rows.splice(0, i + 1);
        break;
      }
    }

    const elements = [];
    let currentChapterCode = null;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      if (!row || row.length === 0) continue;

      // Extract code
      let code = row[colMapping.code] !== undefined && row[colMapping.code] !== null ? String(row[colMapping.code]).trim() : '';
      if (code === '' || code.toLowerCase() === 'nan' || code.toLowerCase() === 'código' || code.toLowerCase() === 'codigo') {
        continue;
      }

      // Extract details using mapped columns
      const unit = row[colMapping.unit] !== undefined && row[colMapping.unit] !== null ? String(row[colMapping.unit]).trim() : '';
      const desc = row[colMapping.desc] !== undefined && row[colMapping.desc] !== null ? String(row[colMapping.desc]).trim() : '';
      const multiplier = colMapping.multiplier !== undefined && row[colMapping.multiplier] !== undefined && row[colMapping.multiplier] !== null ? Number(row[colMapping.multiplier]) : 1;
      const qty1 = row[colMapping.qty1] !== undefined && row[colMapping.qty1] !== null ? Number(row[colMapping.qty1]) : 0;
      const qty2 = colMapping.qty2 !== undefined && row[colMapping.qty2] !== undefined && row[colMapping.qty2] !== null ? Number(row[colMapping.qty2]) : qty1;
      const price = row[colMapping.price] !== undefined && row[colMapping.price] !== null ? Number(row[colMapping.price]) : 0;
      const total = row[colMapping.total] !== undefined && row[colMapping.total] !== null ? Number(row[colMapping.total]) : 0;
      const longDesc = colMapping.longDesc !== undefined && row[colMapping.longDesc] !== undefined && row[colMapping.longDesc] !== null ? String(row[colMapping.longDesc]).trim() : '';

      // Check if it's a chapter: unit is empty or 'nan' AND has no unit price / quantity, or matches nature indicators
      const isChapter = (
        (unit === '' || unit.toLowerCase() === 'nan') &&
        price === 0 &&
        qty1 === 0 &&
        qty2 === 0 &&
        !(row[1] && String(row[1]).toLowerCase().trim().includes('partida'))
      ) || (row[1] && ['capitulo', 'capítulo'].includes(String(row[1]).toLowerCase().trim()));

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
    const cleanCode = (c) => c ? c.trim().replace(/#+$/, '') : '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('~')) continue;
      
      const parts = line.substring(1).split('|');
      const type = parts[0];

      if (type === 'C') {
        const rawCode = parts[1] ? parts[1].trim() : '';
        const code = cleanCode(rawCode);
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
        const rawCode = parts[1] ? parts[1].trim() : '';
        const code = cleanCode(rawCode);
        const textContent = parts.slice(2).join('|').trim();
        
        if (textContent.includes('\\')) {
          const subParts = textContent.split('\\');
          for (let j = 0; j < subParts.length; j += 3) {
            const rawChild = subParts[j] ? subParts[j].trim() : '';
            const child = cleanCode(rawChild);
            if (!child) continue;
            const factor = parseFloat(subParts[j+1]) || 1;
            const qty = parseFloat(subParts[j+2]) || 0;
            relations.push({ parent: code, child, factor, qty });
          }
        } else {
          const cleanText = textContent.replace(/\\/g, '\n').trim();
          if (code && concepts.has(code)) {
            concepts.get(code).longDesc = cleanText;
          }
        }
      } else if (type === 'R') {
        const rawParent = parts[1] ? parts[1].trim() : '';
        const parent = cleanCode(rawParent);
        const rawChild = parts[2] ? parts[2].trim() : '';
        const child = cleanCode(rawChild);
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
