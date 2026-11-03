import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// Load commands
client.commands = new Collection();

const commandsPath = join(__dirname, 'commands');
const commandFolders = readdirSync(commandsPath);

for (const folder of commandFolders) {
  const commandsPath = join(__dirname, 'commands', folder);
  const commandFiles = readdirSync(commandsPath).filter((file: string) => file.endsWith('.ts'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    import(filePath).then((module) => {
      if ('data' in module.default && 'execute' in module.default) {
        client.commands.set(module.default.data.name, module.default);
        console.log(`Loaded command: ${module.default.data.name}`);
      } else {
        console.log(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property.`);
      }
    }).catch((err) => {
      console.error(`Error loading command ${file}:`, err);
    });
  }
}

// Load events
const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter((file: string) => file.endsWith('.ts'));

for (const file of eventFiles) {
  const filePath = join(eventsPath, file);
  import(filePath).then((module) => {
    if (module.default.once) {
      client.once(module.default.name, (...args) => module.default.execute(...args));
    } else {
      client.on(module.default.name, (...args) => module.default.execute(...args));
    }
    console.log(`Loaded event: ${module.default.name}`);
  }).catch((err) => {
    console.error(`Error loading event ${file}:`, err);
  });
}

client.login(process.env.DISCORD_BOT_TOKEN);
