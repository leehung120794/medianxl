# Sinh tồn 999 — đặc tả rework hệ thống bốn thuộc tính

**Ngày thiết kế:** 02/10/2026  
**Trạng thái:** Đề xuất đầy đủ, chưa triển khai vào gameplay  
**Phạm vi:** Nhân vật, công thức chiến đấu, checkpoint, trang bị, lời nguyền, sự kiện liên quan đến chỉ số, giao diện và mô phỏng cân bằng.

Tài liệu này mô tả phiên bản chỉ số mới của Sinh tồn 999 dựa trên bốn thuộc tính cốt lõi:

- **Strength (STR)**
- **Dexterity (DEX)**
- **Vitality (VIT)**
- **Energy (ENE)**

Người chơi chỉ trực tiếp xây dựng bốn thuộc tính này. HP, damage, Defense, Accuracy, Evasion, Critical, Resistance và Max Mana là chỉ số dẫn xuất do bot tự tính. Mục tiêu là để người chơi hiểu build ngay từ bốn con số, đồng thời mọi hướng build vẫn có giá trị từ tầng 1 đến tầng 999.

---

## 1. Nguyên tắc thiết kế

1. Bốn thuộc tính là nguồn sức mạnh chính của nhân vật.
2. Mỗi thuộc tính phải có ít nhất hai công dụng rõ ràng.
3. Chỉ số dẫn xuất luôn được tính lại từ nguồn, không cộng dồn trực tiếp vào state sau mỗi lần mở giao diện.
4. Công thức phải giải thích được bằng một hoặc hai dòng trên Discord.
5. Các giới hạn cứng ngăn né, kháng phép và chí mạng trở thành tuyệt đối.
6. Item quyết định hướng build nhưng không thay thế hoàn toàn điểm checkpoint.
7. Tỷ lệ vượt tầng 999 mục tiêu là **0,1–0,2%**, tuyệt đối không vượt **0,5%** trong mô phỏng chuẩn.

---

## 2. Bốn thuộc tính chính

| Thuộc tính | Công dụng chính | Công dụng phụ |
|---|---|---|
| Strength | Sát thương vật lý | Defense |
| Dexterity | Accuracy, Evasion | Critical và sát thương của Amazon/Assassin |
| Vitality | Max HP | Hiệu lực bình máu và một phần Defense |
| Energy | Sát thương phép | Resistance và Max Mana |

Luck tiếp tục tồn tại dưới dạng chỉ số đặc biệt từ item, Shrine và event. Người chơi không thể dùng điểm checkpoint để tăng trực tiếp Luck.

### 2.1. Phân biệt Energy và Mana

- **Energy (ENE)** là một trong bốn thuộc tính của build. Điểm ENE không bị tiêu hao khi dùng skill và Soul Drain không thể trừ ENE.
- **Mana** là tài nguyên chiến đấu có giá trị `mana/maxMana`. Skill tiêu Mana; Tấn công, Phòng thủ và hoàn thành tầng có thể hồi Mana.
- **Mana cost** là lượng Mana skill cần tiêu. Các skill hiện tại có Mana cost bằng 2.
- Item ghi `+Energy` làm tăng thuộc tính ENE. Item ghi `+Max Mana` chỉ tăng dung lượng tài nguyên dùng skill.

Trong code v2, không dùng tên `energy` cho tài nguyên chiến đấu. `attributes.energy` chỉ được dùng cho thuộc tính; tài nguyên phải dùng `mana` và `maxMana`.

### 2.2. Nguồn thuộc tính

Tổng thuộc tính được tính theo công thức:

```text
totalAttribute
  = classAttribute
  + checkpointAttribute
  + permanentEventAttribute
  + absorbedForgeAttribute
  + equipmentAttribute
  + temporaryAttribute
```

Không ghi `totalAttribute` cố định vào database. Bot tính lại từ các nguồn khi load run để tránh sai số và lỗi cộng hai lần.

---

## 3. Chỉ số khởi đầu của bảy class

Mỗi class bắt đầu với tổng cộng 80 điểm thuộc tính.

| Class | STR | DEX | VIT | ENE | Hướng chính |
|---|---:|---:|---:|---:|---|
| Amazon | 18 | 28 | 20 | 14 | DEX, nhiều phát đánh chính xác |
| Barbarian | 30 | 14 | 28 | 8 | STR/VIT, vật lý và chống chịu |
| Assassin | 18 | 30 | 18 | 14 | DEX, né và chí mạng |
| Sorceress | 10 | 16 | 20 | 34 | ENE, sát thương phép |
| Druid | 20 | 16 | 20 | 24 | STR/VIT, vật lý và hồi phục |
| Necromancer | 12 | 16 | 22 | 30 | ENE/VIT, phép và phòng thủ bằng Totem |
| Paladin | 26 | 14 | 24 | 16 | STR/VIT, Defense và Resistance |

Các thông số nền giữ bản sắc HP hiện tại:

| Class | Base HP | Base damage | Base RES | Base Mana | Base Crit |
|---|---:|---:|---:|---:|---:|
| Amazon | 40 | 16–23 | 2 | 3 | 11% |
| Barbarian | 36 | 15–21 | 3 | 3 | 8% |
| Assassin | 41 | 14–20 | 2 | 3 | 15% |
| Sorceress | 40 | 18–25 | 8 | 4 | 8% |
| Druid | 50 | 15–22 | 5 | 3 | 8% |
| Necromancer | 34 | 15–21 | 6 | 4 | 8% |
| Paladin | 43 | 15–22 | 12 | 3 | 7% |

`Base HP + VIT × 3` cho kết quả gần với lượng HP khởi đầu của phiên bản hiện tại.

---

## 4. Công thức chỉ số dẫn xuất

### 4.1. Max HP

```text
maxHp = classBaseHp + totalVIT*3 + flatMaxHp
```

Khi Max HP tăng do item hoặc thuộc tính, HP hiện tại tăng cùng lượng chênh lệch. Khi nguồn Max HP bị tháo hoặc lời nguyền làm giảm VIT, HP hiện tại bị clamp trong khoảng `1..maxHp` nếu run chưa kết thúc.

### 4.2. Tấn công thường — luôn là sát thương vật lý

Nút **Tấn công** của cả bảy class luôn gây sát thương vật lý, roll Accuracy, có thể Critical và bị Defense quái giảm. Tấn công thường hồi Mana sau khi xử lý đòn đánh, kể cả khi đòn bị trượt:

- Sorceress và Necromancer: hồi 2 Mana.
- Năm class còn lại: hồi 1 Mana.

```text
weaponPower = STR*strWeight + DEX*dexWeight
weaponBonus = floor(weaponPower*0.60) + flatPhysicalAttack
weaponDamageMin = classBaseDamageMin + weaponBonus
weaponDamageMax = classBaseDamageMax + weaponBonus
```

| Class | STR weight | DEX weight | Ý nghĩa |
|---|---:|---:|---|
| Barbarian | 1,00 | 0 | Vũ khí nặng scale hoàn toàn bằng STR |
| Amazon | 0,25 | 0,75 | Vũ khí tầm xa scale chủ yếu bằng DEX |
| Assassin | 0,30 | 0,70 | Vũ khí nhanh scale chủ yếu bằng DEX |
| Paladin | 0,90 | 0,10 | Đòn vật lý scale gần như hoàn toàn bằng STR |
| Druid | 0,80 | 0,20 | Đòn vật lý scale chủ yếu bằng STR |
| Necromancer | 0,70 | 0,30 | Đòn đánh thường yếu nếu chỉ build ENE |
| Sorceress | 0,70 | 0,30 | Đòn đánh thường yếu nếu chỉ build ENE |

Energy không làm đòn Tấn công gây damage vật lý mạnh hơn. Vì vậy Sorceress và Necromancer dùng Tấn công như một lượt đánh phụ để hồi Mana; nguồn sát thương chính của họ là kỹ năng phép.

### 4.3. Sát thương kỹ năng

Năm skill vật lý tiếp tục dùng `weaponDamageMin..weaponDamageMax`:

| Class | Skill | Loại | Công thức chính |
|---|---|---|---|
| Barbarian | Iron Will | Vật lý | Weapon damage ×1,65 |
| Amazon | Barrage | Vật lý | Hai phát độc lập, mỗi phát ×0,85 |
| Assassin | Shadow Step | Vật lý | Weapon damage ×1,30 và né phản công |
| Druid | Wild Regeneration | Vật lý | Weapon damage ×1,35 và hồi HP |
| Paladin | Divine Shield | Vật lý | Weapon damage ×1,40 và nhận trạng thái thủ |

Sorceress và Necromancer dùng một dải spell damage riêng:

```text
spellBonus = floor(totalENE*0.75) + flatSpellPower
spellDamageMin = classBaseDamageMin + spellBonus
spellDamageMax = classBaseDamageMax + spellBonus
```

| Class | Skill | Loại | Công thức chính |
|---|---|---|---|
| Sorceress | Arcane Burst | Phép | Spell damage ×2,10, luôn trúng, không Crit |
| Necromancer | Totem Ward | Phép | Spell damage ×1,55, luôn trúng, không Crit và chặn phản công |

Các multiplier của skill được áp dụng trước Defense hoặc Resistance. Boss Damage và Elite Damage được áp dụng sau phòng thủ/kháng của mục tiêu để cách hiển thị dễ kiểm chứng.

Damage phép phải được cân theo cả chu kỳ hồi Mana thay vì chỉ so một lần dùng skill. Với cùng ngân sách stat và item ở endgame:

- Chu kỳ `Tấn công + Arcane Burst` của Sorceress nên đạt 105–115% damage trung bình của một build vật lý thuần công tương đương.
- Chu kỳ `Tấn công + Totem Ward` của Necromancer nên đạt 80–95%, vì Totem Ward còn chặn hoàn toàn phản công.
- Phép bù việc không Critical bằng hệ số ENE cao, luôn trúng và khả năng đánh vào Resistance thay cho Defense.
- Nếu mô phỏng nằm ngoài khoảng trên, chỉnh `spellBonus` hoặc multiplier skill; không thêm Critical phép chỉ để bù damage.

### 4.4. Defense

```text
defense = floor(totalSTR*0.30 + totalVIT*0.15) + flatDefense

physicalReduction
  = clamp(defense / (defense + 100 + floor/2), 0, 0.70)

physicalDamage
  = max(1, floor(rawPhysicalDamage*(1 - physicalReduction)))
```

Defense tối đa giảm 70% sát thương vật lý. Tham số tầng làm build ít Defense yếu dần ở khu vực sâu nhưng không xóa giá trị Defense như công thức `floor × 8` cũ.

### 4.5. Accuracy và Evasion

```text
accuracy = floor(60 + totalDEX*1.20) + flatAccuracy
evasion  = floor(totalDEX*0.55) + flatEvasion

dodgeChance = clamp(evasion / (attackerAccuracy + evasion), 0.05, 0.45)
hitChance   = 1 - dodgeChance
```

- Mọi đòn dùng Accuracy có ít nhất 55% cơ hội trúng.
- Mọi mục tiêu có ít nhất 5% né.
- Tỷ lệ né tối đa là 45%.
- Skill ghi rõ `alwaysHit` bỏ qua Accuracy/Evasion.

Ví dụ quái có 100 Accuracy và người chơi có 50 Evasion:

```text
né = 50 / (100 + 50) = 33,3%
trúng = 66,7%
```

### 4.6. Critical

```text
critChance = clamp(classBaseCrit + totalDEX*0.001 + flatCritChance, 0, 0.60)
effectiveCrit = clamp(critChance - targetCritResistance, 0, 0.60)
criticalDamage = normalDamage*1.75
```

`totalDEX*0.001` nghĩa là 10 DEX cho 1 điểm phần trăm Critical.

Giới hạn đề xuất:

- Người chơi: 60%.
- Quái thường: 25%.
- Boss: 35%.
- Nút Phòng thủ: miễn Critical trong lượt đó.

### 4.7. Resistance

```text
resistance = clamp(classBaseResistance + floor(totalENE*0.20) + flatResistance, -30, 70)
magicDamage = max(1, floor(rawMagicDamage*(1 - resistance/100)))
```

Resistance âm làm tăng sát thương phép nhận vào. Cursed Ground và lời nguyền được tính vào `flatResistance` trước khi clamp.

### 4.8. Max Mana

```text
maxMana = clamp(classBaseMana + floor(totalENE/100) + flatMaxMana, 1, 10)
```

Khi Max Mana giảm, Mana hiện tại bị clamp theo giới hạn mới. Phòng thủ và hoàn thành tầng hồi 1 Mana. Tấn công thường hồi 2 Mana cho Sorceress/Necromancer và 1 Mana cho các class còn lại.

Việc caster hồi 2 Mana bảo đảm chu kỳ ổn định:

```text
Tấn công vật lý yếu → +2 Mana
Kỹ năng phép mạnh  → −2 Mana
```

Mana không được hồi thêm khi dùng Potion hoặc khi action thất bại trước transaction.

### 4.9. Bình máu

```text
vitalityPotionBonus = min(0.15, totalVIT*0.0005)
potionRate = clamp(0.35 + vitalityPotionBonus + flatPotionPower, 0.10, 0.75)
heal = max(20, floor(maxHp*potionRate))
```

100 VIT tăng thêm 5 điểm phần trăm hiệu lực bình; bonus từ VIT tối đa 15 điểm phần trăm.

---

## 5. Tăng trưởng chỉ số quái

HP và raw damage tiếp tục dùng `enemyScale` hiện tại trong lần triển khai đầu. Các chỉ số phòng thủ được thay đổi như sau:

```text
enemyAccuracy   = 70 + floor(floor/20) + swiftAccuracyBonus
enemyEvasion    = 5 + floor(floor/30) + swiftEvasionBonus
enemyDefense    = floor((10 + floor*0.40)*bossDefenseMultiplier*stoneSkinMultiplier)
enemyResistance = min(55, 5 + floor(floor/25) + bossResistanceBonus)
```

Sau khi áp catalog 100 item thật, mô phỏng cho thấy sức mạnh item làm late game dễ hơn dự kiến. Bản triển khai thêm hệ số hiệu chỉnh chỉ bắt đầu sau tầng 400:

```text
lateProgress = clamp((floor - 400)/599, 0, 1)
enemyHpLateMultiplier = 1 + lateProgress*0.50
enemyDamageLateMultiplier = 1 + lateProgress*0.90
```

Hệ số bằng `1` từ tầng 1–400 và đạt `1,50 HP / 1,90 damage` ở tầng 999. Mẫu kiểm chuẩn 700 run sau hiệu chỉnh ghi nhận 0 lượt vượt tầng 999, max tầng 969; cận trên xấp xỉ 95% theo quy tắc ba là `3/700 = 0,4286%`, thấp hơn trần bắt buộc 0,5%. Mẫu lớn hơn vẫn cần được chạy định kỳ để đo chính xác mục tiêu 0,1–0,2%.

`bossDefenseMultiplier` mặc định là `1.25` cho boss và `1` cho quái khác. Boss riêng có thể thay đổi bằng mechanic, nhưng phải hiển thị giá trị cuối cùng trong bảng Thông tin quái.

Swift Horror đổi thành:

```text
+4 Accuracy và +2 Evasion mỗi cộng dồn
```

Stone Skin tiếp tục tăng 10% Defense quái mỗi cộng dồn.

### 5.1. Rework Soul Drain

Soul Drain v1 rút 1 Mana sau mỗi đòn trúng và rút 2 từ năm cộng dồn. Ở late game, caster hồi 2 Mana bằng Tấn công rồi bị rút đúng 2 Mana, tạo vòng khóa không thể dùng skill. V2 bỏ cơ chế rút Mana vô hạn theo mỗi đòn. Soul Drain không bao giờ thay đổi thuộc tính Energy.

Khi tạo một combat encounter, số lần Soul Drain có thể kích hoạt được khóa vào quái:

```text
soulDrainCharges = min(3, ceil(soulDrainStacks/4))
```

| Số cộng dồn | Số lần kích hoạt trong mỗi trận |
|---:|---:|
| 0 | 0 |
| 1–4 | 1 |
| 5–8 | 2 |
| 9 trở lên | 3 |

Mỗi đòn quái đánh trúng:

1. Nếu còn charge, tiêu thụ đúng 1 charge.
2. Rút tối đa 1 Mana hiện có.
3. Không rút 2 Mana trong một lần.
4. Khi hết charge, Soul Drain không kích hoạt thêm trong trận đó.
5. Đòn trượt, đòn bị Shadow Step/Totem Ward chặn hoặc quái bị hạ trước khi phản công không tiêu thụ charge.

Ví dụ caster đang có 0 Mana và gặp Soul Drain 9 stack:

```text
Tấn công: +2 Mana → quái trúng, Soul Drain −1 → còn 1
Tấn công: +2 Mana → quái trúng, Soul Drain −1 → còn 2
Kỹ năng: −2 Mana → quái trúng khi Mana bằng 0, charge cuối vẫn bị tiêu thụ
```

Build phép bị chậm nhịp ở đầu trận nhưng không thể bị khóa skill vô hạn. Physical build vẫn chịu Soul Drain, nhưng có đòn đánh thường mạnh để tiếp tục chiến đấu.

---

## 6. Nút Phòng thủ

Phòng thủ đọc loại đòn đã được lưu trong `enemy.nextAttackType`:

- Đòn vật lý: Defense hiệu dụng ×2.
- Đòn phép: +15 Resistance tạm thời.
- Sau Defense/Resistance, giảm thêm 15% damage cuối.
- Miễn Critical.
- Hồi 1 Mana.
- Vẫn tính là một lượt và quái vẫn hành động.

```text
guardedDamage = max(1, floor(afterMitigationDamage*0.85))
```

Cơ chế này khiến nút Phòng thủ mạnh theo build của người chơi thay vì phụ thuộc chủ yếu vào mức giảm thẳng 40% như hiện tại.

---

## 7. Checkpoint và phân điểm

Mỗi 5 tầng:

1. Hồi đầy HP.
2. Hồi 2 bình, tối đa 5.
3. Nhận đúng 5 điểm thuộc tính.
4. Chọn một trong bốn nút:
   - `+5 Strength`
   - `+5 Dexterity`
   - `+5 Vitality`
   - `+5 Energy (ENE)`
5. Sang tầng kế tiếp sau khi chọn.

Loại bỏ phần tự động cộng HP và damage theo vùng. Từ tầng 1 đến 999 có 199 checkpoint, tương đương tối đa 995 điểm tự phân bổ. Điểm checkpoint là nguồn tăng trưởng ổn định; item và event tạo biến thể cho từng run.

State cần lưu riêng:

```json
{
  "attributes": { "strength": 18, "dexterity": 28, "vitality": 20, "energy": 14 },
  "checkpointAttributes": { "strength": 0, "dexterity": 0, "vitality": 0, "energy": 0 },
  "eventAttributes": { "strength": 0, "dexterity": 0, "vitality": 0, "energy": 0 }
}
```

---

## 8. Kiến trúc item mới

### 8.1. Schema

Item v2 dùng bốn key chính:

```js
{
  id: 'hunter_bow',
  name: 'Hunter Bow',
  rarity: 'common',
  typeCode: 'R',
  category: 'weapon',
  attributes: { dexterity: 5 },
  effects: { mimicDetection: 0.02 },
  curse: null
}
```

- `attributes`: STR/DEX/VIT/ENE, nhân theo level.
- `effects`: hiệu ứng đặc biệt hoặc flat modifier, chỉ dùng khi không thể biểu diễn bằng bốn thuộc tính.
- `curse.attributes`: thuộc tính âm, nhân theo level.
- `curse.effects`: lời nguyền đặc biệt, nhân theo level nếu effect cho phép.
- `text` được sinh từ dữ liệu; không duy trì một chuỗi thủ công có thể lệch hiệu ứng thật.

### 8.2. Level và item trùng

- Nhặt lần đầu tạo item Lv.1.
- Nhặt trùng tăng một level.
- Bonus thuộc tính được nhân với level.
- Resource tức thời như Potion hoặc Vé Thoát Hiểm được trao một lần cho mỗi lần nhặt, không trở thành stat tồn tại trong bảng trang bị.
- Lời nguyền UR tăng theo level giống phần có lợi, trừ hiệu ứng boolean/override.
- Purifier loại bỏ toàn bộ lời nguyền của item ở mọi level và đánh dấu `purified: true`.
- Horadric Forge nghiền một level: bonus của level đó chuyển sang `absorbedForgeAttributes/effects`, item giảm level nhưng sức mạnh đã hấp thụ tồn tại đến hết run.

### 8.3. Giới hạn hiệu ứng đặc biệt

| Hiệu ứng | Giới hạn tổng |
|---|---:|
| Boss Damage | +75% |
| Elite Damage | +75% |
| Mimic Detection | 80% |
| Goblin Catch | 80% |
| SSR Find | +25 điểm % |
| Potion Power từ item | +40 điểm % |
| Extra damage taken | +75% |
| Floor HP loss | 15% Max HP mỗi tầng |
| Max Mana | 10 sau mọi nguồn |

### 8.4. Ngân sách sức mạnh

| Rarity | Tổng thuộc tính mỗi level | Ghi chú |
|---|---:|---|
| R | 3–6 | Một hướng đơn giản hoặc utility nhỏ |
| SR | 8–14 | Hai hướng hoặc một special rõ ràng |
| SSR | 18–28 | Build-defining hoặc special mạnh |
| UR | 35–55 | Lợi ích rất lớn kèm lời nguyền |

Luck và special được định giá riêng, nên một số item utility có tổng bốn thuộc tính thấp hơn bảng.

---

## 9. Catalog R — 32 item

| ID / Item | Thuộc tính mới mỗi level | Hiệu ứng giữ lại |
|---|---|---|
| `rusted_edge` — Rusted Edge | +5 STR | — |
| `iron_dagger` — Iron Dagger | +1 STR, +4 DEX | — |
| `cracked_wand` — Cracked Wand | +5 ENE | — |
| `hunter_bow` — Hunter Bow | +5 DEX | — |
| `militia_spear` — Militia Spear | +3 STR, +2 DEX | — |
| `bone_club` — Bone Club | +6 STR, −1 DEX | — |
| `dented_plate` — Dented Plate | +3 STR, +2 VIT | — |
| `wooden_buckler` — Wooden Buckler | +2 STR, +2 VIT, +1 ENE | — |
| `worn_boots` — Worn Boots | +4 DEX | — |
| `copper_ring` — Copper Ring | +1 VIT, +4 ENE | — |
| `minor_life_charm` — Minor Life Charm | +5 VIT | Tăng HP hiện tại theo Max HP mới |
| `rabbit_foot` — Rabbit Foot | — | +1 Luck |
| `red_potion_belt` — Red Potion Belt | — | Nhận 1 Potion khi nhặt |
| `scout_lens` — Scout Lens | +2 DEX | +2% Mimic Detection |
| `mana_fragment` — Mana Fragment | +2 ENE | +1 Max Mana |
| `battle_token` — Battle Token | +2 STR, +2 VIT | — |
| `silver_thread` — Silver Thread | +2 DEX, +3 ENE | — |
| `traveler_map` — Traveler Map | +2 DEX | +1 Luck |
| `small_ward` — Small Ward | +2 STR, +3 VIT | — |
| `sharpening_stone` — Sharpening Stone | +5 STR | — |
| `ember_bead` — Ember Bead | +1 STR, +4 ENE | — |
| `fox_mask` — Fox Mask | +5 DEX | — |
| `oak_talisman` — Oak Talisman | +6 VIT | — |
| `glass_bead` — Glass Bead | +4 DEX | — |
| `field_bandage` — Field Bandage | — | Hồi 10 HP khi nhặt |
| `iron_nail` — Iron Nail | +3 STR, +2 VIT | — |
| `hawk_feather` — Hawk Feather | +5 DEX | — |
| `smoke_vial` — Smoke Vial | +5 DEX | — |
| `cold_ash` — Cold Ash | +5 ENE | — |
| `goblin_hook` — Goblin Hook | — | +2% Goblin Catch |
| `chest_chalk` — Chest Chalk | — | +3% Mimic Detection |
| `faded_clover` — Faded Clover | +2 VIT | +1 Luck |

---

## 10. Catalog SR — 28 item

| ID / Item | Thuộc tính mới mỗi level | Hiệu ứng giữ lại |
|---|---|---|
| `hunters_fang` — Hunter’s Fang | +4 STR, +6 DEX | — |
| `runed_carapace` — Runed Carapace | +5 STR, +4 VIT, +3 ENE | — |
| `heart_of_the_wild` — Heart of the Wild | +10 VIT | — |
| `lucky_coin` — Lucky Coin | +2 VIT | +3 Luck |
| `vanguard_spear` — Vanguard Spear | +6 STR, +6 DEX | — |
| `shadowstep_boots` — Shadowstep Boots | +10 DEX | — |
| `bone_talisman` — Bone Talisman | +7 VIT, +5 ENE | — |
| `bloodstone` — Bloodstone | +6 STR, +6 VIT | — |
| `rift_compass` — Rift Compass | +3 DEX | +2 Luck, +8% Mimic Detection |
| `alchemist_belt` — Alchemist Belt | +3 VIT | Nhận 1 Potion, +5 điểm % Potion Power |
| `guardian_seal` — Guardian Seal | +5 STR, +7 VIT | — |
| `mana_prism` — Mana Prism | +10 ENE | +1 Max Mana |
| `goblin_snare` — Goblin Snare | +3 DEX | +1 Luck, +8% Goblin Catch |
| `wardens_chain` — Warden’s Chain | +9 STR, +5 VIT, −2 DEX | — |
| `moonlit_blade` — Moonlit Blade | +5 STR, +7 ENE | — |
| `assassins_ribbon` — Assassin’s Ribbon | +11 DEX | — |
| `lionheart_emblem` — Lionheart Emblem | +5 STR, +8 VIT | — |
| `stormglass` — Stormglass | +5 STR, +8 DEX | — |
| `saints_ward` — Saint’s Ward | +4 STR, +3 VIT, +7 ENE | — |
| `riftwalkers_boots` — Riftwalker’s Boots | +10 DEX | +1 Luck |
| `executioners_mark` — Executioner’s Mark | +5 STR, +4 DEX | +12% Elite Damage |
| `boss_hunters_badge` — Boss Hunter’s Badge | +3 STR, +6 VIT | +12% Boss Damage |
| `golden_monocle` — Golden Monocle | +2 DEX | +3 điểm % SSR Find, +5% Mimic Detection |
| `deep_flask` — Deep Flask | +4 VIT | +10 điểm % Potion Power |
| `war_drums` — War Drums | +5 STR, +4 DEX, +3 VIT | — |
| `spirit_lantern` — Spirit Lantern | +10 ENE | +1 Max Mana |
| `steel_lotus` — Steel Lotus | +4 STR, +6 DEX, +3 VIT | — |
| `fortune_dice` — Fortune Dice | +6 DEX | +4 Luck |

---

## 11. Catalog SSR — 24 item

| ID / Item | Thuộc tính mới mỗi level | Hiệu ứng giữ lại |
|---|---|---|
| `one_more_hit` — One More Hit | +12 VIT | Nhận 1 Vé Thoát Hiểm khi nhặt |
| `last_bad_decision` — The Last Bad Decision | +12 STR, +12 DEX, −5 VIT | — |
| `wardens_bulwark` — Warden’s Bulwark | +10 STR, +8 VIT, +8 ENE | — |
| `eye_of_rngesus` — Eye of RNGesus | +5 STR, +5 DEX, +5 ENE | +7 Luck |
| `phoenix_blood` — Phoenix Blood | +16 VIT, +8 ENE | — |
| `riftbreaker` — Riftbreaker | +12 STR, +8 DEX | +20% Boss Damage, +15% Elite Damage |
| `living_armor` — Living Armor | +10 STR, +16 VIT | — |
| `mimic_crown` — Mimic Crown | +6 DEX, +6 ENE | +3 Luck, +20% Mimic Detection, +5 điểm % SSR Find |
| `endless_flask` — Endless Flask | +10 VIT, +8 ENE | Nhận 1 Potion, +20 điểm % Potion Power |
| `chrono_shard` — Chrono Shard | +20 DEX | +2 Luck |
| `seraphic_aegis` — Seraphic Aegis | +10 STR, +6 VIT, +12 ENE | — |
| `doomwhisper` — Doomwhisper | +14 STR, +12 DEX | — |
| `worldroot_seed` — Worldroot Seed | +4 STR, +22 VIT | — |
| `void_lens` — Void Lens | +8 DEX, +8 ENE | +8 điểm % SSR Find, +15% Mimic Detection |
| `angelic_engine` — Angelic Engine | +6 VIT, +18 ENE | +1 Max Mana |
| `predators_instinct` — Predator’s Instinct | +6 STR, +14 DEX | +25% Elite Damage |
| `deimoss_scar` — Deimoss Scar | +14 STR, +6 VIT | +30% Boss Damage |
| `golden_goblet` — Golden Goblet | +6 DEX, +6 VIT | +5 Luck, +18% Goblin Catch |
| `astral_mail` — Astral Mail | +6 STR, +8 DEX, +6 VIT, +8 ENE | — |
| `blood_moon_edge` — Blood Moon Edge | +14 STR, +12 VIT | — |
| `oracle_mask` — Oracle Mask | +12 DEX, +10 ENE | +5 Luck |
| `eternal_clover` — Eternal Clover | +4 DEX, +4 VIT | +9 Luck, +4 điểm % SSR Find |
| `titan_heart` — Titan Heart | +6 STR, +22 VIT | — |
| `sevenfold_sigil` — Sevenfold Sigil | +7 STR, +7 DEX, +7 VIT, +7 ENE | +3 Luck |

---

## 12. Catalog UR — 16 item và lời nguyền

UR tiếp tục có lợi ích rất lớn và một lời nguyền gắn với item. Chỉ Goblin’s Debt và Crown of Ruin làm mất payout.

| ID / Item | Lợi ích mỗi level | Lời nguyền mỗi level |
|---|---|---|
| `glass_cannon` — Glass Cannon | +35 STR, +15 DEX | Defense hiệu dụng bị đặt về 0 khi item chưa được giải nguyền |
| `schrodingers_armor` — Schrödinger’s Armor | +20 STR, +30 VIT | −12 VIT |
| `goblins_debt` — Goblin’s Debt | +20 DEX, +15 VIT, +12 Luck, +20% Goblin Catch | Mất 15% payout hiện tại |
| `crown_of_ruin` — Crown of Ruin | +20 STR, +15 VIT, +8 Luck | Mất 10% payout hiện tại |
| `blood_pact` — Blood Pact | +40 STR, +10 DEX | −15 VIT |
| `void_heart` — Void Heart | +35 VIT, +20 ENE | Potion Power −15 điểm % |
| `broken_hourglass` — Broken Hourglass | +40 DEX, +8 Luck | Mất 4% Max HP sau mỗi tầng |
| `mimics_promise` — Mimic’s Promise | +20 DEX, +15 ENE, +12 điểm % SSR Find, +10% Mimic Detection | +12 điểm % tỷ lệ Mimic |
| `berserker_chains` — Berserker Chains | +40 STR, +10 DEX, +20% Elite Damage | Nhận thêm 18% damage |
| `hollow_crown` — Hollow Crown | +10 VIT, +40 ENE, +2 Max Mana | −15 STR |
| `ashen_wings` — Ashen Wings | +40 DEX, +10 ENE | −20 Resistance dạng flat |
| `soul_leash` — Soul Leash | +20 STR, +25 ENE, +35% Boss Damage | −2 Max Mana |
| `bleeding_star` — Bleeding Star | +20 STR, +30 DEX | Mất 6% Max HP sau mỗi tầng |
| `null_idol` — Null Idol | +20 STR, +15 VIT, +20 ENE | −15 DEX và −6 Luck |
| `black_sun` — Black Sun | +10 DEX, +30 ENE, +10 Luck, +15 điểm % SSR Find | Potion Power −20 điểm % |
| `oathbreaker` — Oathbreaker | +25 STR, +15 DEX, +10 VIT, +25% Boss/Elite Damage | −10 STR và −10 DEX |

`defenseOverride: 0` của Glass Cannon là override boolean và không nhân theo level. Payout penalty được áp dụng một lần cho mỗi level mới nhận, giống hành vi hiện tại; Purifier không hoàn lại payout đã mất.

---

## 13. Thay đổi event liên quan đến chỉ số

Các event đang cộng chỉ số dẫn xuất phải chuyển sang thuộc tính chính:

| Event hiện tại | Hiệu ứng v2 |
|---|---|
| Shrine Armor +3 DEF | +5 STR hoặc +5 VIT, pre-roll một lựa chọn |
| Shrine Blood +4 damage | −5 VIT, +8 STR |
| Corrupted Shrine +7 damage/−4 DEF | +12 STR, −8 VIT |
| Rift Blessing +4 DEF/+5 RES | +6 STR, +6 ENE, +1 Luck |
| Altar mua +3 DEF | +6 VIT |
| Rift Contract +5 damage | +10 vào thuộc tính gây damage chính của class |
| Mirror chọn tấn công | +10 thuộc tính damage chính |
| Mirror chọn phòng thủ | +8 VIT, +5 thuộc tính phòng thủ phụ của class |
| Horadric Forge +3 damage | +6 thuộc tính damage chính |
| Horadric Forge +4 Defense | +7 STR hoặc +7 VIT |
| Horadric Forge +10 Max HP | +4 VIT |
| Wrong Portal giảm DEF/RES | −5 STR và −5 ENE |

`damageStatForClass`:

- Barbarian, Paladin và Druid: STR.
- Amazon và Assassin: DEX.
- Sorceress và Necromancer: ENE.

Mọi kết quả RNG phải được lưu trong encounter trước khi người chơi bấm để restart không thay đổi kết quả.

### 13.1. Event mới — Rift Duelist: Oẳn tù tì

Rift Duelist là một surprise event độc lập trong run, mở từ tầng 10. Event không thu xu, không dùng hệ thống cược của game Oẳn tù tì bên ngoài và không ảnh hưởng lịch sử thắng thua economy.

Màn đầu có ba lựa chọn:

- `⚔️ Đấu stat · 1 ván`
- `🎒 Đấu trang bị · thắng 3/5`
- `🚶 Bỏ qua`

Luck không tạo gợi ý, không loại trừ tay của bot và không thay đổi xác suất trong cả hai chế độ.

Ngay khi encounter được tạo, bot phải pre-roll năm tay của Rift Duelist, phần thưởng item và item có thể bị mất. Không roll lại khi người chơi chọn chế độ hoặc bấm tay:

```json
{
  "type": "surprise",
  "kind": "rift_duelist",
  "mode": null,
  "enemyHands": ["rock", "paper", "scissors", "rock", "paper"],
  "round": 0,
  "playerWins": 0,
  "statPenalty": ["strength", "energy", "energy", "dexterity", "strength", "energy"],
  "rewardRarity": "legendary",
  "rewardItemId": "doomwhisper",
  "penaltyEquipmentId": "run-item-instance-id",
  "resolved": false
}
```

Luật thắng thua chuẩn:

```text
Búa thắng Kéo · Kéo thắng Bao · Bao thắng Búa
```

#### Chế độ A — đấu stat một ván

Người chơi chọn Búa, Bao hoặc Kéo đúng một lần.

| Kết quả | Hiệu ứng |
|---|---|
| Thắng bằng Búa | +6 STR vĩnh viễn trong run |
| Thắng bằng Kéo | +6 DEX vĩnh viễn trong run |
| Thắng bằng Bao | +6 ENE vĩnh viễn trong run |
| Thua hoặc hòa | Trừ tổng cộng 6 điểm thuộc tính ngẫu nhiên |

Sáu điểm phạt được pre-roll và lưu trong `statPenalty` khi encounter xuất hiện. Mỗi điểm chọn độc lập giữa STR/DEX/VIT/ENE. Khi áp dụng, thuộc tính tương ứng không được thấp hơn 1. Nếu thuộc tính được chọn đã bằng 1, điểm phạt đó chuyển sang thuộc tính đầu tiên còn có thể giảm theo thứ tự STR → DEX → VIT → ENE. Nếu tổng số điểm có thể giảm thấp hơn 6, chỉ trừ số còn lại.

Ví dụ kết quả phạt đã được roll là:

```text
−2 STR · −1 DEX · −3 ENE
```

Điểm phạt được ghi vào `eventAttributes` dưới dạng số âm. Sau khi thay đổi VIT/ENE, bot tính lại Max HP/Max Mana và clamp HP/Mana hiện tại.

#### Chế độ B — đấu trang bị, thắng 3 trong 5 ván

- Trận có tối đa năm ván.
- Mỗi lần người chơi chọn tay sẽ tiêu thụ một ván, kể cả hòa.
- Đạt ba ván thắng là thành công ngay.
- Sau ván thứ năm, dưới ba ván thắng là thất bại.
- Có thể kết thúc sớm khi số ván còn lại không đủ để đạt ba chiến thắng.

Khi thành công, nhận một trang bị đã pre-roll:

```text
75% SSR
25% UR
```

Khi thất bại, bot xóa ngẫu nhiên **một trang bị nguyên món** thuộc R, SR hoặc SSR đang có trong run:

- UR không nằm trong danh sách bị mất.
- Nếu item có nhiều level, toàn bộ item và mọi level của item đó bị xóa.
- Bot tính lại bốn thuộc tính, chỉ số dẫn xuất và hiệu ứng đặc biệt sau khi xóa.
- HP/Mana hiện tại bị clamp theo Max HP/Max Mana mới.
- Nếu không có bất kỳ item R/SR/SSR nào, người chơi không mất gì.
- Item phạt được chọn và lưu khi encounter xuất hiện; restart không thể đổi sang item khác.

Reward rarity và reward item cũng được khóa khi encounter xuất hiện. Item chỉ được trao sau chiến thắng thứ ba.

#### State machine và giao diện

Sau khi chọn chế độ, hàng nút đổi thành:

```text
✊ Búa · ✋ Bao · ✌️ Kéo
```

Ở chế độ trang bị, embed hiển thị:

```text
Ván 3/5 · Thắng 1/3
Ván trước: Bạn ra Búa · Đối thủ ra Kéo · Bạn thắng
Phần thưởng: SSR 75% · UR 25%
Thất bại: mất ngẫu nhiên một item R/SR/SSR
```

Khi xử lý kết quả:

1. Kiểm tra `resolved === false` và turn/session hợp lệ.
2. Dùng đúng `enemyHands[round]` và tăng `round` trong cùng transaction.
3. Chế độ stat đặt `resolved = true` sau một ván.
4. Chế độ item chỉ đặt `resolved = true` khi thắng đủ ba ván, hết năm ván hoặc không còn khả năng đạt ba trận thắng.
5. Cộng/trừ stat qua `state.eventAttributes`, không sửa total stat dẫn xuất.
6. Reward item dùng `applyItem`; penalty item dùng một hàm xóa item rồi derive lại toàn bộ stat/effect.
7. Gọi `completeFloor(..., rewardMultiplier = 0)` khi event kết thúc.
8. Mỗi nút dùng expected turn để double-click không xử lý một ván hai lần.

Ví dụ log:

```text
✌️ Ván 5: Bạn ra Kéo · Rift Duelist ra Bao.
Bạn đạt 3/5 chiến thắng và nhận Doomwhisper Lv.1 (SSR).
```

Event này có một entry trong surprise pool với trọng số bằng một event thường. Không xuất hiện tại tầng boss, checkpoint, RNGesus hoặc khi state đang chờ chọn nâng cấp.

### 13.2. Ba event cửa hàng đặc biệt

Mỗi shop khóa sẵn inventory và giá ngay khi encounter được tạo. Người chơi mua tối đa một món rồi event kết thúc; nút Bỏ qua luôn có sẵn. Luck không thay đổi inventory, giá hoặc rarity của ba shop.

#### A. Rift Merchant — thanh toán bằng payout của run

Đây là phiên bản mở rộng của Rift Merchant hiện tại. Shop pre-roll ba item:

| Rarity offer | Tỷ lệ xuất hiện | Giá |
|---|---:|---:|
| R | 45% | 5% payout hiện tại |
| SR | 40% | 12% payout hiện tại |
| SSR | 15% | 25% payout hiện tại |

- Mỗi slot roll rarity độc lập rồi chọn item trong rarity đó; ba item ID không được trùng nhau.
- Giá tối thiểu 1 payout và được khóa khi shop xuất hiện.
- Không bán UR.
- Dùng `payoutSpent` để trừ giá; không sửa tiền xu tài khoản.
- Nếu payout bằng 0, Rift Merchant không được đưa vào encounter pool.
- Nút mua bị disable nếu payout khả dụng hiện tại nhỏ hơn giá.
- Server phải đọc lại `availablePayout = potentialPayout(state)` trong transaction. Chỉ cho mua khi `availablePayout > 0`, `cost >= 1` và `availablePayout >= cost`.
- Nếu payout đã về 0 hoặc thấp hơn giá, trả lỗi `INSUFFICIENT_RUN_PAYOUT`; không trao item, không tăng `payoutSpent` và không hoàn thành event.
- `payoutSpent` sau mua bằng giá trị cũ cộng đúng `cost` và không bao giờ được lớn hơn gross payout đã khóa bởi công thức payout.

#### B. Blood Merchant — thanh toán bằng HP

Shop máu pre-roll đúng ba item, mỗi rarity một món:

| Offer | Giá HP |
|---|---:|
| Một item SR | `ceil(12% Max HP)` lúc shop xuất hiện |
| Một item SSR | `ceil(25% Max HP)` lúc shop xuất hiện |
| Một item UR | `ceil(40% Max HP)` lúc shop xuất hiện |

- Giá bắt buộc dùng **Max HP**, không dùng HP hiện tại. Bot tính `hpCost = max(1, ceil(maxHpAtCreation*rate))` và lưu số tuyệt đối trong offer.
- Chỉ cho mua nếu `currentHp - hpCost >= 1`, tương đương `currentHp > hpCost`.
- Mua không thể giết người chơi.
- Trừ HP trước, sau đó mới áp dụng item và tính lại stat.
- Item tăng VIT không làm thay đổi giá đã khóa.
- Không có item đủ điều kiện mua thì người chơi chỉ có thể Bỏ qua.
- Nút mua bị disable khi HP hiện tại không đủ, nhưng server vẫn phải kiểm tra lại trong transaction.
- Nếu HP thấp hơn hoặc bằng giá, trả lỗi `INSUFFICIENT_RUN_HP`; không trừ HP, không trao item và không hoàn thành event.

#### C. Diamond Merchant — thanh toán bằng kim cương tài khoản

Diamond Merchant chỉ được thêm vào surprise pool khi `floor >= 101`. Shop dùng kim cương thật của người chơi trong server, không tạo loại kim cương riêng cho run.

| Offer | Giá đề xuất |
|---|---:|
| Một item SR | 200 kim cương |
| Một item SSR | 600 kim cương |
| Một item UR | 1.600 kim cương |

- Ba item được pre-roll và lưu trong encounter.
- Giá có thể chuyển thành server config sau khi có dữ liệu sử dụng, nhưng không thay đổi giữa một encounter.
- Khi bấm mua, bot đọc lại số dư kim cương và trừ bằng transaction ledger.
- Operation ID: `hardcore:diamond-shop:<sessionId>:<turn>:<offerIndex>`.
- Double-click hoặc retry sau restart phải trả lại kết quả cũ và không trừ kim cương lần hai.
- Nếu thiếu kim cương, interaction báo thiếu bao nhiêu và giữ nguyên shop để người chơi chọn món khác hoặc bỏ qua.
- Item mua bằng kim cương vẫn chỉ tồn tại trong run. Chết, bỏ run hoặc rút thưởng không hoàn kim cương.
- Giao diện phải ghi rõ: **“Item chỉ dùng trong run này; đã mua sẽ không hoàn kim cương.”**

#### D. Quy tắc chung của shop

Để shop không phá cân bằng tầng 999:

| Shop | Số lần mua tối đa mỗi run |
|---|---:|
| Rift Merchant | 5 |
| Blood Merchant | 3 |
| Diamond Merchant | 2 |

- Cùng một loại merchant chỉ có thể xuất hiện lại sau ít nhất 50 tầng.
- Bỏ qua không tăng bộ đếm mua nhưng vẫn đặt cooldown 50 tầng.
- Khi đạt giới hạn mua, merchant đó bị loại khỏi encounter pool đến hết run.
- State lưu `merchantPurchases` và `merchantLastSeenFloor` riêng cho ba loại.

Encounter lưu tối thiểu:

```json
{
  "type": "surprise",
  "kind": "diamond_merchant",
  "offers": [
    { "itemId": "steel_lotus", "rarity": "rare", "currency": "diamonds", "cost": 200 }
  ],
  "purchased": false
}
```

Khi mua:

1. Xác nhận session, owner, expected turn, offer index và `purchased === false`.
2. Lấy offer từ state đã lưu; không tin currency, cost hoặc item ID gửi từ custom ID.
3. Kiểm tra lại tài nguyên tương ứng trong transaction. Giá phải là số nguyên an toàn và lớn hơn 0.
4. Với payout: yêu cầu `potentialPayout(state) >= cost` và payout phải lớn hơn 0.
5. Với HP: yêu cầu `state.hp > cost`; `cost` phải đúng số đã khóa từ Max HP lúc tạo shop.
6. Với kim cương: đọc lại số dư và dùng ledger operation ID idempotent.
7. Trừ payout, HP hoặc kim cương đúng một lần.
8. Đặt `purchased = true`.
9. Áp dụng item và hoàn thành tầng với reward multiplier bằng 0.
10. Ghi log tên item, rarity, giá, loại tài nguyên và số dư còn lại.

Toàn bộ bước kiểm tra, thanh toán, đánh dấu đã mua, trao item và lưu state phải nằm trong cùng transaction. Nếu bất kỳ bước nào lỗi, transaction rollback toàn bộ.

Không shop nào được bán item không nằm trong catalog 100 item của run.

### 13.3. Event đặc biệt — Rift Severance

Rift Severance cho phép người chơi tự chọn xóa **toàn bộ stack hiện có của đúng một Rift debuff**. Event chỉ xuất hiện một lần sau khi vượt mỗi mốc:

```text
199 · 399 · 699 · 899
```

Đây là event mốc cố định, không nằm trong random surprise pool. Nó được xử lý trước encounter thường của tầng kế tiếp và không thay thế boss.

Các modifier được phép xóa:

- Stone Skin.
- Elemental Dominion.
- Bloodlust.
- Fortified.
- Swift Horror.
- Soul Drain.
- Cursed Ground.

Unstable Rift không nằm trong danh sách vì chứa cả lợi ích tăng hòm và rủi ro Mimic.

Giao diện dùng select menu liệt kê modifier đang hoạt động cùng số stack và tác dụng hiện tại. Người chơi chọn đúng một modifier hoặc Bỏ qua.

```text
🌀 Chọn một vết nứt để cắt khỏi run
Soul Drain ×6 — 2 charge mỗi trận
Stone Skin ×5 — quái +50% Defense
Cursed Ground ×4 — bạn −16 RES khi nhận phép
```

Khi xác nhận:

1. Kiểm tra mốc chưa được dùng trong `riftSeveranceClaimed`.
2. Kiểm tra modifier vẫn có trong state.
3. Xóa mọi phần tử có key được chọn khỏi `state.modifiers`.
4. Đánh dấu mốc đã dùng rồi sinh encounter tầng kế tiếp.
5. Modifier vừa xóa vẫn có thể được roll lại ở các mốc 10 tầng về sau.

Nếu không có modifier có hại đang hoạt động, event tự Bỏ qua. Tổng cộng chỉ có bốn Rift Severance trong run nên người chơi không thể xóa sạch debuff liên tục.

### 13.4. Event server — Grave Echo và Server Nemesis

#### A. Tạo Grave Echo khi người chơi chết

Khi một run kết thúc vì tử trận hoặc RNGesus, bot tạo một snapshot Grave Echo gồm:

- User ID và tên hiển thị tại thời điểm chết.
- Class và class skill.
- Tầng tử trận.
- Ba item mạnh nhất trong run.
- Bốn thuộc tính và hướng build chính.
- Nguyên nhân chết dạng mã cùng mô tả ngắn.
- Thời điểm tạo và hết hạn.

Không tạo Grave Echo khi người chơi rút thưởng, bỏ run hoặc bị admin đóng phiên. Nếu người chơi bị một Grave Echo/Nemesis giết, run đó được dùng để nâng kẻ giết và không tạo thêm một Grave Echo độc lập.

Ba item mạnh nhất được xếp theo:

```text
itemScore = rarityWeight*1000 + level*100 + specialEffectScore
R=1 · SR=3 · SSR=7 · UR=12
```

Đây chỉ là bản sao item trong run. Bot không đọc, xóa hoặc khóa vật phẩm trong inventory economy của người chơi.

Hướng build là thuộc tính có phần đầu tư lớn nhất sau khi trừ stat class ban đầu:

```text
STR build · DEX build · VIT build · ENE build · Hybrid
```

#### B. Lưu trữ server

Database dùng bảng riêng, không nhét Grave Echo vào JSON của run khác:

```text
hardcore_grave_echoes
  id, guild_id, source_user_id, source_name
  class_key, death_floor, skill_key
  attributes_json, items_json, build_type
  death_cause_json
  level, kills, status
  claimed_session_id, claim_expires_at
  created_at, updated_at, expires_at
```

Quy tắc dữ liệu:

- Tối đa 10 Grave Echo/Nemesis trong mỗi server.
- Hết hạn sau 7 ngày không hoạt động.
- Mỗi lần Nemesis giết người, `expires_at` được gia hạn thêm 7 ngày.
- Trước khi thêm echo mới, xóa record hết hạn.
- Nếu vẫn đủ 10, thay record có `kills` thấp nhất; nếu bằng nhau thay record cũ nhất chưa bị claim.
- Cleanup chạy cùng maintenance định kỳ và có index `(guild_id,status,expires_at)`.

#### C. Điều kiện xuất hiện

- Chỉ xuất hiện từ tầng 101.
- Không chọn Grave Echo của chính người đang chơi.
- Không xuất hiện ở boss, checkpoint, Rift Severance, RNGesus hoặc memory event.
- Mỗi dải 100 tầng của một run gặp tối đa một Grave Echo: 101–199, 200–299, …, 900–998.
- Khi sinh encounter hợp lệ, Grave Echo có 1% cơ hội thay encounter thường.
- `graveEchoBandsSeen` trong state giữ các dải đã gặp và không bị reset bởi `/choi sinhton tieptuc`.

Khi một echo được chọn, bot claim record trong transaction cho session hiện tại. Claim có lease 30 phút và được gia hạn sau mỗi action hợp lệ. Maintenance giải phóng claim hết hạn. Nhờ đó hai người chơi không thể đồng thời cướp hoặc tiêu diệt cùng một Nemesis.

#### D. Bốn lựa chọn tại ngôi mộ

| Lựa chọn | Kết quả |
|---|---|
| Cầu nguyện | Hồi `max(1, floor(maxHp*0.15))`, an toàn; Grave Echo vẫn còn trên server |
| Cướp mộ | Nhận bản sao một item mà echo đang giữ; item đó bị xóa khỏi record; 50% đánh thức echo |
| Khiêu chiến | Chủ động gọi echo mạnh hơn 25%; hạ được nhận item và payout tốt hơn |
| Bỏ đi | Không nhận gì; giải phóng claim và Grave Echo vẫn còn |

Tỷ lệ đánh thức khi Cướp mộ được pre-roll lúc encounter được tạo, không chịu ảnh hưởng Luck. Nếu echo không còn item, nút Cướp mộ bị disable. Nếu echo thức dậy, người chơi vẫn giữ item vừa cướp nhưng phải chiến đấu với phần sức mạnh còn lại của nó.

#### E. Scale chỉ số và class mechanic

Grave Echo không sao chép raw HP/damage tại tầng chết. Bot tạo một Elite theo tầng hiện tại rồi áp profile đã chuẩn hóa:

```text
echoHp     = eliteHp(currentFloor)*(1 + level*0.10 + kills*0.15)
echoDamage = eliteDamage(currentFloor)*(1 + level*0.05 + kills*0.08)
```

Khiêu chiến nhân tiếp HP và damage với `1.25`. Defense, Evasion, Crit và Resistance dùng tỷ lệ build, có cùng cap với quái hiện tại.

| Class/build | Mechanic Grave Echo |
|---|---|
| Amazon | Mỗi đòn kỹ năng thứ ba dùng Barrage gồm hai phát |
| Assassin | Shadow Step làm đòn phản công kế tiếp của người chơi trượt |
| Barbarian | Dưới 50% HP nhận Bloodlust tăng damage |
| Sorceress | Arcane Burst gây phép và ưu tiên mục tiêu RES thấp |
| Druid | Wild Regeneration hồi một phần HP theo chu kỳ |
| Necromancer | Totem Ward chặn hoàn toàn đòn kế tiếp |
| Paladin | Divine Shield tăng Defense/Resistance cho lượt kế tiếp |
| STR build | Tăng physical damage |
| DEX build | Tăng Accuracy/Evasion; có thể Critical |
| VIT build | Tăng HP và Defense |
| ENE build | Tăng magic damage và Resistance |
| Hybrid | Nhận bonus nhỏ cho cả bốn nhóm, không có bonus cực đại |

Ba item snapshot được chuyển thành effect đã chuẩn hóa và có cap; không cộng thẳng raw stat cũ. UR chưa giải nguyền thêm một curse mechanic dựa trên curse của item, ví dụ Glass Cannon tăng mạnh damage nhưng giảm Defense, Black Sun làm yếu bình máu, Broken Hourglass gây mất HP theo chu kỳ. Curse không được phép trừ payout của người đang chiến đấu với echo.

#### F. Grave Echo giết thêm người

Nếu Grave Echo hạ người chơi:

1. Chọn và sao chép một item từ run vừa chết.
2. Nếu trùng item đang giữ, tăng level; nếu khác thì thêm item.
3. Chỉ lưu tối đa năm item, ưu tiên năm itemScore cao nhất.
4. Tăng `level` và `kills` thêm 1.
5. Đổi tên hiển thị thành `Server Nemesis: <source_name>, Kẻ Chết Ở Tầng <death_floor>`.
6. Gia hạn thời gian sống thêm 7 ngày.
7. Xóa session run bị giết theo quy trình tử trận bình thường.

Ví dụ:

```text
SERVER NEMESIS: Oggy, KẺ CHẾT Ở TẦNG 347
Đã kết liễu 3 người chơi
Đang mang: Glass Cannon · Black Sun · Titan Heart
```

#### G. Hạ Grave Echo/Nemesis

Hạ Grave Echo thường:

- Nhận bản sao một item nó đang giữ, nếu còn item.
- Cộng payout bonus bằng 50% tiền cược hiện tại.
- Xóa Grave Echo khỏi server.

Hạ Server Nemesis:

```text
nemesisPayout = floor(stake*min(5, 1 + kills*0.5))
```

- Nhận một item nó đang giữ.
- Cộng payout bonus theo số mạng, tối đa `5 × stake`.
- Xóa Nemesis khỏi server trong cùng transaction.
- Gửi thông báo tại channel Sinh tồn đã cấu hình; nếu không còn channel hợp lệ thì gửi tại channel vừa hạ Nemesis.
- Thông báo ghi người tiêu diệt, tên Nemesis, số mạng, tầng và item nhận được.

Nếu người chơi rút thưởng hoặc chết vì nguyên nhân khác trong combat với echo, claim được giải phóng hoặc Nemesis được cập nhật đúng transaction; không trao thưởng hai lần.

### 13.5. The Tower Remembers — karmaLedger

Tháp lưu các quyết định quan trọng và đưa hậu quả trở lại sau 10–30 tầng. Khi ghi nhận một quyết định, bot chỉ hiển thị:

```text
The Tower will remember this.
```

Bot không tiết lộ tầng kích hoạt, polarity hoặc hậu quả cụ thể.

#### A. Dữ liệu ledger

```json
{
  "karmaLedger": [
    {
      "id": "karma-id",
      "sourceKind": "lost_adventurer_rob",
      "sourceFloor": 47,
      "triggerFloor": 68,
      "polarity": "bad",
      "outcome": "bounty_hunter",
      "payload": { "itemId": "stormglass", "itemLevel": 1 },
      "resolved": false
    }
  ]
}
```

- State lưu tối đa 8 entry chưa giải quyết.
- `triggerFloor = sourceFloor + randomInt(10,30)` được khóa lúc tạo entry.
- Polarity, outcome và payload cũng được pre-roll lúc tạo.
- Nếu ledger đã đủ 8, entry cũ nhất bị loại trước khi ghi entry mới.
- Mỗi entry chỉ kích hoạt một lần rồi bị xóa sau khi hậu quả hoàn tất.
- `/choi sinhton tieptuc`, restart và chuyển message giữ nguyên toàn bộ ledger.

#### B. Xác suất tốt/xấu theo hành động

Tổng thể hướng tới khoảng 50% tốt và 50% xấu, nhưng hành động ban đầu làm lệch xác suất:

| Quyết định | Tốt | Xấu | Hậu quả tiêu biểu |
|---|---:|---:|---|
| Cứu Lost Adventurer | 80% | 20% | Chặn một đòn kết liễu / trở thành Corrupted Adventurer |
| Cướp Lost Adventurer | 20% | 80% | Item trộm thức tỉnh / Bounty Hunter phục kích với item đó |
| Tránh Mimic | 40% | 60% | Dấu vết kho báu / Ancient Mimic quay lại mạnh hơn |
| Bán hòm | 40% | 60% | Người mua trả thêm / Tax Collector đòi giá bán cộng lãi |
| Thắng Cursed Gambler | 25% | 75% | Xóa món nợ / buộc cược gấp đôi hoặc đấu |
| Thua Cursed Gambler | 70% | 30% | Lượt cược trả thù miễn phí / đòi thêm một khoản nhỏ |
| Hiến HP cho Altar | 60% | 40% | Tạo vũ khí mạnh / Blood Avatar thức tỉnh |
| Hiến payout cho Altar | 50% | 50% | Hoàn tiền kèm lãi / Altar biến thành boss |
| Bỏ qua Healer | 25% | 75% | Để lại túi cứu thương / trở thành Plague Spirit |
| Nhận chữa trị | 75% | 25% | Nâng Potion Power / thuốc nhiễm bệnh tạo debuff tạm |
| Hối lộ RNGesus | 10% | 90% | Hoàn lại một phần / Debt Collector đòi tiền cộng lãi |
| Cầu nguyện thành công | 60% | 40% | Item thức tỉnh +1 level / item phản chủ nhận curse |
| Nghiền item UR | 20% | 80% | Linh hồn ban stat / curse revenant quay lại |
| Phá Mirror of Fate | 25% | 75% | Mirror Shard ban stat / Mirror Clone sao chép build hiện tại |

Xác suất trên không chịu ảnh hưởng Luck. Có thể cân lại sau simulation nhưng phải giữ cố định trong một release.

#### C. Hậu quả khi quay lại

| Outcome | Cách xử lý |
|---|---|
| Adventurer Guardian | Tạo buff một lần; khi damage sắp làm HP về 0, chặn toàn bộ đòn rồi biến mất |
| Bounty Hunter | Elite scale theo tầng hiện tại, dùng bản sao item từng bị cướp |
| Ancient Mimic | Mimic mạnh hơn, giữ một item đã pre-roll; hạ được nhận lại item và reward |
| Tax Collector | Chọn trả payout bằng giá bán cũ ×1,25 hoặc chiến đấu |
| Gambler Debt | Chọn cược payout gấp đôi khoản cũ hoặc đấu Cursed Gambler |
| Revenge Bet | Một lượt cược miễn phí, thắng nhận payout bonus, thua không mất thêm |
| Bloodforged Weapon | Nhận một vũ khí SSR đã pre-roll |
| Altar Refund | Hoàn khoản đã hiến cộng 25% vào payout bonus |
| Altar Boss | Boss scale theo tầng; hạ được hoàn khoản hiến và nhận item SR/SSR |
| Plague Spirit | Quái phép; đòn trúng làm Potion Power giảm tạm thời trong ba tầng |
| Healer’s Blessing | +10 điểm phần trăm Potion Power đến hết run |
| Debt Collector | Đòi khoản hối lộ cũ cộng 20%; thiếu payout thì chuyển thành combat |
| Awakened Item | Item liên quan tăng một level; SSR có thể nhận tag `SSR+` chỉ để hiển thị |
| Betraying Item | Item liên quan nhận một curse đã pre-roll; không tạo payout penalty mới |
| Curse Revenant | Elite mang mechanic của curse UR từng bị nghiền |
| Mirror Clone | Sao chép profile bốn stat hiện tại theo tỷ lệ, scale raw HP/damage theo tầng |

Mọi item, số tiền, curse, enemy profile và lựa chọn của consequence được khóa trong `payload`. Không đọc lại lịch sử cũ rồi roll một kết quả mới khi entry đến hạn.

#### D. Thứ tự kích hoạt

Trước khi tạo encounter cho tầng mới:

1. Boss và tầng 999 có ưu tiên cao nhất.
2. Hoàn tất lựa chọn checkpoint nếu mốc vừa vượt chia hết cho 5.
3. Mở Rift Paradox nếu mốc vừa vượt chia hết cho 25 và chưa được claim.
4. Rift Severance tại 199/399/699/899 được xử lý tiếp theo.
5. Nếu có karma entry đến hạn, chọn entry có `triggerFloor` thấp nhất rồi `sourceFloor` thấp nhất.
6. Nếu một phase ưu tiên đang chờ, dời memory event sang tầng hợp lệ kế tiếp nhưng không đổi outcome.
7. Mỗi tầng chỉ kích hoạt tối đa một memory event; entry khác tiếp tục chờ.
8. Sau khi hậu quả hoàn tất, đánh dấu resolved và xóa entry trong cùng transaction.

Ví dụ giao diện:

```text
TẦNG 183 — MÓN NỢ CŨ
Bạn có nhớ nhà thám hiểm bị cướp ở tầng 47 không?
Hắn thì nhớ.
```

Memory combat sử dụng cùng quy tắc claim turn, resume và settlement như combat thường. Không consequence nào được trừ thuộc tính Energy khi ý định là trừ Mana.

### 13.6. Bad event định kỳ — Rift Paradox

Rift Paradox xuất hiện sau mỗi 25 tầng đã vượt, từ mốc 25 đến 975. Người chơi đang tiếp tục run phải chọn đúng một trong hai nghịch lý; không có nút Bỏ qua.

```text
25 · 50 · 75 · 100 · … · 950 · 975
```

Mỗi lựa chọn chỉ có hiệu lực trong **năm tầng kế tiếp**. Ví dụ chọn sau tầng 25 thì tác dụng ở tầng 26–30 và hết hiệu lực ngay sau khi hoàn thành tầng 30.

Nếu mốc 25 đồng thời là checkpoint hoặc boss:

1. Hoàn thành combat/event và nhận kết quả tầng.
2. Áp dụng hồi thưởng/checkpoint nhưng chưa sinh tầng kế tiếp.
3. Người chơi chọn nâng cấp checkpoint.
4. Mở phase `paradox_choice`.
5. Sau khi chọn Paradox mới sinh encounter của tầng kế tiếp.

Người chơi vẫn được dùng nút Rút thưởng tại phase chọn Paradox nếu run đã đủ điều kiện rút. Nếu tiếp tục thì bắt buộc chọn một trong hai; Rút thưởng không được xem là Bỏ qua.

State tối thiểu:

```json
{
  "paradoxMilestonesClaimed": [25],
  "activeParadox": {
    "kind": "blood_is_money",
    "milestone": 25,
    "startFloor": 26,
    "endFloor": 30,
    "bloodPayoutRate": 0.0,
    "resolved": false
  }
}
```

#### A. Máu là tiền

Trong năm tầng hiệu lực:

- Mỗi lượng HP thực mất tương đương 1% Max HP làm payout cuối của Paradox tăng 1 điểm phần trăm.
- Mỗi lượng HP thực được hồi tương đương 1% Max HP làm phần thưởng Paradox giảm 1 điểm phần trăm.
- `bloodPayoutRate` không thấp hơn 0 và không cao hơn 50% trong mỗi chu kỳ Paradox.

Bot cập nhật theo tỷ lệ chính xác, không làm tròn từng hit:

```text
lossRate = actualHostileHpLost / maxHpAtThatAction
healRate = actualHpHealed / maxHpAtThatAction

bloodPayoutRate
  = clamp(bloodPayoutRate + lossRate - healRate, 0, 0.50)
```

Nguồn HP được tính là mất máu:

- Damage vật lý hoặc phép từ quái/boss/Grave Echo.
- Trap, Mimic, curse tick và bad event gây damage.
- Damage từ The Tower Remembers.

Các thay đổi sau không tạo payout:

- HP dùng để mua item tại Blood Merchant.
- HP chủ động hiến cho Altar hoặc trả cho event.
- Max HP giảm do VIT/item/curse bị thay đổi.
- Admin sửa state hoặc thao tác migration.

Mọi nguồn hồi HP thực tế đều làm giảm `bloodPayoutRate`, gồm Potion, Shrine, Healer, checkpoint, item heal và Grave Echo Prayer. Phần hồi vượt quá Max HP không được tính vì không tạo `actualHpHealed`.

Sau khi hoàn thành tầng thứ năm, bot chốt Paradox **trước** bất kỳ lần hồi đầy HP/checkpoint nào của tầng đó:

```text
payoutFactor *= 1 + bloodPayoutRate
```

Sau khi chốt, đặt `resolved = true` và xóa `activeParadox`. Hồi máu ở các tầng sau không làm mất bonus đã chốt. Nếu người chơi rút thưởng trong năm tầng hiệu lực, payout hiển thị và payout nhận được phải bao gồm bonus tạm thời hiện tại:

```text
previewPayoutFactor = payoutFactor*(1 + bloodPayoutRate)
```

Không được cộng `bloodPayoutRate` lần hai khi vừa preview vừa settle.

#### B. Ngược đời

Trong năm tầng hiệu lực, bot tính chỉ số bình thường trước rồi hoán đổi **Offense Power** và **Defense**:

```text
normalOffensePower = physical weaponBonus của class vật lý
                  hoặc spellBonus của Sorceress/Necromancer

effectiveOffensePower = normalDefense
effectiveDefense      = normalOffensePower
```

Sau đó:

```text
effectiveWeaponDamage = classBaseDamage + effectiveOffensePower
effectiveSpellDamage  = classBaseDamage + effectiveOffensePower
```

Chỉ dùng dải phù hợp với class/skill. Base damage không bị đổi. Accuracy, Evasion, Critical, Resistance, HP, Mana và Luck không hoán đổi.

Ví dụ:

```text
Trước Paradox: Offense Power 180 · Defense 70
Trong Paradox: Offense Power 70 · Defense 180
```

Quy tắc tính:

1. Derive bốn thuộc tính và item effect bình thường.
2. Tính `normalOffensePower` và `normalDefense`.
3. Áp mọi override như Glass Cannon vào giá trị normal.
4. Hoán đổi hai giá trị để tạo effective combat snapshot.
5. Skill multiplier, Crit, Defense reduction và boss modifier dùng snapshot đã đổi.

Item/stat nhận trong thời gian Paradox có tác dụng ngay ở action kế tiếp vì bot derive lại snapshot. Khi qua tầng thứ năm, bot chỉ xóa `activeParadox`; không sửa nguồn stat nên toàn bộ chỉ số tự trở về bình thường.

#### C. Giao diện và chống lỗi

Embed bắt buộc mô tả rõ hai nút:

```text
🩸 Máu là tiền
Mất 1% HP bởi kẻ địch → +1% payout. Hồi 1% HP → −1% bonus.
Tối đa +50%; kéo dài tầng 26–30.

🔁 Ngược đời
Offense Power và Defense đổi chỗ trong tầng 26–30.
```

Battle card trong năm tầng hiển thị:

```text
Rift Paradox: Máu là tiền · còn 3 tầng · bonus tạm +17,4%
```

hoặc:

```text
Rift Paradox: Ngược đời · còn 3 tầng
ATK Power 180→70 · DEF 70→180
```

Điều kiện bắt buộc:

- `paradoxMilestonesClaimed` ngăn một mốc kích hoạt hai lần sau restart.
- `/choi sinhton tieptuc` giữ nguyên lựa chọn, số tầng còn lại và bloodPayoutRate.
- Chỉ tính HP delta một lần cho mỗi action bằng transaction turn hiện tại.
- HP shop/Altar phải gắn damage source `voluntary_cost` để không tăng payout.
- Chốt bonus và xóa effect phải atomic với hoàn thành tầng thứ năm.
- Nếu người chơi chết, bỏ run hoặc rút thưởng, không để active Paradox rò sang run mới.
- Rift Paradox không thay đổi Rift Modifier và không thể bị Rift Severance xóa.

---

## 14. Giao diện Discord

### 14.1. Battle card

Battle card chỉ hiển thị thông tin cần ra quyết định:

```text
Barbarian
HP 418/520 · Mana 3/5
STR 145 · DEX 62 · VIT 160 · ENE 48
Đánh thường 112–118 vật lý · DEF 67 · RES 12%
Trúng 84% · Né 21% · Crit 14%
```

Với Sorceress và Necromancer, battle card thêm một dòng riêng:

```text
Đánh thường 31–38 vật lý
Kỹ năng 95–102 phép · tốn 2 Mana
```

`Trúng` và `Né` luôn được tính với quái đang đối đầu. Ngoài combat, hai tỷ lệ này không hiển thị.

### 14.2. Bảng Chỉ số

Bảng riêng tư phải giải thích nguồn và kết quả:

```text
💪 STR 145 = class 30 + checkpoint 90 + item 25
🏹 DEX 62 = class 14 + checkpoint 20 + item 28
❤️ VIT 160 = class 28 + checkpoint 100 + item 32
🔮 ENE 48 = class 8 + checkpoint 20 + item 20

HP 418/520
Đánh thường 112–118 vật lý
DEF 67 → giảm 14% vật lý từ quái hiện tại
RES 12% → giảm 12% phép
ACC 134 → trúng quái hiện tại 84%
EVA 34 → né quái hiện tại 21%
Crit 14% · Critical damage ×1,75
```

### 14.3. Bảng Trang bị

Phần đầu trang tóm tắt toàn bộ đóng góp:

```text
6 món · tổng Lv.9
STR +42 · DEX +31 · VIT +28 · ENE +17
Luck +5 · Boss Damage +20% · Mimic Detection +8%
```

Mỗi item ghi bonus **mỗi level**, tổng bonus hiện tại và lời nguyền đang hoạt động.

---

## 15. State, tương thích và migration

Run mới lưu:

```json
{
  "statVersion": 2,
  "attributes": {
    "strength": 18,
    "dexterity": 28,
    "vitality": 20,
    "energy": 14
  },
  "checkpointAttributes": {
    "strength": 0,
    "dexterity": 0,
    "vitality": 0,
    "energy": 0
  },
  "eventAttributes": {
    "strength": 0,
    "dexterity": 0,
    "vitality": 0,
    "energy": 0
  },
  "mana": 3,
  "flatMaxMana": 0,
  "merchantPurchases": { "rift": 0, "blood": 0, "diamond": 0 },
  "merchantLastSeenFloor": { "rift": null, "blood": null, "diamond": null },
  "riftSeveranceClaimed": [],
  "paradoxMilestonesClaimed": [],
  "activeParadox": null,
  "graveEchoBandsSeen": [],
  "karmaLedger": []
}
```

Quy tắc tương thích:

1. Session không có `statVersion` được xem là v1 và tiếp tục dùng toàn bộ công thức cũ.
2. Chỉ run bắt đầu sau release dùng v2.
3. Không chuyển đổi run đang hoạt động giữa chừng.
4. Item ID và tên được giữ nguyên nên dữ liệu item trong session cũ vẫn đọc được.
5. `hardcoreEngineV1` được giữ cho đến khi không còn session v1 trong database.
6. Khi session v1 cuối cùng kết thúc, có thể xóa code tương thích trong release sau.
7. Migration tạo bảng `hardcore_grave_echoes` và index nhưng không tự tạo echo từ lịch sử run cũ.
8. Các field mảng/object v2 bị thiếu khi load được khởi tạo bằng giá trị rỗng an toàn; không roll bù event đã bỏ lỡ.

---

## 16. Yêu cầu triển khai

Nên tách các phần sau:

```text
src/services/hardcoreStats.js
  totalAttributes(state)
  deriveStats(state, classDefinition)
  hitChance(attackerAccuracy, defenderEvasion)
  defenseReduction(defense, floor)
  itemContribution(state)

src/hardcore/item.js
  catalog v2 gồm attributes, effects và curse

src/services/hardcoreSpecialEventService.js
  Rift Duelist, merchant, Rift Severance và karmaLedger

src/services/hardcoreGraveEchoRepository.js
  insert, claim lease, release, absorb, defeat và cleanup Grave Echo
```

Mọi action combat gọi `deriveStats` một lần ở đầu transaction và dùng snapshot đó đến hết action. Không tính lại giữa một Barrage nhiều phát hoặc giữa damage và phản công của cùng action.

Không ghi các giá trị dẫn xuất như `damageMin`, `defense`, `accuracy` hoặc `maxMana` trở lại state v2. Chỉ ghi nguồn thuộc tính, HP hiện tại, Mana hiện tại, flat modifier, tài nguyên và hiệu ứng tạm thời.

Mọi mutation giữa economy và run state phải dùng cùng SQLite transaction. Grave Echo được claim/cập nhật/xóa trong transaction; gửi thông báo Discord chỉ thực hiện sau khi commit thành công.

---

## 17. Kiểm thử bắt buộc

### 17.1. Unit test công thức

- Tổng thuộc tính từ class/checkpoint/event/item/Forge chính xác.
- Max HP và HP hiện tại cập nhật đúng khi VIT thay đổi.
- Tấn công thường của cả bảy class luôn dùng weapon damage vật lý.
- STR/DEX tạo weapon damage đúng hệ số từng class.
- ENE tạo spell damage cho Sorceress/Necromancer và không tăng damage của nút Tấn công.
- Defense giảm vật lý đúng công thức và không vượt 70%.
- Evasion nằm trong 5–45%; Hit nằm trong 55–95%.
- Resistance nằm trong −30–70%.
- Crit không vượt 60%.
- Max Mana nằm trong 1–10.
- Tấn công của Sorceress/Necromancer hồi 2 Mana; class khác hồi 1.
- Soul Drain chỉ rút 1 Mana mỗi lần, có 0–3 charge theo stack, không trừ thuộc tính Energy và không khóa caster vô hạn.
- Rift Duelist pre-roll đủ năm tay, stat penalty, reward item và penalty item; restart không thay đổi kết quả.
- Luck không tác động đến bất kỳ chế độ Oẳn tù tì nào trong run.
- Chế độ stat xử lý đúng ma trận Búa/Kéo/Bao, thưởng đúng STR/DEX/ENE và trừ đúng tổng cộng 6 điểm khi thua hoặc hòa.
- Chế độ item dừng đúng khi thắng 3/5 hoặc không còn khả năng đạt ba trận thắng; reward đúng 75% SSR/25% UR.
- Nhánh thua chỉ xóa một item R/SR/SSR đã khóa; không xóa UR và không lỗi khi người chơi không có item hợp lệ.
- Ba merchant khóa inventory và giá; mỗi encounter chỉ mua được một món.
- Payout bằng 0, payout thấp hơn giá, HP bằng giá hoặc HP thấp hơn giá đều bị từ chối ở server; không chỉ dựa vào trạng thái disabled của nút.
- Giá Blood Merchant được tính bằng `ceil(Max HP*rate)` lúc tạo event và không bao giờ tính từ HP hiện tại.
- Blood Merchant không thể làm HP xuống 0 và không đổi giá sau khi VIT thay đổi.
- Diamond Merchant chỉ xuất hiện từ tầng 101, trừ kim cương idempotent và không hoàn tiền khi run kết thúc.
- Cooldown 50 tầng và giới hạn mua của từng merchant được giữ đúng sau restart.
- Rift Severance chỉ xuất hiện ở bốn mốc, xóa đúng một loại modifier và cho phép modifier đó được roll lại về sau.
- Grave Echo chỉ xuất hiện từ tầng 101, tối đa một lần mỗi dải 100 tầng và không chọn chính chủ.
- Grave Echo claim lease ngăn hai session cướp/hạ cùng record; lease hết hạn được giải phóng.
- Grave Echo scale theo tầng hiện tại; không dùng raw damage/HP trong snapshot.
- Nemesis hấp thụ tối đa một item mỗi mạng, tăng level/kills đúng một lần và bị xóa atomically khi bị hạ.
- Server luôn giữ tối đa 10 echo, cleanup đúng hạn 7 ngày và không đụng inventory thật.
- Karma entry lưu sẵn trigger, polarity, outcome và payload; resume/restart không reroll.
- `karmaLedger` không vượt tám entry, mỗi entry chỉ kích hoạt một lần và boss/Rift Severance có đúng thứ tự ưu tiên.
- Rift Paradox kích hoạt đúng một lần sau mỗi mốc 25 tầng, tồn tại đúng năm tầng và giữ nguyên state sau resume.
- Máu là tiền chỉ tính hostile HP loss, loại HP cost tự nguyện, trừ đúng actual healing và cap bonus ở 50%.
- Preview/rút thưởng/chốt tầng năm không cộng bloodPayoutRate hai lần; bonus được chốt trước checkpoint heal.
- Ngược đời hoán đổi đúng normal Offense Power/Defense, cập nhật khi stat đổi và tự phục hồi sau năm tầng.
- Phòng thủ xử lý đúng vật lý, phép và miễn Crit.

### 17.2. Test catalog

- Đúng 100 ID duy nhất.
- Đúng 32 R, 28 SR, 24 SSR và 16 UR.
- Mọi thuộc tính chỉ dùng STR/DEX/VIT/ENE.
- Mọi UR có đúng một curse.
- Chỉ hai curse có payout penalty.
- Text sinh ra khớp dữ liệu.
- Nhặt trùng, Forge và Purifier không cộng hoặc trừ hai lần.
- Mọi special effect tuân thủ cap.

### 17.3. Simulation

Chạy riêng bảy class với ít nhất 10.000 run mỗi class. Chạy nhiều policy:

1. Dồn stat damage.
2. Dồn VIT.
3. Dồn DEX.
4. Hybrid cân bằng.
5. Policy tự chọn dựa trên quái và trang bị.
6. Policy luôn mua món mạnh nhất ở cả ba merchant.
7. Policy luôn Cướp mộ/Khiêu chiến Grave Echo và nhận mọi karma consequence xấu.

Mục tiêu tổng:

| Mốc | Khoảng tỷ lệ mong muốn |
|---|---:|
| Vượt tầng 100 | 15–30% |
| Vượt tầng 500 | 1–3% |
| Gặp boss tầng 999 | 0,2–0,4% |
| Vượt tầng 999 | 0,1–0,2% |
| Giới hạn tuyệt đối | ≤0,5% |

Không class nào được có tỷ lệ vượt tầng 999 cao hơn hai lần class thấp nhất. Không build đơn stat nào được thắng rõ rệt ở mọi mốc.

Policy mua tối đa bằng payout/HP/kim cương vẫn phải giữ tỷ lệ vượt tầng 999 không quá 0,5%. Nếu vượt, ưu tiên tăng giá, giảm giới hạn mua hoặc giảm tần suất merchant trước khi làm yếu toàn bộ catalog.

---

## 18. Thứ tự phát hành

1. Thêm `statVersion` và module tính chỉ số dẫn xuất.
2. Thêm bốn thuộc tính vào class và state v2.
3. Chuyển checkpoint sang bốn lựa chọn.
4. Chuyển combat, Defense, Evasion, Resistance và Phòng thủ.
5. Chuyển toàn bộ 100 item theo catalog trong tài liệu này.
6. Chuyển Forge, Purifier, Shrine, Mirror, Wrong Portal và các event cộng/trừ chỉ số.
7. Thêm Rift Duelist cùng Rift/Blood/Diamond Merchant và transaction kim cương idempotent.
8. Thêm Rift Severance, Rift Paradox, karmaLedger và toàn bộ consequence của The Tower Remembers.
9. Tạo repository/migration Grave Echo, claim lease, Nemesis và cleanup 7 ngày.
10. Cập nhật Battle card, bảng Chỉ số, Trang bị và giao diện event.
11. Chạy unit test, concurrency test và simulation cho từng class/build.
12. Chỉnh enemy scaling, boss, Grave Echo, Paradox và Rift Modifier dựa trên kết quả mô phỏng.
13. Bật v2 cho run mới; giữ v1 cho session đang hoạt động.

Release chỉ được coi là hoàn tất khi catalog, giao diện, test tương thích và mô phỏng tỷ lệ tầng 999 đều đạt yêu cầu trên.
