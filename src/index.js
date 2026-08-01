const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.resolve(process.cwd(), envFile);

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const { Client, Events, GatewayIntentBits, Partials } = require("discord.js");
const { loadModules } = require("./loaders/moduleLoader");
const { loadServerInstances } = require("./loaders/serverLoader");

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
      Partials.GuildMember,
      Partials.Channel,
      Partials.Message,
      Partials.Reaction
    ]
  });
}

async function syncApplicationCommands(client, commandDefinitions, guildId) {
  if (!client.application) {
    return;
  }

  const commands = commandDefinitions
    .filter((definition) => definition?.command)
    .map((definition) => definition.command);

  // Multi-instance commands are always scoped to the configured guild.
  await client.application.commands.set([]);
  await client.application.commands.set(commands, guildId);
}

async function prepareInstance(instance) {
  const client = createClient();
  const { loadedModules, commandDefinitions } = await loadModules(client, {
    guildId: instance.guildId,
    moduleConfigs: instance.moduleConfigs,
    serverName: instance.name,
    serverPath: instance.serverPath
  });

  client.loadedModules = loadedModules;

  client.once(Events.ClientReady, async () => {
    const prefix = `[${instance.name}]`;

    console.log(`${prefix} Bot conectado como ${client.user.tag}.`);
    console.log(`${prefix} Modulos carregados: ${loadedModules.join(", ") || "nenhum"}.`);

    try {
      await syncApplicationCommands(client, commandDefinitions, instance.guildId);
      console.log(`${prefix} Slash commands sincronizados com sucesso.`);
    } catch (error) {
      console.error(`${prefix} Falha ao sincronizar slash commands.`, error);
    }
  });

  return { client, instance };
}

async function bootstrap() {
  const instances = loadServerInstances();
  const preparedInstances = [];

  for (const instance of instances) {
    preparedInstances.push(await prepareInstance(instance));
  }

  await Promise.all(preparedInstances.map(({ client, instance }) => (
    client.login(instance.token)
  )));

  console.log(`${preparedInstances.length} instancia(s) iniciada(s).`);
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar os bots.", error);
  process.exit(1);
});
