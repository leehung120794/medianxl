const { MessageFlags } = require("discord.js");
const tuTienCommands = require("./commands/tuTien");

function interactionKind(interaction) {
  if (interaction.isButton?.()) return "button";
  if (interaction.isStringSelectMenu?.() || interaction.isRoleSelectMenu?.())
    return "select";
  if (interaction.isModalSubmit?.()) return "modal";
  return null;
}

async function routeComponentInteraction(interaction) {
  const kind = interactionKind(interaction);
  if (!kind) return false;

  // Median XL search owns these collectors directly. Let its collector handle them.
  if (/^item-(?:pick|page|close):/.test(interaction.customId || ""))
    return false;

  if (String(interaction.customId || "").startsWith("chu:"))
    return tuTienCommands.handleComponent(interaction);

  await interaction.reply({
    content: "Chức năng này đã được gỡ khỏi bot.",
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

module.exports = { ROUTES: Object.freeze([]), interactionKind, routeComponentInteraction };
