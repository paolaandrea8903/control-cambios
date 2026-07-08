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

    const compareType = options.compareType || 'objetivo';

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
      longDesc: 11,
      nature: 1
    };

    // Scan the first 15 rows to see if there is a header row to match columns dynamically
    let headerRowIndex = -1;
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
      let foundNature = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase().trim();
        if (val === 'código' || val === 'cod.' || val === 'cód. presupuesto' || val === 'codigo' || val === 'cód.') {
          foundCode = c;
        } else if (val === 'resumen' || val === 'descripción' || val === 'descripcion' || val === 'concepto' || val === 'concepto / elemento') {
          foundDesc = c;
        } else if (val === 'ud' || val === 'unidad' || val === 'unidades') {
          foundUnit = c;
        } else if (val === 'nat' || val === 'naturaleza') {
          foundNature = c;
        } else if (val === 'texto' || val === 'pliego' || val === 'texto largo' || val === 'ctexto' || val === 'texto_largo') {
          foundLongDesc = c;
        }

        // Match Price, Total, and Quantity dynamically based on chosen comparison mode
        if (compareType === 'objetivo') {
          if (['probj', 'precio objetivo', 'pr. obj.', 'pr.obj.', 'precioobj'].includes(val)) {
            foundPrice = c;
          } else if (['impobj', 'importe objetivo', 'imp. obj.', 'imp.obj.', 'importeobj'].includes(val)) {
            foundTotal = c;
          } else if (['canobj', 'cantidad objetivo', 'can. obj.', 'can.obj.', 'cantidadobj', 'medición objetivo', 'medición obj.'].includes(val)) {
            foundQty = c;
          }
        } else {
          // compareType === 'presupuesto'
          if (['prpres', 'precio presupuesto', 'pr. pres.', 'pr.pres.', 'preciopres', 'precio unitario'].includes(val)) {
            foundPrice = c;
          } else if (['imppres', 'importe presupuesto', 'imp. pres.', 'imp.pres.', 'importepres', 'importe total'].includes(val)) {
            foundTotal = c;
          } else if (['canpres', 'cantidad presupuesto', 'can. pres.', 'can.pres.', 'cantidadpres', 'medición presupuesto', 'medición pres.'].includes(val)) {
            foundQty = c;
          }
        }

        // Fallbacks if no specific type suffix was found (but generic columns are present)
        if (foundPrice === -1 && ['precio', 'precios', 'precio unitario'].includes(val)) {
          foundPrice = c;
        }
        if (foundTotal === -1 && ['importe', 'total', 'importe total'].includes(val)) {
          foundTotal = c;
        }
        if (foundQty === -1 && ['medición', 'medicion', 'cantidad', 'cantidades'].includes(val)) {
          foundQty = c;
        }
      }

      // If we found at least Code and Description, we consider this a valid header row!
      if (foundCode !== -1 && foundDesc !== -1) {
        headerRowIndex = i;
        colMapping.code = foundCode;
        if (foundUnit !== -1) colMapping.unit = foundUnit;
        if (foundDesc !== -1) colMapping.desc = foundDesc;
        if (foundPrice !== -1) colMapping.price = foundPrice;
        if (foundTotal !== -1) colMapping.total = foundTotal;
        if (foundNature !== -1) colMapping.nature = foundNature;
        if (foundQty !== -1) {
          colMapping.qty1 = foundQty;
          colMapping.qty2 = foundQty;
        }
        if (foundLongDesc !== -1) colMapping.longDesc = foundLongDesc;
        break;
      }
    }

    if (headerRowIndex !== -1) {
      // Remove the header row and everything preceding it from our data rows
      rows.splice(0, headerRowIndex + 1);
    } else {
      // 2. NO header row found! Let's detect columns using mathematical validation on the first few rows!
      let candidateRows = [];
      for (let i = 0; i < Math.min(50, rows.length); i++) {
        const row = rows[i];
        if (!row || row.length < 8) continue;
        const unit = String(row[2] || '').trim().toLowerCase();
        if (unit !== '' && unit !== 'nan' && unit.length <= 4) {
          candidateRows.push(row);
        }
      }

      if (candidateRows.length > 0) {
        let match1 = 0;
        let match2 = 0;

        candidateRows.forEach(row => {
          const q1 = Number(row[5] || 0);
          const q2 = Number(row[6] || 0);
          const p1 = Number(row[7] || 0);
          const p2 = Number(row[8] || 0);
          const t1 = Number(row[9] || 0);
          const t2 = Number(row[10] || 0);

          if (q1 > 0 && p1 > 0 && Math.abs(q1 * p1 - t1) / t1 < 0.015) match1++;
          if (q2 > 0 && p2 > 0 && Math.abs(q2 * p2 - t2) / t2 < 0.015) match2++;
        });

        // If at least 40% of candidate rows match this standard layout:
        if (match1 > candidateRows.length * 0.4 || match2 > candidateRows.length * 0.4) {
          colMapping.code = 0;
          colMapping.unit = 2;
          colMapping.desc = 3;
          colMapping.multiplier = 4;
          
          if (compareType === 'presupuesto') {
            colMapping.qty1 = 5;
            colMapping.qty2 = 5;
            colMapping.price = 7;
            colMapping.total = 9;
          } else {
            // compareType === 'objetivo'
            colMapping.qty1 = 6;
            colMapping.qty2 = 6;
            colMapping.price = 8;
            colMapping.total = 10;
          }
        }
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

      // Check if it is a basic component (sub-item)
      const nature = colMapping.nature !== undefined && row[colMapping.nature] !== undefined && row[colMapping.nature] !== null 
        ? String(row[colMapping.nature]).toLowerCase().trim() 
        : '';
      const isBasicComponent = ['material', 'mano de obra', 'maquinaria', '1', '2', '3'].includes(nature);

      // Check if it's a chapter: unit is empty or 'nan' or matches nature indicators
      const isChapter = (unit === '' || unit.toLowerCase() === 'nan' || ['capitulo', 'capítulo'].includes(nature));

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
      } else if (isBasicComponent) {
        // Classify basic components as 'basico' to prevent them from being treated as main 'partida'
        // and avoid double-counting totals
        elements.push(new Element(
          code,
          'basico',
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
          currentChapterCode || 'ORFANAS'
        ));
      } else {
        // It's a main work item (partida)
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
