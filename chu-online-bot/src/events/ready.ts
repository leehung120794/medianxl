import { Events } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: any) {
    console.log(`✅ Bot đã sẵn sàng! Đăng nhập là ${client.user.tag}`);
  },
};
