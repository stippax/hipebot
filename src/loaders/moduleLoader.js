const fs = require("node:fs");
const path = require("node:path");

async function loadModules(client, options) {
  const {
    guildId,
    moduleConfigs,
    serverName,
    serverPath
  } = options;
  const modulesRoot = path.resolve(__dirname, "../../modules");
  const loadedModules = [];
  const commandDefinitions = [];

  for (const moduleConfig of moduleConfigs) {
    const moduleName = moduleConfig.name;
    const moduleRoot = path.join(modulesRoot, moduleName);
    const moduleEntryPath = path.join(moduleRoot, "index.js");

    if (!fs.existsSync(moduleEntryPath)) {
      throw new Error(
        `[${serverName}] Modulo "${moduleName}" nao encontrado em ${moduleEntryPath}.`
      );
    }

    let moduleDefinition;

    try {
      // Cada cliente recebe uma copia do modulo e do seu estado em memoria.
      delete require.cache[require.resolve(moduleEntryPath)];
      moduleDefinition = require(moduleEntryPath);
    } catch (error) {
      throw new Error(`[${serverName}] Falha ao carregar o modulo "${moduleName}".`, {
        cause: error
      });
    }

    if (typeof moduleDefinition.register !== "function") {
      throw new Error(`[${serverName}] O modulo "${moduleName}" nao exporta register().`);
    }

    const config = {
      ...moduleConfig.config,
      guildId
    };

    if (typeof moduleDefinition.getCommands === "function") {
      let moduleCommands;

      try {
        moduleCommands = moduleDefinition.getCommands(config, {
          modulePath: moduleRoot,
          serverName,
          serverPath
        });
      } catch (error) {
        throw new Error(
          `[${serverName}] Falha ao coletar comandos do modulo "${moduleName}".`,
          { cause: error }
        );
      }

      if (!Array.isArray(moduleCommands)) {
        throw new Error(
          `[${serverName}] getCommands() do modulo "${moduleName}" deve retornar um array.`
        );
      }

      commandDefinitions.push(...moduleCommands.map((definition) => ({
        ...definition,
        guildId
      })));
    }

    try {
      await moduleDefinition.register({
        client,
        config,
        modulePath: moduleRoot,
        serverName,
        serverPath
      });
    } catch (error) {
      throw new Error(`[${serverName}] Falha ao registrar o modulo "${moduleName}".`, {
        cause: error
      });
    }

    loadedModules.push(moduleName);
  }

  return { loadedModules, commandDefinitions };
}

module.exports = {
  loadModules
};
