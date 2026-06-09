const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  Events,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder
} = require("discord.js");

function isSnowflake(value) {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

function resolveConfig(config) {
  return {
    panelChannelId: isSnowflake(config.panelChannelId) ? config.panelChannelId : null,
    title: config.title || "Iniciar Allowlist",
    description: config.description || "Clique no botao abaixo para iniciar sua allowlist e entrar na cidade.",
    buttonLabel: config.buttonLabel || "Allowlist",
    allowlistUrl: config.allowlistUrl || "http://localhost:3000/allowlistw",
    thumbnailUrl: config.thumbnailUrl || "https://cdn.discordapp.com/embed/avatars/0.png",
    accentColor: Number.isInteger(config.accentColor) ? config.accentColor : 0x2ecc71
  };
}

function buildAllowlistPanel(config) {
  return new ContainerBuilder()
    .setAccentColor(config.accentColor)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${config.title}`),
          new TextDisplayBuilder().setContent(config.description)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(config.thumbnailUrl)
            .setDescription("Allowlist")
        )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Ao finalizar, aguarde a avaliacao da equipe responsavel.")
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(config.buttonLabel)
          .setStyle(ButtonStyle.Link)
          .setURL(config.allowlistUrl)
      )
    );
}

function componentTreeHasUrl(component, url) {
  if (!component) {
    return false;
  }

  if (component.url === url) {
    return true;
  }

  if (Array.isArray(component.components)) {
    return component.components.some((child) => componentTreeHasUrl(child, url));
  }

  if (Array.isArray(component.accessory?.components)) {
    return component.accessory.components.some((child) => componentTreeHasUrl(child, url));
  }

  return false;
}

function messageHasAllowlistButton(message, config) {
  return message.components.some((component) => componentTreeHasUrl(component, config.allowlistUrl));
}

async function ensurePanel(client, config) {
  if (!config.panelChannelId) {
    console.warn("[iniciarallowlist] panelChannelId nao configurado.");
    return;
  }

  const channel = await client.channels.fetch(config.panelChannelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.warn(`[iniciarallowlist] Canal de painel invalido: ${config.panelChannelId}.`);
    return;
  }

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const existingMessage = messages?.find(
    (message) => message.author.id === client.user.id && messageHasAllowlistButton(message, config)
  );

  const payload = {
    components: [buildAllowlistPanel(config)],
    flags: MessageFlags.IsComponentsV2
  };

  if (existingMessage) {
    await existingMessage.edit(payload);
    return;
  }

  await channel.send(payload);
}

async function register({ client, config }) {
  const resolvedConfig = resolveConfig(config);

  client.once(Events.ClientReady, async () => {
    await ensurePanel(client, resolvedConfig).catch((error) => {
      console.error("[iniciarallowlist] Falha ao preparar painel de allowlist.", error);
    });
  });
}

module.exports = {
  register
};
