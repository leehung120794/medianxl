const { SlashCommandBuilder } = require('discord.js');
const { requireGameChannel } = require('../utils/gameChannel');
const { createHorseRace } = require('../services/horseRaceService');

module.exports = {
  data: new SlashCommandBuilder().setName('duangua').setDescription('Mở ván đua ngựa nhiều người, nhận cược trong 30 giây'),
  async execute(interaction) {
    if (!await requireGameChannel(interaction, 'duangua')) return null;
    return createHorseRace(interaction);
  },
};
