const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const {
  searchItems,
  autocompleteItems,
  getItemById,
} = require("../services/searchService");
const { detailEmbeds, suggestionResponse } = require("../utils/embeds");

const TYPES = [
  "ALL",
  "TU",
  "SU",
  "RW",
  "SET",
  "UMO",
  "CYCLE",
  "RELIC",
  "TROPHY",
];
module.exports = {
  data: new SlashCommandBuilder()
    .setName("item")
    .setDescription("Search Median XL items")
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("Tên item, base item hoặc stat")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Loại item")
        .addChoices(...TYPES.map((x) => ({ name: x, value: x }))),
    ),
  async autocomplete(interaction) {
    const query = interaction.options.getString("query") || "";
    const type = interaction.options.getString("type") || "ALL";
    const results = autocompleteItems({ query, type, limit: 25 });
    const choices = results.map((item) => ({
      name: `[${item.type_code}] ${item.name}`.slice(0, 100),
      value: item.name.slice(0, 100),
    }));
    return interaction.respond(
      choices.length
        ? choices
        : [
            {
              name: "Nhập tên hoặc keyword để tìm kiếm",
              value: query.slice(0, 100) || "item",
            },
          ],
    );
  },
  async execute(interaction) {
    const query = interaction.options.getString("query");
    const type = interaction.options.getString("type") || "ALL";
    const results = searchItems({ query, type, limit: 100 });
    if (!results.length)
      return interaction.reply({
        content: `Không tìm thấy item cho **${query}**.`,
        flags: MessageFlags.Ephemeral,
      });
    if (results.length === 1)
      return interaction.reply({ embeds: detailEmbeds(results[0]) });
    let page = 0;
    const response = suggestionResponse(
      results,
      query,
      interaction.user.id,
      page,
    );
    const callback = await interaction.reply({
      ...response,
      withResponse: true,
    });
    const message =
      callback.resource?.message || (await interaction.fetchReply());
    const collector = message.createMessageComponentCollector({
      time: 120_000,
      filter: (component) =>
        component.user.id === interaction.user.id &&
        (component.customId === `item-pick:${interaction.user.id}` ||
          component.customId.startsWith(`item-page:${interaction.user.id}:`) ||
          component.customId === `item-close:${interaction.user.id}`),
    });
    collector.on("collect", async (component) => {
      if (component.customId === `item-close:${interaction.user.id}`) {
        collector.stop("closed");
        return component.update({
          content: "Đã đóng danh sách kết quả.",
          embeds: [],
          components: [],
        });
      }
      if (component.customId.startsWith(`item-page:${interaction.user.id}:`)) {
        page = Number(component.customId.split(":").at(-1));
        return component.update(
          suggestionResponse(results, query, interaction.user.id, page),
        );
      }
      const item = getItemById(Number(component.values[0]));
      if (!item)
        return component.update({
          content: "Item không còn trong database.",
          embeds: [],
          components: [],
        });
      collector.stop("selected");
      return component.update({
        content: null,
        embeds: detailEmbeds(item),
        components: [],
      });
    });
    collector.on("end", async (_, reason) => {
      if (reason === "time")
        await message.edit({ components: [] }).catch(() => {});
    });
  },
};
