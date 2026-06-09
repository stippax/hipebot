const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  Events,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder
} = require("discord.js");

const UPDATE_INTERVAL_MS = 60 * 1000;

function isSnowflake(value) {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

function isValidUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveConfig(config) {
  return {
    panelChannelId: isSnowflake(config.panelChannelId) ? config.panelChannelId : null,
    cityName: config.cityName || "EUFORIA ROLEPLAY",
    statusLabel: config.statusLabel || "ONLINE",
    statusColor: Number.isInteger(config.statusColor) ? config.statusColor : 0x57f287,
    ipLabel: config.ipLabel || "IP FiveM",
    serverIp: config.serverIp || "connect euforiarp.gg",
    updateText: config.updateText || "Atualizando a cada 1 minuto",
    timezone: config.timezone || "America/Sao_Paulo",
    bannerUrl: config.bannerUrl || null,
    thumbnailUrl: config.thumbnailUrl || null,
    accentColor: Number.isInteger(config.accentColor) ? config.accentColor : 0x1f6fff,
    buttons: Array.isArray(config.buttons) ? config.buttons.filter((button) => isValidUrl(button.url)) : []
  };
}

function formatTime(config, date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: config.timezone
  }).format(date);
}

function buildStatusContent(config, updatedAt) {
  return [
    "__**Status:**__",
    "",
    `\`\`\`ansi\n\u001b[2;32m\u25cf ${config.statusLabel}\u001b[0m\n\`\`\``,
    `__**${config.ipLabel}:**__`,
    "",
    `\`\`\`ansi\n\u001b[2;34m${config.serverIp}\u001b[0m\n\`\`\``,
    "",
    `**${config.updateText} | Ultima atualizacao: ${formatTime(config, updatedAt)}**`
  ].join("\n");
}

function buildButton(button) {
  return new ButtonBuilder()
    .setLabel(button.label || "Abrir")
    .setStyle(ButtonStyle.Link)
    .setURL(button.url);
}

function buildButtonRows(config) {
  const rows = [];
  let currentRow = new ActionRowBuilder();
  let currentCount = 0;

  for (const button of config.buttons.slice(0, 25)) {
    if (currentCount === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
      currentCount = 0;
    }

    currentRow.addComponents(buildButton(button));
    currentCount += 1;
  }

  if (currentCount > 0) {
    rows.push(currentRow);
  }

  return rows;
}

function buildStatusPanel(config, updatedAt = new Date()) {
  const container = new ContainerBuilder()
    .setAccentColor(config.accentColor);

  const header = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${config.cityName}`)
    );

  if (config.thumbnailUrl) {
    header.setThumbnailAccessory(
      new ThumbnailBuilder()
        .setURL(config.thumbnailUrl)
        .setDescription(`Logo ${config.cityName}`)
    );
  }

  container
    .addSectionComponents(header)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(buildStatusContent(config, updatedAt))
    );

  if (config.bannerUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(config.bannerUrl)
          .setDescription(`Banner ${config.cityName}`)
      )
    );
  }

  for (const row of buildButtonRows(config)) {
    container.addActionRowComponents(row);
  }

  return container;
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

function messageHasStatusPanel(message, config) {
  const firstButtonUrl = config.buttons[0]?.url;

  if (!firstButtonUrl) {
    return false;
  }

  return message.components.some((component) => componentTreeHasUrl(component, firstButtonUrl));
}

function buildPayload(config) {
  return {
    components: [buildStatusPanel(config)],
    flags: MessageFlags.IsComponentsV2
  };
}

async function fetchPanelMessage(client, config) {
  if (!config.panelChannelId) {
    console.warn("[status-servidor] panelChannelId nao configurado.");
    return null;
  }

  const channel = await client.channels.fetch(config.panelChannelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.warn(`[status-servidor] Canal de painel invalido: ${config.panelChannelId}.`);
    return null;
  }

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const existingMessage = messages?.find(
    (message) => message.author.id === client.user.id && messageHasStatusPanel(message, config)
  );

  if (existingMessage) {
    return existingMessage;
  }

  return channel.send(buildPayload(config));
}

async function updatePanel(client, config, state) {
  if (!state.message) {
    state.message = await fetchPanelMessage(client, config);
  }

  if (!state.message) {
    return;
  }

  state.message = await state.message.edit(buildPayload(config)).catch(async (error) => {
    console.error("[status-servidor] Falha ao atualizar painel de status.", error);
    return fetchPanelMessage(client, config);
  });
}

async function register({ client, config }) {
  const resolvedConfig = resolveConfig(config);
  const state = {
    interval: null,
    message: null
  };

  client.once(Events.ClientReady, async () => {
    await updatePanel(client, resolvedConfig, state).catch((error) => {
      console.error("[status-servidor] Falha ao preparar painel de status.", error);
    });

    state.interval = setInterval(() => {
      updatePanel(client, resolvedConfig, state).catch((error) => {
        console.error("[status-servidor] Falha ao atualizar painel de status.", error);
      });
    }, UPDATE_INTERVAL_MS);
  });
}

module.exports = {
  register
};
