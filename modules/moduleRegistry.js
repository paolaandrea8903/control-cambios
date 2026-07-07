class ModuleRegistry {
  constructor() {
    this.modules = new Map();
  }

  /**
   * Register a new module.
   * @param {object} moduleInstance The module instance implementing the module interface.
   */
  registerModule(moduleInstance) {
    if (!moduleInstance.id) {
      throw new Error("Module must have an 'id' property.");
    }
    if (typeof moduleInstance.parse !== 'function') {
      throw new Error(`Module '${moduleInstance.id}' must implement the 'parse' method.`);
    }
    this.modules.set(moduleInstance.id, moduleInstance);
    console.log(`Module registered successfully: ${moduleInstance.name || moduleInstance.id}`);
  }

  getModule(id) {
    return this.modules.get(id);
  }

  getModules() {
    return Array.from(this.modules.values());
  }

  findModuleForFile(fileName) {
    const ext = '.' + fileName.split('.').pop().toLowerCase();
    for (const mod of this.modules.values()) {
      if (mod.supportedExtensions && mod.supportedExtensions.includes(ext)) {
        return mod;
      }
    }
    return null;
  }
}

// Global instance for registry
const moduleRegistry = new ModuleRegistry();
