const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const envFiles = [".env.local", ".env"];

for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const { Client, Events, GatewayIntentBits, Partials } = require("discord.js");
const { loadModules } = require("./loaders/moduleLoader");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error("A variavel DISCORD_TOKEN nao foi definida no ambiente, .env.local ou .env.");
}

const client = new Client({
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

async function syncApplicationCommands(client, commandDefinitions) {
  if (!client.application) {
    return;
  }

  const globalCommands = [];
  const guildCommands = new Map();

  for (const definition of commandDefinitions) {
    if (!definition || !definition.command) {
      continue;
    }

    if (definition.guildId) {
      const commands = guildCommands.get(definition.guildId) || [];
      commands.push(definition.command);
      guildCommands.set(definition.guildId, commands);
      continue;
    }

    globalCommands.push(definition.command);
  }

  await client.application.commands.set(globalCommands);

  for (const guild of client.guilds.cache.values()) {
    const commands = guildCommands.get(guild.id) || [];
    await client.application.commands.set(commands, guild.id);
  }
}

async function bootstrap() {
  const { loadedModules, commandDefinitions } = await loadModules(client);
  client.loadedModules = loadedModules;

  client.once(Events.ClientReady, async () => {
    console.log(`Bot conectado como ${client.user.tag}.`);
    console.log(`Modulos carregados: ${loadedModules.join(", ") || "nenhum"}.`);

    try {
      await syncApplicationCommands(client, commandDefinitions);
      console.log("Slash commands sincronizados com sucesso.");
    } catch (error) {
      console.error("Falha ao sincronizar slash commands.", error);
    }
  });

  await client.login(token);
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar o bot.", error);
  process.exit(1);
});
