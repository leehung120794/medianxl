# Release changelog — Sinh tồn 999 tầng rework

**Ngày phát hành:** 02/10/2026  
**Phạm vi:** setup run, battle UI, combat, Rift Modifier, Luck, RNGesus, Wrong Portal, surprise event, payout và trang bị riêng.  
**Tương thích:** giữ session cũ trong SQLite; không cần migration hoặc xóa database.

## 1. Thay đổi người chơi nhìn thấy

- `/choi sinhton batdau` mở bảng riêng tư để chọn class và nhập cược. Xu chỉ bị giữ khi bấm **Bắt đầu**.
- Bảng chuẩn bị hết hạn sau 5 phút. Prefix `!sinhton <xu> <class>` vẫn dùng được.
- Battle card mới có thanh HP, màu trạng thái, loại damage và ý định đòn kế tiếp của quái.
- Thêm bảng riêng cho **Chỉ số**, **Thông tin quái**, **Rift** và **Trang bị**; các nút xem không tiêu tốn lượt.
- Phòng thủ giờ nhân đôi Defense, miễn chí mạng, giảm thêm 40% damage còn lại và hồi 1 Energy.
- Wrong Portal đổi thành tỷ lệ cố định 50% tốt / 50% xấu.
- Surprise event được mở rộng thành tối đa 15 loại.
- Các nút rèn, giải nguyền, Merchant, thuế và event mất payout hiển thị số xu thực tế.
- Trang bị Sinh tồn tách khỏi database Median XL chung và dùng catalog 100 món.
- UR tách riêng buff và curse; chỉ 2/16 UR giảm payout.
- `/choi sinhton tieptuc` giữ nguyên HP, payout, item, modifier và kết quả RNG đã roll.

## 2. Luồng bắt đầu run

Slash command hiện hành:

```text
/choi sinhton batdau
/choi sinhton tieptuc
/choi sinhton hoso [nguoidung]
/choi sinhton xephang
/choi sinhton tyle
```

Luồng `batdau`:

1. Chọn một trong bảy class.
2. Nhập tiền cược bằng modal.
3. Bấm **Bắt đầu** để kiểm tra lại số dư, giới hạn cược và session đang hoạt động.

```text
10 <= stake <= min(100.000, giới hạn cược hardcore của server)
```

Chọn class hoặc nhập cược chưa làm thay đổi balance. Chỉ bước xác nhận cuối mới giữ xu và tạo session.

## 3. Công thức chiến đấu

### Tỷ lệ đánh trúng

```text
hitChance = clamp(0,75 + (Accuracy - Evasion)*0,005; 0,20; 0,95)
```

### Chí mạng

```text
effectiveCrit = clamp(attackerCrit - critResistance; 0; 0,75)
rawPhysical = floor(baseDamage * skillMultiplier * (critical ? critDamage : 1))
```

- Crit damage người chơi: 1,75.
- Crit damage quái: 1,50.
- Phòng thủ cho 100% Crit Resistance trong đòn đó.

### Defense và vật lý

```text
defenseReduction = clamp(Defense / (Defense + 50 + floor*8); 0; 0,75)
physicalDamage = max(1; floor(rawPhysical * (1 - defenseReduction)))
defendDamage = max(1; floor(physicalDamage * 0,60))
```

### Resistance và phép

```text
effectiveResistance = clamp(Resistance; -50; 75)
magicDamage = max(1; floor(rawMagic * (1 - effectiveResistance/100)))
```

Cursed Ground trừ Resistance hiệu dụng. Paladin có Class Shrine được cộng 10 Resistance hiệu dụng. Phòng thủ tiếp tục giảm 40% damage phép sau Resistance.

### Item modifier

```text
damageToBoss  = floor(calculatedDamage * (1 + bossDamage))
damageToElite = floor(calculatedDamage * (1 + eliteDamage))
damageTaken   = floor(incomingDamage * (1 + damageTakenModifier))

healRate = clamp(0,35 + potionPower; 0,10; 0,75)
potionHeal = min(HP thiếu; max(20; floor(MaxHP*healRate)))
```

Boss damage áp dụng cho Boss/Final Boss; Elite damage áp dụng cho Elite/Ancient Mimic.

## 4. Scale quái

```text
early   = min(floor; 100)
overrun = max(0; floor - 100)
hpScale = 1 + early*0,065 + overrun*0,08
damageScale = 1 + early*0,04 + overrun*0,038

MaxHP = floor(28*hpScale*rankHpMultiplier)
DamageMin = floor(5*damageScale*rankDamageMultiplier)
DamageMax = floor(9*damageScale*rankDamageMultiplier)
Defense = floor(4 + floor*1,8*(boss ? 1,25 : 1))
Accuracy = 70 + floor*3
Evasion = 4 + floor(floor/12)
Resistance = min(60; floor(floor*0,8))
```

| Rank | HP | Damage | Reward |
| --- | ---: | ---: | ---: |
| Normal | ×1,00 | ×1,00 | ×1,00 |
| Champion | ×1,40 | ×1,15 | ×1,40 |
| Elite | ×2,00 | ×1,35 | ×2,00 |
| Boss | ×2,60–2,90 | ×1,10–1,25 | ×4,00 |
| Final Boss | ×7,20 | ×1,05 | ×10,00 |
| Mimic | ×1,70 | ×1,25 | ×1,80 |
| Ancient Mimic | ×2,80 | ×1,50 | ×3,00 |

HP và damage quái bị chặn ở 1.000.000.000.000.

## 5. Rift Modifier

Mỗi 10 tầng thêm một modifier. Bot phát đủ tám loại trước khi cho lặp và cộng stack.

| Modifier | Mỗi stack |
| --- | --- |
| Stone Skin | Defense quái ×1,10 |
| Elemental Dominion | +4% damage quái và +4 điểm % dùng phép |
| Bloodlust | Quái còn ≤50% HP gây thêm 8% damage |
| Unstable Rift | +2 điểm % encounter hòm, tăng Mimic và hòm tốt |
| Fortified | +10% Max HP quái |
| Swift Horror | +3 Accuracy, +1 Evasion |
| Soul Drain | Đòn trúng rút 1 Energy; từ stack 5 rút 2 |
| Cursed Ground | −4 Resistance hiệu dụng khi nhận phép |

```text
chestBoost = min(0,16; stack*0,02)
ancientMimic = min(0,08; 0,03 + stack*0,01)
totalMimic = min(0,30; 0,15 + stack*0,03)
treasureSSR = min(0,70; 0,35 + stack*0,05)
```

## 6. RNGesus và Luck

Tỷ lệ RNGesus nền: tầng 1–4 là 0%; 5–9 là 0,3%; 10–19 là 0,6%; từ 20 là 1%.

```text
volatility = 0,25 + random(0..1)*2,75
dryHeat = min(0,025; rngesusDry*0,0005)
chaosSpike = 2,5% cơ hội cộng ngẫu nhiên 0,04..0,10
finalChance = clamp(base*volatility + dryHeat + chaosSpike; 0; 0,12)
```

- Bỏ chạy: 75%; thất bại tự dùng Vé Thoát Hiểm nếu có.
- Cầu nguyện: 10% thành công, nhận 85% SSR hoặc 15% UR; trượt là chết.
- Hối lộ: còn 60% payout hiện tại.
- Dùng vé: mất một vé và vượt tầng an toàn.
- Chiến đấu: chết ngay.

Luck:

```text
SSR chance += Luck*0,002
Mimic detection = min(0,95; 0,25 + Luck*0,03 + itemDetection)
Goblin success = min(0,90; min(0,80; 0,60 + Luck*0,01) + itemBonus)
Lucky Break = min(0,30; Luck*0,015)
```

Lucky Break né Tax Collector hoặc Potion Thief. Luck không thay đổi Wrong Portal.

## 7. Wrong Portal 50/50

### Nhánh tốt

| Blessing | Hiệu ứng |
| --- | --- |
| Healing Sanctuary | +10 Max HP, hồi đầy, +1 bình tối đa 5 |
| Treasure Vault | +50% stake vào bonus payout |
| Rift Blessing | +4 Defense, +5 Resistance, +1 Luck |

### Nhánh xấu

| Penalty | Hiệu ứng |
| --- | --- |
| Blood Loss | Mất 15% Max HP, Portal không trực tiếp hạ dưới 1 HP |
| Energy Drain | Energy về 0 |
| Supply Loss | Mất tối đa 2 bình |
| Payout Corruption | Còn 90% payout |
| Dimensional Curse | Mất tối đa 5 Defense và 5 Resistance |

Sau penalty, người chơi phải đấu Rift Ambusher rank Elite và quái được đánh phủ đầu.

## 8. Catalog surprise event

Surprise chiếm 4% encounter cơ bản. Event chọn đều trong pool hợp lệ.

| Event | Logic |
| --- | --- |
| Wandering Healer | Hồi tối đa `max(20, floor(MaxHP*30%))`, +1 bình |
| Treasure Goblin | Base 60% thành công; thắng +25% stake, trượt mất 10% payout |
| Blacksmith | Tốn 12% payout để tăng item 1 level |
| Purifier | Tốn 20% payout, bỏ curse nhưng giữ buff |
| Altar of Sacrifice | Hiến 20% Max HP lấy +3 damage; hoặc 10% payout lấy +3 Defense |
| Cursed Gambler | Kết quả 50/50 pre-roll; cược 10% hoặc 25%, thắng nhận lại gấp đôi |
| Lost Adventurer | Cứu bằng 1 bình nhận R/SR; cướp có 25% nguy cơ nhận UR |
| Blood Fountain | 60% hồi đầy; 25% +15 Max HP; 15% Blood Mimic |
| Horadric Forge | Nghiền 1 level lấy +3 damage, +4 Defense, +10 HP hoặc +1 Vé với SSR/UR |
| Rift Merchant | Bán ngẫu nhiên 3/5 offer, trả bằng payout |
| Mirror of Fate | Đổi 10% HP lấy 10% damage; hoặc +8 Defense/−2 damage; đập gương 20% +2 Luck, 80% đấu clone |
| Treasure Room | Một trong ba hòm là Mimic; đỏ +5 damage, xanh +6 Defense/+5 Resistance, vàng +50% stake/+1 Luck |
| Rift Contract | Không potion, skill hoặc defend trong 3 tầng; vi phạm chỉ hủy thưởng |
| Class Shrine | Buff riêng theo class trong tối đa 3 tầng |
| Strange Doors | Cửa sáng/vàng tốt 70%; cửa đen tốt 60%; kết quả pre-roll |

Rift Merchant: bình 5%, hồi đầy 8%, +1 Luck 10%, item SR 15%, Vé Thoát Hiểm 25% payout.

Rift Contract:

- Không dùng bình: nhận SSR.
- Không dùng skill: +50% stake vào bonus.
- Không phòng thủ: +5 damage.

Class Shrine:

- Barbarian: +8 Defense khi HP ≤30%.
- Assassin: né chắc chắn đòn phản công kế tiếp rồi tiêu thụ hiệu ứng.
- Amazon: Barrage có 20% bắn phát thứ ba.
- Druid: hồi 5% Max HP khi hoàn tất tầng trong thời gian hiệu lực.
- Necromancer: hấp thụ đòn quái kế tiếp rồi tiêu thụ hiệu ứng.
- Paladin: +10 Resistance hiệu dụng khi nhận phép.
- Sorceress: skill kế tiếp miễn phí Energy rồi tiêu thụ hiệu ứng.

Strange Doors:

- Cửa sáng tốt: hồi đầy và +1 bình; xấu mất 20% Max HP nhưng không trực tiếp hạ dưới 1.
- Cửa vàng tốt: +50% stake; xấu thành Golden Door Mimic.
- Cửa đen tốt: nhận SSR; xấu gọi Premature Rift Boss.

Mọi kết quả ẩn được lưu trong state; restart bot không reroll.

## 9. Hòm, rarity và pity

Hòm cơ bản có 3% Ancient Mimic và tổng 15% Mimic. Nếu không phải Mimic:

| Kết quả | Tỷ lệ cơ bản |
| --- | ---: |
| SSR | 10% |
| UR | 3% |
| SR | 22% |
| R | 40% |
| Rỗng | 20% |
| SSR giả | 5% |

```text
ssrChance = min(0,35;
  0,10 + max(0, pityLegendary-9)*0,02 + Luck*0,002 + legendaryFind)
```

- Năm hòm không có SR trở lên bảo đảm lần kế tiếp tối thiểu SR.
- Hòm kho báu: 35% SSR, 65% SR trước Unstable Rift.
- Bán hòm cộng 15% stake vào bonus.

## 10. Catalog 100 item

| Rarity | Số lượng | Vai trò |
| --- | ---: | --- |
| R | 32 | Chỉ số nhỏ, hồi phục, utility |
| SR | 28 | Định hình build giữa run |
| SSR | 24 | Buff mạnh cho combat, Boss, rương và tài nguyên |
| UR | 16 | Buff rất mạnh kèm curse độc lập |

Item có `id`, `name`, `rarity`, `typeCode`, `category`, `tags`, `effects`, `text`. UR có thêm `curse { id, effects, text }`.

Effect hỗ trợ: Attack, Defense, Max HP, Resistance, Crit, Luck, Accuracy, Evasion, Energy, hồi máu, bình, vé, Potion Power, Boss/Elite Damage, phát hiện Mimic, bắt Goblin, Legendary Find, mất HP mỗi tầng, tăng Mimic và tăng damage nhận vào.

Giới hạn:

| Effect | Khoảng |
| --- | --- |
| Resistance | −50..75 |
| Crit | 0..75% |
| Potion Power | −30%..+50% |
| Boss/Elite Damage | 0..100% |
| Item Mimic Detection | 0..50% |
| Item Goblin Chance | 0..30% |
| Legendary Find | 0..25% |
| Floor HP Loss | 0..20% |
| Mimic Chance | 0..30% |
| Damage Taken | 0..50% |

Chỉ **Goblin’s Debt** (−15%) và **Crown of Ruin** (−10%) giảm payout. 14 UR còn lại dùng curse chiến đấu hoặc tài nguyên. Purifier hoàn đúng phần phạt thực tế đã áp dụng, kể cả khi chỉ số từng chạm 0 hoặc trần, và không xóa buff.

## 11. Payout

```text
f = min(cleared; 100)
cp = min(20; floor(f/5))
baseMultiplier = 1
  + min(f;50)*0,06
  + max(0;f-50)*0,10
  + cp*0,15

gross = floor((stake*baseMultiplier + bonus)*payoutFactor)
potentialPayout = max(0; min(10.000.000; gross) - payoutSpent)
```

| Cleared | Hệ số |
| ---: | ---: |
| 5 | 1,45 |
| 50 | 5,50 |
| 100+ | 12,00 |

Base multiplier dừng ở tầng 100. Bonus và payout modifier vẫn thay đổi trong Overrun. Chi phí event tăng `payoutSpent`; giảm theo tỷ lệ thay đổi `payoutFactor`. Số xu trên nút là chênh lệch payout trước và sau khi áp hiệu ứng.

## 12. Ổn định interaction và lưu phiên

- Action thay đổi state chạy trong transaction SQLite.
- Nút chứa session, turn và action; nút cũ có turn sai bị từ chối.
- Interaction cùng session được xử lý tuần tự.
- Encounter và kết quả RNG hiện tại nằm trong `state_json`.
- `tieptuc` chuyển run sang message mới mà không tạo lại encounter.
- Session cũ thiếu modifier item mới dùng giá trị 0 mặc định.
- Item cấu trúc cũ vẫn được đọc để không phá run đang chơi.

## 13. Class, skill và boss

| Class | HP | Damage | Defense | Accuracy | Evasion | Crit | Resist | Energy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Amazon | 100 | 16–23 | 5 | 92 | 14 | 14% | 5 | 3 |
| Barbarian | 120 | 15–21 | 8 | 80 | 8 | 10% | 5 | 3 |
| Assassin | 95 | 14–20 | 5 | 90 | 18 | 18% | 5 | 3 |
| Sorceress | 100 | 18–25 | 5 | 85 | 12 | 12% | 15 | 4 |
| Druid | 110 | 15–22 | 7 | 82 | 10 | 10% | 10 | 3 |
| Necromancer | 100 | 15–21 | 6 | 84 | 10 | 10% | 12 | 4 |
| Paladin | 115 | 15–22 | 9 | 84 | 7 | 9% | 15 | 3 |

Skill tốn 2 Energy:

- Amazon — Barrage: hai phát vật lý độc lập ×0,85.
- Barbarian — Iron Will: một đòn vật lý ×1,65.
- Assassin — Shadow Step: vật lý ×1,30 và né hoàn toàn phản công.
- Sorceress — Arcane Burst: phép ×2,10 qua Resistance.
- Druid — Wild Regeneration: hồi 12% Max HP rồi đánh vật lý ×1,35.
- Necromancer — Totem Ward: phép ×1,55 và chặn phản công.
- Paladin — Divine Shield: vật lý ×1,40 rồi vào trạng thái phòng thủ khi quái phản công.

Boss xuất hiện mỗi 50 tầng:

| Boss | Damage | Mechanic |
| --- | --- | --- |
| The Butcher | Physical | Mỗi lần ra đòn +8% damage, tối đa 5 stack |
| Ascendant Riftwalker | Magic | Rift Shield vô hiệu hóa đòn đầu mỗi chu kỳ ba lần người chơi tấn công |
| Assur | Physical | +18 Evasion và +12 điểm % Crit |
| Lucion | Magic | Hồi 35% damage thực tế đã gây |
| Deimoss the Fleshweaver | Physical | Abyssal Spires giảm 25% damage nhận vào |

Tầng 999 luôn tạo Deimoss dạng Final Boss và không cho bỏ qua.

## 14. Encounter, checkpoint và nâng cấp

Sau khi đã kiểm tra boss và RNGesus, pool cơ bản là:

| Encounter | Tỷ lệ |
| --- | ---: |
| Quái thường | 53% |
| Elite | 12% |
| Hòm thường | 10% |
| Shrine | 8% |
| Hòm kho báu | 5% |
| Trap | 6% |
| Surprise | 4% |
| Phòng trống | 2% |

Unstable Rift chuyển tối đa 16 điểm % từ quái thường sang hòm thường và hòm kho báu, chia đều cho hai nhóm hòm.

Khi hoàn tất tầng:

```text
cleared = max(cleared; floor)
bonus += floor(stake*0,01*rewardMultiplier)
energy = min(maxEnergy; energy+1)
```

Mỗi 5 tầng hồi đầy HP, nhận 2 bình tối đa 5 và tăng chỉ số:

| Vùng tầng | Max HP | Damage |
| --- | ---: | ---: |
| 5–95 | +6 | +1 |
| 100–395 | +10 | +2 |
| 400–695 | +14 | +3 |
| 700–995 | +30 | +6 |

Sau checkpoint, chọn đúng một nâng cấp: +5 damage, +30 Max HP và HP hiện tại, +6 Defense hoặc +2 Luck. Tầng 100 đặt `completed=true`; hạ tầng 999 chuyển sang phase `summit`.

## 15. Kiểm thử release

```text
npm test: PASS
Catalog: 100 item, đúng 32/28/24/16
Curse giảm payout: đúng 2
Smoke simulation: 25 run cho mỗi class tới tầng 30, PASS
git diff --check: PASS
```

Test mới kiểm tra setup, event, Rift, damage vật lý/phép, catalog, áp buff/curse, Purifier, tương thích item cũ và toàn bộ audit economy hiện có.

## 16. File triển khai

Runtime:

```text
src/hardcore/item.js
src/services/hardcoreEquipment.js
src/services/hardcoreEngine.js
src/services/hardcoreService.js
src/services/hardcoreView.js
src/services/hardcoreSetupService.js
src/commands/hardcore.js
src/commands/luat.js
src/componentRouter.js
```

Test và tài liệu:

```text
scripts/test-hardcore-setup.js
scripts/test-hardcore-events.js
scripts/test-hardcore-catalog.js
scripts/test-game-bot.js
scripts/test-median-item.js
package.json
docs/releases/2026-10-01-hardcore-survival-999.md
docs/releases/2026-10-01-hardcore-implementation-spec.md
docs/releases/2026-10-02-hardcore-survival-rework-changelog.md
```

Không cần thay hoặc làm trống SQLite. Do schema slash của `batdau` đã bỏ hai option bắt buộc, server cần chạy script đăng ký command một lần để Discord cập nhật giao diện lệnh.
