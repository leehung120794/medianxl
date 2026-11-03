import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];
const commandsPath = join(__dirname, 'commands');
const commandFolders = readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = join(commandsPath, folder);
  const commandFiles = readdirSync(folderPath).filter((file: string) => file.endsWith('.ts'));

  for (const file of commandFiles) {
    const filePath = join(folderPath, file);
    const command = await import(filePath);

    if ('data' in command.default && 'execute' in command.default) {
      commands.push(command.default.data.toJSON());
      console.log(`Loaded command: ${command.default.data.name}`);
    } else {
      console.log(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }
}

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  try {
    console.log(`Đang bắt đầu đăng ký ${commands.length} lệnh slash.`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands },
    );

    console.log(`Đã đăng ký thành công ${data.length} lệnh slash.`);
  } catch (error) {
    console.error('Lỗi khi đăng ký lệnh:', error);
  }
})();
