/**
 * Core classes for the Construction Revision Control Platform.
 * Working with generic concepts of "Element" and "Change".
 */

class Element {
  /**
   * @param {string} id Unique identifier within this element type (e.g. "01.01")
   * @param {string} type Type of element (e.g. "capitulo", "partida", "plano", "especificacion")
   * @param {string} name Human-readable name or short description
   * @param {object} data Specific properties (e.g. { unit, quantity, price, total })
   * @param {string|null} parentId Reference to parent element if hierarchical (e.g. chapter code)
   */
  constructor(id, type, name, data = {}, parentId = null) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.data = data;
    this.parentId = parentId;
  }
}

class Version {
  /**
   * @param {string} id Unique version identifier (e.g. "v1")
   * @param {string} name Descriptive name (e.g. "Proyecto Básico")
   * @param {string} date Creation date
   * @param {string} author Author of the version
   * @param {string} description Brief summary of comments
   */
  constructor(id, name, date, author, description = '') {
    this.id = id;
    this.name = name;
    this.date = date;
    this.author = author;
    this.description = description;
    /** @type {Map<string, Element>} Map from composite key `type:id` to Element */
    this.elements = new Map();
  }

  addElement(element) {
    const key = `${element.type}:${element.id}`;
    this.elements.set(key, element);
  }

  getElement(type, id) {
    return this.elements.get(`${type}:${id}`);
  }

  getElementsByType(type) {
    return Array.from(this.elements.values()).filter(el => el.type === type);
  }

  getAllElements() {
    return Array.from(this.elements.values());
  }
}

class Change {
  /**
   * @param {object} params
   * @param {string} params.id
   * @param {string} params.elementType
   * @param {string} params.elementId
   * @param {string} params.elementName
   * @param {string} params.sourceVersion
   * @param {string} params.targetVersion
   * @param {'added'|'modified'|'deleted'} params.changeType
   * @param {string[]} params.fieldName
   * @param {object|null} params.oldValue
   * @param {object|null} params.newValue
   * @param {object} params.impact
   * @param {string} params.date
   * @param {string} params.user
   * @param {number} params.confidence
   * @param {string} params.aiExplanation
   */
  constructor({
    id,
    elementType,
    elementId,
    elementName,
    sourceVersion,
    targetVersion,
    changeType,
    fieldName = [],
    oldValue = null,
    newValue = null,
    impact = {},
    date = new Date().toISOString(),
    user = 'Sistema',
    confidence = 1.0,
    aiExplanation = ''
  }) {
    this.id = id;
    this.elementType = elementType;
    this.elementId = elementId;
    this.elementName = elementName;
    this.sourceVersion = sourceVersion;
    this.targetVersion = targetVersion;
    this.changeType = changeType;
    this.fieldName = fieldName;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.impact = {
      economic: impact.economic || 0,
      technical: impact.technical || 'Sin impacto técnico identificado.',
      schedule: impact.schedule || 'Neutro',
      contractual: impact.contractual || 'Sin impacto contractual.',
      purchases: impact.purchases || 'Sin afectación a compras.',
      planning: impact.planning || 'Sin afectación a planificación.'
    };
    this.date = date;
    this.user = user;
    this.confidence = confidence;
    this.aiExplanation = aiExplanation;
  }
}

class Project {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    /** @type {Map<string, Version>} */
    this.versions = new Map();
    /** @type {Change[]} */
    this.changes = [];
  }

  addVersion(version) {
    this.versions.set(version.id, version);
  }

  getVersion(id) {
    return this.versions.get(id);
  }

  getSortedVersions() {
    return Array.from(this.versions.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  }
}

class RevisionManager {
  constructor() {
    this.projects = new Map();
    this.currentProjectId = null;
    this.listeners = {};
  }

  createProject(id, name) {
    const project = new Project(id, name);
    this.projects.set(id, project);
    if (!this.currentProjectId) {
      this.currentProjectId = id;
    }
    this.emit('projectCreated', project);
    return project;
  }

  getProject(id) {
    return this.projects.get(id);
  }

  getCurrentProject() {
    return this.projects.get(this.currentProjectId);
  }

  setCurrentProject(id) {
    if (this.projects.has(id)) {
      this.currentProjectId = id;
      this.emit('projectChanged', this.getProject(id));
    }
  }

  // Event dispatching
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}
