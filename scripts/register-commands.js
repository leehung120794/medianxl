require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const item = require('../src/commands/item');
const sleep = require('../src/commands/sleep');
const status = require('../src/commands/status');
const breakpoint = require('../src/commands/breakpoint');
const compare = require('../src/commands/compare');
const xu = require('../src/commands/xu');
const hoso = require('../src/commands/hoso');
const baucua = require('../src/commands/baucua');
const oantuti = require('../src/commands/oantuti');
const taixiu = require('../src/commands/taixiu');
const blackjack = require('../src/commands/blackjack');
const duangua = require('../src/commands/duangua');
const mines = require('../src/commands/mines');
const hardcore = require('../src/commands/hardcore');
const noitu = require('../src/commands/noitu');
const vuatiengviet = require('../src/commands/vuatiengviet');
const game = require('../src/commands/game');
const doanitem = require('../src/commands/doanitem');
const trochoi = require('../src/commands/trochoi');
const shop = require('../src/commands/shop');
const buy = require('../src/commands/buy');
const inventory = require('../src/commands/inventory');
const use = require('../src/commands/use');
const collection = require('../src/commands/collection');
const craft = require('../src/commands/craft');
const giftitem = require('../src/commands/giftitem');
const anxin = require('../src/commands/anxin');
const nhiemvu = require('../src/commands/nhiemvu');
const sukien = require('../src/commands/sukien');
const xephang = require('../src/commands/xephang');
const sync = new SlashCommandBuilder().setName('sync').setDescription('Sync Median XL data (admin only)');
const update = new SlashCommandBuilder().setName('update').setDescription('Update Median XL database from Discord (admin only)');
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) throw new Error('DISCORD_TOKEN, CLIENT_ID and GUILD_ID are required');
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [
    item.data.toJSON(), compare.data.toJSON(), sleep.data.toJSON(), status.data.toJSON(), breakpoint.data.toJSON(),
    xu.data.toJSON(), hoso.data.toJSON(), baucua.data.toJSON(), oantuti.data.toJSON(), taixiu.data.toJSON(), blackjack.data.toJSON(), duangua.data.toJSON(), mines.data.toJSON(), hardcore.data.toJSON(), noitu.data.toJSON(), vuatiengviet.data.toJSON(),
    game.data.toJSON(),
    doanitem.data.toJSON(),
    trochoi.data.toJSON(),
    shop.data.toJSON(), buy.data.toJSON(), inventory.data.toJSON(), use.data.toJSON(),
    collection.data.toJSON(), craft.data.toJSON(), giftitem.data.toJSON(), anxin.data.toJSON(),
    nhiemvu.data.toJSON(), sukien.data.toJSON(), xephang.data.toJSON(),
    sync.toJSON(), update.toJSON(),
  ] });
  console.log('Guild commands registered');
})();
