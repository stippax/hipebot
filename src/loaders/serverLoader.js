const fs = require("node:fs");
const path = require("node:path");

function readJson(jsonPath) {
  let content;

  try {
    content = fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON invalido em ${jsonPath}.`, { cause: error });
  }
}

function requireNonEmptyString(value, fieldName, configPath) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo "${fieldName}" e obrigatorio em ${configPath}.`);
  }

  return value.trim();
}

function requireGuildId(value, configPath) {
  const guildId = requireNonEmptyString(value, "guildId", configPath);

  if (!/^\d{17,20}$/.test(guildId)) {
    throw new Error(`O campo "guildId" deve ser um ID valido do Discord em ${configPath}.`);
  }

  return guildId;
}

function requireTokenEnv(value, configPath) {
  const tokenEnv = requireNonEmptyString(value, "tokenEnv", configPath);

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tokenEnv)) {
    throw new Error(`O campo "tokenEnv" e invalido em ${configPath}.`);
  }

  return tokenEnv;
}

function loadModuleConfigs(modulesPath, serverName) {
  if (!fs.existsSync(modulesPath)) {
    throw new Error(`[${serverName}] Pasta de modulos nao encontrada: ${modulesPath}.`);
  }

  return fs.readdirSync(modulesPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const configPath = path.join(modulesPath, entry.name);
      const parsedConfig = readJson(configPath);

      if (!parsedConfig || Array.isArray(parsedConfig) || typeof parsedConfig !== "object") {
        throw new Error(`[${serverName}] A configuracao ${configPath} deve ser um objeto JSON.`);
      }

      return {
        name: path.basename(entry.name, ".json"),
        config: parsedConfig,
        configPath
      };
    });
}

function loadServerInstances(options = {}) {
  const serversRoot = options.serversRoot || path.resolve(__dirname, "../../servers");

  if (!fs.existsSync(serversRoot)) {
    throw new Error(`Pasta de instancias nao encontrada: ${serversRoot}.`);
  }

  const serverFolders = fs.readdirSync(serversRoot, { withFileTypes: true })
    .filter((entry) => (
      entry.isDirectory()
      && !entry.name.startsWith(".")
      && !entry.name.startsWith("_")
    ))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!serverFolders.length) {
    throw new Error(`Nenhuma instancia encontrada em ${serversRoot}.`);
  }

  const instances = serverFolders.map((folder) => {
    const serverPath = path.join(serversRoot, folder.name);
    const configPath = path.join(serverPath, "config.json");

    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuracao da instancia ausente: ${configPath}.`);
    }

    const config = readJson(configPath);

    if (!config || Array.isArray(config) || typeof config !== "object") {
      throw new Error(`A configuracao ${configPath} deve ser um objeto JSON.`);
    }

    const name = typeof config.name === "string" && config.name.trim()
      ? config.name.trim()
      : folder.name;
    const guildId = requireGuildId(config.guildId, configPath);
    const tokenEnv = requireTokenEnv(config.tokenEnv, configPath);
    const token = process.env[tokenEnv]?.trim();

    if (!token) {
      throw new Error(`[${name}] A variavel de ambiente ${tokenEnv} nao foi definida.`);
    }

    return {
      folderName: folder.name,
      guildId,
      moduleConfigs: loadModuleConfigs(path.join(serverPath, "modules"), name),
      name,
      serverPath,
      token,
      tokenEnv
    };
  });

  const seenTokens = new Set();

  for (const instance of instances) {
    if (seenTokens.has(instance.token)) {
      throw new Error(
        `[${instance.name}] O mesmo token foi configurado para mais de uma instancia.`
      );
    }

    seenTokens.add(instance.token);
  }

  return instances;
}

module.exports = {
  loadServerInstances
};
