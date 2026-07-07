class ChangeEngine {
  /**
   * Compares two versions and returns a list of Changes.
   * @param {Version} sourceVersion Original version (can be null for initial import)
   * @param {Version} targetVersion New version
   * @param {string} user User performing the comparison
   * @returns {Change[]} List of changes detected
   */
  static compare(sourceVersion, targetVersion, user = 'Sistema') {
    const changes = [];
    let changeIndex = 1;

    const generateId = () => `chg_${String(changeIndex++).padStart(3, '0')}`;

    const sourceElements = sourceVersion ? sourceVersion.elements : new Map();
    const targetElements = targetVersion.elements;

    // Union of all keys: "type:id"
    const allKeys = new Set([
      ...sourceElements.keys(),
      ...targetElements.keys()
    ]);

    for (const key of allKeys) {
      const [type, id] = key.split(':');
      if (type === 'capitulo') continue;
      
      const sourceEl = sourceElements.get(key);
      const targetEl = targetElements.get(key);

      if (!sourceEl && targetEl) {
        // Element was ADDED
        const economicImpact = targetEl.data.total || 0;
        changes.push(new Change({
          id: generateId(),
          elementType: type,
          elementId: id,
          elementName: targetEl.name,
          sourceVersion: sourceVersion ? sourceVersion.id : null,
          targetVersion: targetVersion.id,
          changeType: 'added',
          fieldName: [],
          oldValue: null,
          newValue: {
            name: targetEl.name,
            parentId: targetEl.parentId,
            ...targetEl.data
          },
          impact: {
            economic: economicImpact,
            technical: `Incorporación del elemento al proyecto.`,
            schedule: 'Neutro',
            contractual: 'Requiere aprobación de nueva partida.',
            purchases: 'Requiere cotización con proveedores.',
            planning: 'Añadir a la planificación de obra.'
          },
          user,
          confidence: 1.0
        }));
      } else if (sourceEl && !targetEl) {
        // Element was DELETED
        const economicImpact = -(sourceEl.data.total || 0);
        changes.push(new Change({
          id: generateId(),
          elementType: type,
          elementId: id,
          elementName: sourceEl.name,
          sourceVersion: sourceVersion.id,
          targetVersion: targetVersion.id,
          changeType: 'deleted',
          fieldName: [],
          oldValue: {
            name: sourceEl.name,
            parentId: sourceEl.parentId,
            ...sourceEl.data
          },
          newValue: null,
          impact: {
            economic: economicImpact,
            technical: `Eliminación del elemento del proyecto.`,
            schedule: 'Acelerado',
            contractual: 'Ajuste de contrato por reducción de alcance.',
            purchases: 'Cancelar pedidos o subcontratos asociados.',
            planning: 'Retirar de la planificación.'
          },
          user,
          confidence: 1.0
        }));
      } else if (sourceEl && targetEl) {
        // Element exists in both, check for modifications
        const modifiedFields = [];
        const oldValue = {};
        const newValue = {};

        // Compare name/description
        if (sourceEl.name !== targetEl.name) {
          modifiedFields.push('name');
          oldValue.name = sourceEl.name;
          newValue.name = targetEl.name;
        }

        // Compare parent
        if (sourceEl.parentId !== targetEl.parentId) {
          modifiedFields.push('parentId');
          oldValue.parentId = sourceEl.parentId;
          newValue.parentId = targetEl.parentId;
        }

        // Compare data fields (quantity, price, unit, total, etc.)
        const allDataKeys = new Set([
          ...Object.keys(sourceEl.data),
          ...Object.keys(targetEl.data)
        ]);

        for (const dataKey of allDataKeys) {
          const valSource = sourceEl.data[dataKey];
          const valTarget = targetEl.data[dataKey];

          // Handle float comparisons with tolerance
          if (typeof valSource === 'number' && typeof valTarget === 'number') {
            if (Math.abs(valSource - valTarget) > 0.0001) {
              modifiedFields.push(dataKey);
              oldValue[dataKey] = valSource;
              newValue[dataKey] = valTarget;
            }
          } else if (valSource !== valTarget) {
            modifiedFields.push(dataKey);
            oldValue[dataKey] = valSource;
            newValue[dataKey] = valTarget;
          }
        }

        if (modifiedFields.length > 0) {
          const economicImpact = (targetEl.data.total || 0) - (sourceEl.data.total || 0);
          
          changes.push(new Change({
            id: generateId(),
            elementType: type,
            elementId: id,
            elementName: targetEl.name,
            sourceVersion: sourceVersion.id,
            targetVersion: targetVersion.id,
            changeType: 'modified',
            fieldName: modifiedFields,
            oldValue,
            newValue,
            impact: {
              economic: economicImpact,
              technical: 'Modificación de características del elemento.',
              schedule: 'Neutro',
              contractual: Math.abs(economicImpact) > 0.01 ? 'Requiere adenda o precios contradictorios.' : 'Sin cambios contractuales.',
              purchases: modifiedFields.includes('price') ? 'Negociar tarifas con proveedores.' : 'Ajustar cantidades de compra.',
              planning: 'Verificar holguras en la planificación.'
            },
            user,
            confidence: 1.0
          }));
        }
      }
    }

    return changes;
  }
}
