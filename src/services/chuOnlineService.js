const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../db");
const { getRealmById, getStageName, calculateRequiredCultivation, getBreakthroughRate } = require("../chu-online/config/realms");
const { getRootById, getRandomRoot } = require("../chu-online/config/spiritualRoots");
const { CULTIVATION_DURATIONS, RETREAT_DURATIONS, RETREAT_EFFICIENCY_MULTIPLIER } = require("../chu-online/config/cultivation");
const { TEMPLE_ACTIVITIES, getActivityById } = require("../chu-online/config/templeActivities");
const { getItemById } = require("../chu-online/config/items");

async function handleChuButton(interaction, logger) {
  const customId = interaction.customId;
  const parts = customId.split(":");
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (parts[0] !== "chu") return false;

  try {
    const character = db
      .prepare("SELECT * FROM chu_characters WHERE guild_id = ? AND user_id = ?")
      .get(guildId, userId);

    if (!character) {
      await interaction.reply({
        content: "Bạn chưa có nhân vật. Sử dụng lệnh `/chubatdau` để bắt đầu.",
        ephemeral: true,
      });
      return true;
    }

    const action = parts[1];
    const subAction = parts[2];

    if (action === "character") {
      if (subAction === "refresh") {
        // Refresh character info
        const realm = getRealmById(character.realm_id);
        const root = getRootById(character.spiritual_root_id);
        const stageName = getStageName(character.realm_stage);

        const nextStage = character.realm_stage < 9 ? character.realm_stage + 1 : 9;
        const requiredCultivation = calculateRequiredCultivation(realm.order, nextStage);
        const progress = character.cultivation < requiredCultivation
          ? Math.floor((character.cultivation / requiredCultivation) * 100)
          : 100;

        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle(`📜 Hồ Sơ Nhân Vật - ${character.dharma_name}`)
          .setDescription(
            `**Căn cốt:** ${root.name} (×${root.multiplier})\n` +
              `**Cảnh giới:** ${realm.name} - Tầng ${character.realm_stage} (${stageName})\n\n` +
              `**Tài nguyên:**\n` +
              `✨ Tu vi: ${character.cultivation} / ${requiredCultivation}\n` +
              `💎 Linh thạch: ${character.spirit_stone}\n` +
              `🙏 Công đức: ${character.merit}\n` +
              `💫 Đạo tâm: ${character.dao_heart}\n\n` +
              `**Thống kê:**\n` +
              `📊 Số lần đột phá: ${character.total_breakthroughs}\n` +
              `🔄 Số lần đổi căn cốt: ${character.root_changed_count}`
          )
          .addFields({ name: "Tiến độ tu vi", value: `▓▓▓▓▓▓▓▓▓▓ ${progress}%`, inline: false })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("chu:character:cultivate").setLabel("Tu luyện").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("chu:character:quests").setLabel("Nhiệm vụ").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:character:breakthrough").setLabel("Đột phá").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("chu:character:inventory").setLabel("Túi đồ").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("chu:character:refresh").setLabel("Làm mới").setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else {
        await interaction.update({
          content: "Chức năng này đang phát triển.",
          components: [],
        });
      }
    } else if (action === "cultivation") {
      if (subAction === "select_duration") {
        const selectedMinutes = parseInt(interaction.values[0]);
        const duration = CULTIVATION_DURATIONS.find((d) => d.minutes === selectedMinutes);

        if (!duration) {
          return interaction.update({
            content: "Thời gian không hợp lệ.",
            components: [],
          });
        }

        const now = Math.floor(Date.now() / 1000);
        const endsAt = now + duration.minutes * 60;
        const root = getRootById(character.spiritual_root_id);
        const sessionId = `${character.id}-${now}`;

        db.prepare(
          `INSERT INTO chu_cultivation_sessions (id, guild_id, character_id, session_type, started_at, ends_at, duration_seconds, base_reward, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          sessionId,
          guildId,
          character.id,
          "normal",
          now,
          endsAt,
          duration.minutes * 60,
          duration.baseReward,
          "running",
          now
        );

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle("🧘 Đã bắt đầu tu luyện")
          .setDescription(
            `Đạo hữu đã bắt đầu phiên tu luyện trong ${duration.minutes} phút.\n\n` +
              `**Thời gian bắt đầu:** ${new Date(now * 1000).toLocaleString("vi-VN")}\n` +
              `**Thời gian kết thúc:** ${new Date(endsAt * 1000).toLocaleString("vi-VN")}\n` +
              `**Thưởng cơ bản:** ${duration.baseReward} tu vi\n` +
              `**Hệ số căn cốt:** ×${root.multiplier}\n\n` +
              `Sử dụng lệnh \`/chunhantuvi\` để nhận phần thưởng khi phiên hoàn tất.`
          )
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      }
    } else if (action === "breakthrough") {
      if (subAction === "attempt") {
        const currentRealm = getRealmById(character.realm_id);
        const isMinorBreakthrough = character.realm_stage < 9;
        const nextStage = isMinorBreakthrough ? character.realm_stage + 1 : 1;
        const nextRealm = isMinorBreakthrough
          ? currentRealm
          : getRealmByOrder(currentRealm.order + 1);

        if (!nextRealm) {
          return interaction.update({
            content: "Đã đạt cảnh giới cao nhất.",
            components: [],
          });
        }

        const requiredCultivation = calculateRequiredCultivation(nextRealm.order, nextStage);
        const breakthroughRate = isMinorBreakthrough ? 100 : getBreakthroughRate(currentRealm.order);

        if (character.cultivation < requiredCultivation) {
          return interaction.update({
            content: `Tu vi không đủ. Cần ${requiredCultivation} tu vi.`,
            components: [],
          });
        }

        const success = Math.random() * 100 < breakthroughRate;
        const now = Math.floor(Date.now() / 1000);

        db.transaction(() => {
          if (success) {
            db.prepare(
              `UPDATE chu_characters SET realm_id = ?, realm_stage = ?, cultivation = cultivation - ?, total_breakthroughs = total_breakthroughs + 1, updated_at = ? WHERE id = ?`
            ).run(nextRealm.id, nextStage, requiredCultivation, now, character.id);

            db.prepare(
              `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              `${character.id}-breakthrough-${now}`,
              guildId,
              character.id,
              "cultivation",
              -requiredCultivation,
              "Breakthrough success",
              now
            );
          } else {
            const penalty = Math.round(requiredCultivation * 0.1);
            db.prepare(
              `UPDATE chu_characters SET cultivation = cultivation - ?, updated_at = ? WHERE id = ?`
            ).run(penalty, now, character.id);

            db.prepare(
              `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              `${character.id}-breakthrough-fail-${now}`,
              guildId,
              character.id,
              "cultivation",
              -penalty,
              "Breakthrough failed",
              now
            );
          }
        })();

        const stageName = getStageName(nextStage);

        if (success) {
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle("🎉 Đột Phá Thành Công!")
            .setDescription(
              `Chúc mừng đạo hữu đã đột phá thành công!\n\n` +
                `**Cảnh giới mới:** ${nextRealm.name} - Tầng ${nextStage} (${stageName})\n` +
                `**Tu vi tiêu hao:** ${requiredCultivation}`
            )
            .setTimestamp();

          await interaction.update({ embeds: [embed], components: [] });
        } else {
          const penalty = Math.round(requiredCultivation * 0.1);
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("❌ Đột Phá Thất Bại")
            .setDescription(
              `Đạo hữu đã đột phá thất bại.\n\n` +
                `**Phạt:** ${penalty} tu vi (10% của yêu cầu)\n` +
                `**Tu vi còn lại:** ${character.cultivation - penalty}\n\n` +
                `Đừng nản chí, hãy tiếp tục tu luyện và thử lại!`
            )
            .setTimestamp();

          await interaction.update({ embeds: [embed], components: [] });
        }
      } else if (subAction === "cancel") {
        await interaction.update({
          content: "Đã hủy đột phá.",
          components: [],
        });
      }
    } else if (action === "temple") {
      // Handle temple location buttons
      if (subAction === "main_hall") {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle("🏛️ Chính Điện")
          .setDescription(
            "Nơi trang nghiêm để đạo hữu lễ Phật và cầu nguyện.\n\n" +
              "Các hoạt động có thể thực hiện:"
          )
          .addFields(
            { name: "Thắp hương", value: "50 tu vi, 5 công đức (1 lần/ngày)", inline: true },
            { name: "Lễ Phật", value: "80 tu vi, 8 công đức (1 lần/ngày)", inline: true }
          )
          .setImage("assets/chu-online/locations/chinh-dien.png")
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("chu:temple:activity:thap_huong").setLabel("Thắp hương").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:temple:activity:le_phat").setLabel("Lễ Phật").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:temple:back").setLabel("Quay lại").setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (subAction === "zen_hall") {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle("🧘 Thiền Đường")
          .setDescription(
            "Nơi thanh tịnh để đạo hữu tĩnh tâm và tu dưỡng đạo tâm.\n\n" +
              "Các hoạt động có thể thực hiện:"
          )
          .addFields(
            { name: "Ngồi thiền", value: "200 tu vi, 5 đạo tâm (1 lần/ngày)", inline: true },
            { name: "Tụng kinh", value: "150 tu vi, 10 công đức, 2 đạo tâm (1 lần/ngày)", inline: true }
          )
          .setImage("assets/chu-online/locations/thien-duong.png")
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("chu:temple:activity:ngoi_thien").setLabel("Ngồi thiền").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:temple:activity:tung_kinh").setLabel("Tụng kinh").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:temple:back").setLabel("Quay lại").setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (subAction === "lotus_garden") {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle("🪷 Vườn Hoa Sen")
          .setDescription(
            "Vườn hoa sen tỏa hương thơm ngát, nơi đạo hữu chăm sóc để phát triển lòng từ bi.\n\n" +
              "Các hoạt động có thể thực hiện:"
          )
          .addFields({ name: "Chăm sóc hoa sen", value: "120 tu vi, 8 công đức (2 lần/ngày)", inline: true })
          .setImage("assets/chu-online/locations/vuon-hoa-sen.png")
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("chu:temple:activity:cham_hoa_sen").setLabel("Chăm sóc hoa sen").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:temple:back").setLabel("Quay lại").setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (subAction === "temple_grounds") {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle("🏛️ Sân Chùa")
          .setDescription(
            "Sân chùa rộng lớn, nơi đạo hữu quét dọn để tích lũy công đức.\n\n" +
              "Các hoạt động có thể thực hiện:"
          )
          .addFields(
            { name: "Quét sân chùa", value: "100 tu vi, 10 công đức (2 lần/ngày)", inline: true },
            { name: "Công quả", value: "300 tu vi, 20 công đức, 5 đạo tâm (1 lần/ngày)", inline: true }
          )
          .setImage("assets/chu-online/locations/san-chua.png")
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("chu:temple:activity:quet_san").setLabel("Quét sân chùa").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:temple:activity:cong_qua").setLabel("Công quả").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("chu:temple:back").setLabel("Quay lại").setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (subAction === "back") {
        // Return to main temple map
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle("🏯 Chùa Online - Bản Đồ")
          .setDescription(
            "Chào mừng đạo hữu đến với chùa chúng tôi.\n\n" +
              "Đây là nơi đạo hữu có thể tham gia các hoạt động tu dưỡng," +
              " tích lũy công đức và đạo tâm.\n\n" +
              "Chọn một địa điểm để bắt đầu:"
          )
          .addFields(
            { name: "Chính Điện", value: "Lễ Phật, nhận công đức", inline: true },
            { name: "Thiền Đường", value: "Ngồi thiền, nhận đạo tâm", inline: true },
            { name: "Vườn Hoa Sen", value: "Chăm sóc hoa sen", inline: true },
            { name: "Sân Chùa", value: "Quét sân chùa", inline: true }
          )
          .setImage("assets/chu-online/locations/chua.png")
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("chu:temple:main_hall").setLabel("Chính Điện").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("chu:temple:zen_hall").setLabel("Thiền Đường").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("chu:temple:lotus_garden").setLabel("Vườn Hoa Sen").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("chu:temple:temple_grounds").setLabel("Sân Chùa").setStyle(ButtonStyle.Primary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (subAction === "activity") {
        const activityId = parts[3];
        const activity = getActivityById(activityId);

        if (!activity) {
          return interaction.update({
            content: "Hoạt động không tồn tại.",
            components: [],
          });
        }

        // Check daily limit
        const today = new Date().toISOString().split("T")[0];
        const activityLogs = db
          .prepare(
            `SELECT * FROM chu_activity_logs WHERE character_id = ? AND activity_id = ? AND created_at >= ?`
          )
          .all(character.id, activityId, Math.floor(new Date(today).getTime() / 1000));

        if (activityLogs.length >= activity.dailyLimit) {
          return interaction.update({
            content: `Bạn đã đạt giới hạn cho hoạt động này hôm nay (${activity.dailyLimit} lần).`,
            components: [],
          });
        }

        // Calculate rewards
        const root = getRootById(character.spiritual_root_id);
        const rootMultiplier = root?.multiplier || 1;
        const actualCultivation = Math.floor(activity.baseCultivationReward * rootMultiplier);
        const now = Math.floor(Date.now() / 1000);

        // Update in transaction
        db.transaction(() => {
          // Update character
          db.prepare(
            `UPDATE chu_characters SET cultivation = cultivation + ?, merit = merit + ?, dao_heart = dao_heart + ?, updated_at = ? WHERE id = ?`
          ).run(actualCultivation, activity.meritReward, activity.daoHeartReward, now, character.id);

          // Log activity
          db.prepare(
            `INSERT INTO chu_activity_logs (id, guild_id, character_id, activity_id, base_cultivation, actual_cultivation, merit_reward, dao_heart_reward, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            `${character.id}-${activityId}-${now}`,
            guildId,
            character.id,
            activityId,
            activity.baseCultivationReward,
            actualCultivation,
            activity.meritReward,
            activity.daoHeartReward,
            now
          );

          // Log transactions
          if (actualCultivation > 0) {
            db.prepare(
              `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              `${character.id}-activity-${activityId}-${now}`,
              guildId,
              character.id,
              "cultivation",
              actualCultivation,
              `Temple activity: ${activity.name}`,
              now
            );
          }

          if (activity.meritReward > 0) {
            db.prepare(
              `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              `${character.id}-activity-merit-${activityId}-${now}`,
              guildId,
              character.id,
              "merit",
              activity.meritReward,
              `Temple activity: ${activity.name}`,
              now
            );
          }

          if (activity.daoHeartReward > 0) {
            db.prepare(
              `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              `${character.id}-activity-daoheart-${activityId}-${now}`,
              guildId,
              character.id,
              "dao_heart",
              activity.daoHeartReward,
              `Temple activity: ${activity.name}`,
              now
            );
          }
        })();

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`✅ Hoàn thành: ${activity.name}`)
          .setDescription(
            `Đạo hữu đã hoàn thành hoạt động ${activity.name}.\n\n` +
              `**Phần thưởng:**\n` +
              `✨ Tu vi: ${actualCultivation} (cơ bản: ${activity.baseCultivationReward} × ${rootMultiplier})\n` +
              `🙏 Công đức: ${activity.meritReward}\n` +
              `💫 Đạo tâm: ${activity.daoHeartReward}\n\n` +
              `Số lần thực hiện hôm nay: ${activityLogs.length + 1}/${activity.dailyLimit}`
          )
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      }
    } else if (action === "shop") {
      if (subAction === "buy") {
        const itemId = parts[3];
        const item = getItemById(itemId);

        if (!item) {
          return interaction.update({
            content: "Vật phẩm không tồn tại.",
            components: [],
          });
        }

        if (character.spirit_stone < item.priceSpiritStone) {
          return interaction.update({
            content: `Linh thạch không đủ. Cần ${item.priceSpiritStone} linh thạch.`,
            components: [],
          });
        }

        const now = Math.floor(Date.now() / 1000);

        // Purchase in transaction
        db.transaction(() => {
          // Deduct spirit stones
          db.prepare(
            `UPDATE chu_characters SET spirit_stone = spirit_stone - ?, updated_at = ? WHERE id = ?`
          ).run(item.priceSpiritStone, now, character.id);

          // Add or update inventory
          const existingInventory = db
            .prepare("SELECT * FROM chu_inventory WHERE character_id = ? AND item_id = ?")
            .get(character.id, itemId);

          if (existingInventory) {
            db.prepare("UPDATE chu_inventory SET quantity = quantity + 1, updated_at = ? WHERE id = ?").run(
              now,
              existingInventory.id
            );
          } else {
            db.prepare(
              `INSERT INTO chu_inventory (id, guild_id, character_id, item_id, quantity, updated_at)
               VALUES (?, ?, ?, ?, 1, ?)`
            ).run(`${character.id}-${itemId}-${now}`, guildId, character.id, itemId, now);
          }

          // Ensure item exists in database
          const existingItem = db.prepare("SELECT * FROM chu_items WHERE id = ?").get(itemId);
          if (!existingItem) {
            db.prepare(
              `INSERT INTO chu_items (id, name, description, item_type, price_spirit_stone, enabled)
               VALUES (?, ?, ?, ?, ?, 1)`
            ).run(item.id, item.name, item.description, item.itemType, item.priceSpiritStone);
          }

          // Log transaction
          db.prepare(
            `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(
            `${character.id}-purchase-${itemId}-${now}`,
            guildId,
            character.id,
            "spirit_stone",
            -item.priceSpiritStone,
            `Purchase: ${item.name}`,
            now
          );
        })();

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle("✅ Mua Thành Công")
          .setDescription(
            `Đạo hữu đã mua thành công ${item.name}.\n\n` +
              `**Giá:** ${item.priceSpiritStone} linh thạch\n` +
              `**Linh thạch còn lại:** ${character.spirit_stone - item.priceSpiritStone}\n\n` +
              `Sử dụng lệnh \`/chutuido\` để xem và sử dụng vật phẩm.`
          )
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      }
    } else if (action === "inventory") {
      if (subAction === "use") {
        const itemId = parts[3];

        if (itemId === "dan_nghich_thien") {
          const inventoryItem = db
            .prepare("SELECT * FROM chu_inventory WHERE character_id = ? AND item_id = ?")
            .get(character.id, itemId);

          if (!inventoryItem || inventoryItem.quantity < 1) {
            return interaction.update({
              content: "Bạn không có vật phẩm này.",
              components: [],
            });
          }

          const oldRoot = getRootById(character.spiritual_root_id);

          // Show confirmation
          const embed = new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle("⚠️ Xác Nhận Sử Đụng Đan Dược Nghịch Thiên")
            .setDescription(
              `Bạn đang sử dụng Đan Dược Nghịch Thiên để thay đổi căn cốt.\n\n` +
                `**Căn cốt hiện tại:** ${oldRoot.name} (×${oldRoot.multiplier})\n\n` +
                `⚠️ Lưu ý: Đan Dược Nghịch Thiên không đảm bảo căn cốt mới tốt hơn căn cốt cũ.\n\n` +
                `Bạn có chắc chắn muốn tiếp tục?`
            )
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("chu:inventory:confirm_use:dan_nghich_thien")
              .setLabel("Xác nhận")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("chu:inventory:cancel_use").setLabel("Hủy").setStyle(ButtonStyle.Secondary)
          );

          await interaction.update({ embeds: [embed], components: [row] });
        }
      } else if (subAction === "confirm_use") {
        const itemId = parts[3];

        if (itemId === "dan_nghich_thien") {
          const oldRoot = getRootById(character.spiritual_root_id);
          const newRoot = getRandomRoot();
          const now = Math.floor(Date.now() / 1000);

          // Update in transaction
          db.transaction(() => {
            // Update character spiritual root
            db.prepare(
              `UPDATE chu_characters SET spiritual_root_id = ?, root_changed_count = root_changed_count + 1, updated_at = ? WHERE id = ?`
            ).run(newRoot.id, now, character.id);

            // Remove item from inventory
            const inventoryItem = db
              .prepare("SELECT * FROM chu_inventory WHERE character_id = ? AND item_id = ?")
              .get(character.id, itemId);

            if (inventoryItem) {
              if (inventoryItem.quantity > 1) {
                db.prepare("UPDATE chu_inventory SET quantity = quantity - 1, updated_at = ? WHERE id = ?").run(
                  now,
                  inventoryItem.id
                );
              } else {
                db.prepare("DELETE FROM chu_inventory WHERE id = ?").run(inventoryItem.id);
              }
            }

            // Log root change
            db.prepare(
              `INSERT INTO chu_root_change_logs (id, guild_id, character_id, old_root_id, new_root_id, item_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              `${character.id}-root-change-${now}`,
              guildId,
              character.id,
              oldRoot.id,
              newRoot.id,
              itemId,
              now
            );

            // Ensure new root exists in database
            const existingRoot = db.prepare("SELECT * FROM chu_spiritual_roots WHERE id = ?").get(newRoot.id);
            if (!existingRoot) {
              db.prepare(
                `INSERT INTO chu_spiritual_roots (id, name, chance, multiplier)
                 VALUES (?, ?, ?, ?)`
              ).run(newRoot.id, newRoot.name, newRoot.chance, newRoot.multiplier);
            }
          })();

          const realm = getRealmById(character.realm_id);
          const stageName = getStageName(character.realm_stage);

          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle("🎲 Đã Thay Đổi Căn Cốt")
            .setDescription(
              `Đạo hữu đã sử dụng Đan Dược Nghịch Thiên.\n\n` +
                `**Căn cốt cũ:** ${oldRoot.name} (×${oldRoot.multiplier})\n` +
                `**Căn cốt mới:** ${newRoot.name} (×${newRoot.multiplier})\n\n` +
                `Số lần đổi căn cốt: ${character.root_changed_count + 1}\n\n` +
                `Cảnh giới hiện tại: ${realm.name} - Tầng ${character.realm_stage} (${stageName})`
            )
            .setTimestamp();

          await interaction.update({ embeds: [embed], components: [] });
        }
      } else if (subAction === "cancel_use") {
        // Return to inventory view - refresh
        const inventory = db
          .prepare(`
            SELECT ci.*, i.name, i.description
            FROM chu_inventory ci
            JOIN chu_items i ON ci.item_id = i.id
            WHERE ci.character_id = ?
          `)
          .all(character.id);

        if (inventory.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0xB89B62)
            .setTitle("🎒 Túi Đồ")
            .setDescription("Túi đồ của bạn đang trống.")
            .setTimestamp();

          return interaction.update({ embeds: [embed], components: [] });
        }

        const itemsList = inventory.map((inv) => {
          return `**${inv.name}** (x${inv.quantity})\n${inv.description}`;
        }).join("\n\n");

        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle("🎒 Túi Đồ")
          .setDescription(itemsList)
          .setTimestamp();

        const rows = inventory.map((inv) => {
          return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`chu:inventory:use:${inv.item_id}`)
              .setLabel(`Sử dụng ${inv.name}`)
              .setStyle(ButtonStyle.Success)
          );
        });

        await interaction.update({ embeds: [embed], components: rows });
      }
    } else {
      await interaction.update({
        content: "Chức năng này đang phát triển.",
        components: [],
      });
    }

    return true;
  } catch (error) {
    logger.error({ err: error }, "chu online button failed");
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
    return true;
  }
}

module.exports = { handleChuButton };
