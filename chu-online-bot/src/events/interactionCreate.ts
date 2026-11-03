import { Events, Interaction } from 'discord.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`Không tìm thấy lệnh ${interaction.commandName}.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Lỗi khi thực hiện lệnh ${interaction.commandName}:`, error);
        const errorMessage = 'Có lỗi xảy ra khi thực hiện lệnh này. Vui lòng thử lại sau.';

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    } else if (interaction.isButton()) {
      // Handle button interactions
      const customId = interaction.customId;
      const [type, ...params] = customId.split(':');

      try {
        const buttonHandlerPath = `../interactions/buttons/${type}.ts`;
        const module = await import(buttonHandlerPath);
        await module.default.execute(interaction, params);
      } catch (error) {
        console.error(`Lỗi khi xử lý button ${customId}:`, error);
        const errorMessage = 'Có lỗi xảy ra. Vui lòng thử lại sau.';

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    } else if (interaction.isStringSelectMenu()) {
      // Handle select menu interactions
      const customId = interaction.customId;
      const [type, ...params] = customId.split(':');

      try {
        const selectHandlerPath = `../interactions/buttons/${type}.ts`;
        const module = await import(selectHandlerPath);
        await module.default.execute(interaction, params);
      } catch (error) {
        console.error(`Lỗi khi xử lý select menu ${customId}:`, error);
        const errorMessage = 'Có lỗi xảy ra. Vui lòng thử lại sau.';

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    }
  },
};
