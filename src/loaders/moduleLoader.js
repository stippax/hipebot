const fs = require("node:fs");
const path = require("node:path");

async function loadModules(client) {
  const modulesRoot = path.resolve(__dirname, "../../modules");

  if (!fs.existsSync(modulesRoot)) {
    return { loadedModules: [], commandDefinitions: [] };
  }

  const moduleFolders = fs.readdirSync(modulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const loadedModules = [];
  const commandDefinitions = [];

  for (const folderName of moduleFolders) {
    const modulePath = path.join(modulesRoot, folderName, "index.js");
    const configPath = path.join(modulesRoot, folderName, "config.json");

    if (!fs.existsSync(modulePath)) {
      console.warn(`Modulo ignorado em ${folderName}: arquivo index.js nao encontrado.`);
      continue;
    }

    let moduleDefinition;

    try {
      moduleDefinition = require(modulePath);
    } catch (error) {
      console.error(`Modulo ignorado em ${folderName}: falha ao carregar.`, error);
      continue;
    }

    const config = fs.existsSync(configPath) ? require(configPath) : {};

    if (typeof moduleDefinition.register !== "function") {
      console.warn(`Modulo ignorado em ${folderName}: register() nao encontrado.`);
      continue;
    }

    if (typeof moduleDefinition.getCommands === "function") {
      try {
        const moduleCommands = moduleDefinition.getCommands(config, {
          modulePath: path.join(modulesRoot, folderName)
        });

        if (Array.isArray(moduleCommands)) {
          commandDefinitions.push(...moduleCommands);
        }
      } catch (error) {
        console.error(`Falha ao coletar comandos do modulo ${folderName}.`, error);
      }
    }

    await moduleDefinition.register({ client, config, modulePath: path.join(modulesRoot, folderName) });
    loadedModules.push(folderName);
  }

  return { loadedModules, commandDefinitions };
}

module.exports = {
  loadModules
};
