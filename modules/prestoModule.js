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
}
