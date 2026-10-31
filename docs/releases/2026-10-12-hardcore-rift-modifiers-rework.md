# Sinh tồn V2 — Rework Rift Modifiers

## 1. Quy tắc nhận Rift stack

Sau mỗi 10 tầng đã vượt, người chơi nhận một stack Rift Modifier.

- Nhận tại tầng 10, 20, 30 và tiếp tục đến tầng 960.
- Boss tại tầng chia hết cho 50 phải bị tiêu diệt trước khi trao stack.
- Tầng đặc biệt 333, 666 và 999 không trao stack Rift.
- Tầng 970, 980 và 990 không trao stack mới để tránh RNG sát tầng cuối quyết định kết quả run.
- Stack được trao sau khi hoàn tất toàn bộ chiến đấu và event bắt buộc của tầng.
- Kết quả loại Rift được khóa trong session; `/sinhton tieptuc`, restart hoặc interaction cũ không được roll lại.

Rift được phát theo từng túi gồm đủ tám loại. Thứ tự trong mỗi túi được xáo trộn một lần và lưu vào run. Chỉ khi phát hết tám loại, bot mới tạo túi tiếp theo.

| Vòng | Tầng | Kết quả khi không dùng Rift Severance |
| ---: | ---: | --- |
| 1 | 10–80 | Mỗi Rift đạt ×1 |
| 2 | 90–160 | Mỗi Rift đạt ×2 |
| 3 | 170–240 | Mỗi Rift đạt ×3 |
| 4 | 250–320 | Mỗi Rift đạt ×4 |
| 5 | 330–400 | Mỗi Rift đạt ×5 |
| 6 | 410–480 | Mỗi Rift đạt ×6 |
| 7 | 490–560 | Mỗi Rift đạt ×7 |
| 8 | 570–640 | Mỗi Rift đạt ×8 |
| 9 | 650–720 | Mỗi Rift đạt ×9 |
| 10 | 730–800 | Mỗi Rift đạt ×10 |
| 11 | 810–880 | Mỗi Rift đạt ×11 |
| 12 | 890–960 | Mỗi Rift đạt ×12 |

## 2. Cấp độ Rift

Mỗi loại Rift có tối đa 12 stack.

| Stack | Cấp | Ý nghĩa |
| ---: | --- | --- |
| ×1–×4 | Rift I | Hiệu ứng cơ bản |
| ×5–×8 | Rift II | Hiệu ứng tăng mạnh và nâng cơ chế phụ |
| ×9–×12 | Rift III | Phiên bản cuối game |

- Mỗi stack vẫn tăng hiệu ứng theo công thức riêng.
- Khi tăng từ ×4 lên ×5 hoặc từ ×8 lên ×9, Battle UI phải thông báo Rift vừa đổi cấp.
- Stack vượt ×12 bị từ chối và không thay đổi state.

## 3. Stone Skin

Stone Skin tạo một lớp Stone Armor riêng cho quái khi encounter chiến đấu được tạo.

```text
Stone Armor = floor(Max HP quái × 1,5% × số stack)
Stone Armor tối đa = 18% Max HP quái
```

| Stack | Stone Armor | Broken Armor sau khi phá giáp |
| ---: | ---: | ---: |
| ×1 | 1,5% Max HP | DEF −8% |
| ×2 | 3% Max HP | DEF −8% |
| ×3 | 4,5% Max HP | DEF −8% |
| ×4 | 6% Max HP | DEF −8% |
| ×5 | 7,5% Max HP | DEF −12% |
| ×6 | 9% Max HP | DEF −12% |
| ×7 | 10,5% Max HP | DEF −12% |
| ×8 | 12% Max HP | DEF −12% |
| ×9 | 13,5% Max HP | DEF −16% |
| ×10 | 15% Max HP | DEF −16% |
| ×11 | 16,5% Max HP | DEF −16% |
| ×12 | 18% Max HP | DEF −16% |

Quy tắc:

- Damage vật lý và phép đều gây damage lên Stone Armor.
- Damage vượt quá Stone Armor tiếp tục trừ vào HP trong cùng hit.
- Khi Stone Armor về 0, quái nhận Broken Armor đến hết combat.
- Broken Armor giảm DEF hiện tại của quái theo cấp Rift.
- Boss nhiều phase chỉ nhận Stone Armor một lần khi combat bắt đầu; đổi phase không hồi lại Armor.
- Mỗi hit của Barrage, Arcane Echo, Grave Nova và các hit phụ khác đều có thể phá Armor.
- Stone Armor không được hồi bởi hồi máu của boss.
- Stone Skin không trực tiếp tăng DEF khi Armor còn tồn tại.

## 4. Elemental Dominion

Elemental Dominion tăng tỷ lệ dùng phép của quái hỗn hợp và tăng damage phản công phép.

```text
Tỷ lệ dùng phép của quái hỗn hợp += 2 điểm phần trăm × stack
Damage phép += 1,25% × stack
```

| Stack | Tỷ lệ dùng phép | Damage phép |
| ---: | ---: | ---: |
| ×1 | +2 điểm % | +1,25% |
| ×2 | +4 điểm % | +2,5% |
| ×3 | +6 điểm % | +3,75% |
| ×4 | +8 điểm % | +5% |
| ×5 | +10 điểm % | +6,25% |
| ×6 | +12 điểm % | +7,5% |
| ×7 | +14 điểm % | +8,75% |
| ×8 | +16 điểm % | +10% |
| ×9 | +18 điểm % | +11,25% |
| ×10 | +20 điểm % | +12,5% |
| ×11 | +22 điểm % | +13,75% |
| ×12 | +24 điểm % | +15% |

Quy tắc:

- Quái thuần vật lý không bị biến thành quái phép.
- Quái thuần phép chỉ nhận bonus damage phép.
- Quái hỗn hợp nhận cả bonus tỷ lệ phép và bonus damage phép.
- Loại damage của phản công kế tiếp phải được khóa trước khi người chơi chọn hành động.
- Battle UI phải hiển thị rõ phản công kế là vật lý hay phép.
- Mở UI, restart hoặc `/sinhton tieptuc` không được roll lại loại damage.
- True damage và damage cố định của boss không nhận bonus, trừ khi mechanic boss ghi rõ.

## 5. Bloodlust

Bloodlust kích hoạt khi quái lần đầu đi từ ít nhất 50% xuống dưới 50% Max HP.

```text
Bloodlust bonus = 12% + 2% × số stack
```

| Stack | Bonus damage của phản công Bloodlust |
| ---: | ---: |
| ×1 | +14% |
| ×2 | +16% |
| ×3 | +18% |
| ×4 | +20% |
| ×5 | +22% |
| ×6 | +24% |
| ×7 | +26% |
| ×8 | +28% |
| ×9 | +30% |
| ×10 | +32% |
| ×11 | +34% |
| ×12 | +36% |

Quy tắc:

- Chỉ phản công kế tiếp được tăng damage.
- Sau khi phản công được xử lý, Bloodlust kết thúc trong combat hiện tại.
- Phòng thủ giảm một nửa bonus Bloodlust rồi tiêu hiệu ứng.
- Nếu quái bị kết liễu khi xuống dưới 50%, Bloodlust không gây damage.
- Boss đổi phase không kích hoạt lại Bloodlust trên cùng thanh HP.
- Mỗi thanh HP riêng của boss tầng 999 có thể kích hoạt Bloodlust một lần.
- Bloodlust phải được lưu trong state ngay khi được kích hoạt.

Battle UI phải hiển thị bonus hiện tại và kết quả nếu dùng Phòng thủ.

## 6. Unstable Rift

Unstable Rift là Rift đánh đổi giữa phần thưởng và nguy cơ Mimic.

Mỗi stack cung cấp:

- Xác suất encounter chuyển thành hòm hoặc kho báu: +0,75 điểm phần trăm.
- Xác suất SSR trong nhánh kho báu an toàn: +2 điểm phần trăm.
- Xác suất Mimic của hòm: +1,5 điểm phần trăm.
- Xác suất Ancient Mimic: +0,5 điểm phần trăm.

| Stack | Hòm/kho báu | SSR an toàn | Mimic | Ancient Mimic |
| ---: | ---: | ---: | ---: | ---: |
| ×1 | +0,75 điểm % | +2 điểm % | +1,5 điểm % | +0,5 điểm % |
| ×2 | +1,5 điểm % | +4 điểm % | +3 điểm % | +1 điểm % |
| ×3 | +2,25 điểm % | +6 điểm % | +4,5 điểm % | +1,5 điểm % |
| ×4 | +3 điểm % | +8 điểm % | +6 điểm % | +2 điểm % |
| ×5 | +3,75 điểm % | +10 điểm % | +7,5 điểm % | +2,5 điểm % |
| ×6 | +4,5 điểm % | +12 điểm % | +9 điểm % | +3 điểm % |
| ×7 | +5,25 điểm % | +14 điểm % | +10,5 điểm % | +3,5 điểm % |
| ×8 | +6 điểm % | +16 điểm % | +12 điểm % | +4 điểm % |
| ×9 | +6,75 điểm % | +18 điểm % | +13,5 điểm % | +4,5 điểm % |
| ×10 | +7,5 điểm % | +20 điểm % | +15 điểm % | +5 điểm % |
| ×11 | +8,25 điểm % | +22 điểm % | +16,5 điểm % | +5,5 điểm % |
| ×12 | +9 điểm % | +24 điểm % | +18 điểm % | +6 điểm % |

Quy tắc:

- Xác suất encounter tăng thêm được lấy từ tỷ lệ quái thường.
- Không ảnh hưởng rương boss, Treasure Goblin, event reward hoặc Class Artifact.
- Không thay đổi pity.
- Không thể xóa bằng Rift Severance.
- Kết quả hòm và phẩm chất phần thưởng được khóa ngay khi encounter xuất hiện.
- Trang bị hoặc event tăng tỷ lệ riêng được cộng sau Unstable Rift rồi áp dụng giới hạn cuối.

## 7. Fortified

Fortified tăng Max HP quái nhưng tạo một cửa sổ Exposed khi quái xuống thấp máu.

```text
Max HP quái += 3% × số stack
```

| Stack | Max HP quái | Damage nhận trong Exposed |
| ---: | ---: | ---: |
| ×1 | +3% | +10% |
| ×2 | +6% | +10% |
| ×3 | +9% | +10% |
| ×4 | +12% | +10% |
| ×5 | +15% | +15% |
| ×6 | +18% | +15% |
| ×7 | +21% | +15% |
| ×8 | +24% | +15% |
| ×9 | +27% | +20% |
| ×10 | +30% | +20% |
| ×11 | +33% | +20% |
| ×12 | +36% | +20% |

Quy tắc:

- Khi quái lần đầu xuống dưới 50% Max HP, nó bị Exposed.
- Exposed áp dụng cho action gây damage kế tiếp của người chơi.
- Action đã khiến quái xuống dưới 50% không được hưởng Exposed.
- Action nhiều hit được tăng toàn bộ hit nhưng chỉ tiêu một lần Exposed.
- Boss nhiều thanh HP có thể kích hoạt Exposed một lần trên mỗi thanh.
- Exposed được lưu trong state; resume không làm mất hoặc tạo lại hiệu ứng.
- Max HP và HP của encounter được khóa khi encounter xuất hiện.

## 8. Swift Horror

Swift Horror tăng khả năng đánh trúng của phản công vật lý. Nó không tăng EVA quái vĩnh viễn.

```text
Tỷ lệ đánh trúng vật lý của quái += 1 điểm phần trăm × số stack
Tối đa = +12 điểm phần trăm
```

| Stack | Hit chance vật lý của quái | Exposed khi quái đánh trượt |
| ---: | ---: | ---: |
| ×1 | +1 điểm % | Người chơi +8% damage |
| ×2 | +2 điểm % | Người chơi +8% damage |
| ×3 | +3 điểm % | Người chơi +8% damage |
| ×4 | +4 điểm % | Người chơi +8% damage |
| ×5 | +5 điểm % | Người chơi +12% damage |
| ×6 | +6 điểm % | Người chơi +12% damage |
| ×7 | +7 điểm % | Người chơi +12% damage |
| ×8 | +8 điểm % | Người chơi +12% damage |
| ×9 | +9 điểm % | Người chơi +16% damage |
| ×10 | +10 điểm % | Người chơi +16% damage |
| ×11 | +11 điểm % | Người chơi +16% damage |
| ×12 | +12 điểm % | Người chơi +16% damage |

Khi phản công vật lý của quái đánh trượt:

- Action gây damage kế tiếp của người chơi được hưởng Exposed.
- Hit vật lý trong action đó chắc chắn trúng.
- Damage vật lý và phép đều nhận bonus Exposed.
- Action nhiều hit chỉ tiêu một lần Exposed nhưng toàn bộ hit được hưởng bonus.
- Exposed kết thúc sau action gây damage kế tiếp hoặc khi combat kết thúc.
- Né bảo đảm từ Shadow Step, Class Shrine hoặc mechanic không kích hoạt Exposed.
- Chỉ lần né được roll tự nhiên mới kích hoạt Exposed.
- Phép và true damage của quái không chịu ảnh hưởng hit chance từ Swift Horror.

## 9. Soul Drain

Soul Drain hút MP khi phản công trúng nhưng cho người chơi cách đối phó bằng Phòng thủ và Tấn công thường.

| Stack | Số lần hút tối đa mỗi combat |
| ---: | ---: |
| ×1–×4 | 1 lần |
| ×5–×8 | 2 lần |
| ×9–×12 | 3 lần |

Mỗi lần hút:

- Chỉ kích hoạt khi phản công thật sự trúng.
- Hút 1 MP và không giảm MP xuống dưới 0.
- Nếu người chơi đang có 0 MP, charge chưa bị tiêu.
- Phòng thủ khiến charge hiện tại bị tiêu nhưng không mất MP.
- Né hoặc chặn hoàn toàn không tiêu charge.

Sau khi MP thực sự bị hút:

- Người chơi nhận Mana Fracture.
- Tấn công thường kế tiếp hồi thêm 1 MP.
- Chỉ giữ tối đa một Mana Fracture.
- MP hồi thêm không vượt Max MP hiệu lực.
- Mana Fracture mất sau khi kích hoạt hoặc combat kết thúc.

Nếu boss có mechanic hút MP riêng:

- Mô tả boss phải ghi rõ Soul Drain bị thay thế hay vẫn hoạt động.
- Không được âm thầm áp dụng hai lần hút trên cùng một hit.

## 10. Cursed Ground

Cursed Ground giảm đúng loại phòng thủ liên quan tới phản công đã được khóa.

### 10.1. Phản công vật lý

```text
DEF hiệu lực = floor(DEF gốc × (1 − 2% × stack))
Mức giảm tối đa = 24%
```

### 10.2. Phản công phép

```text
RES hiệu lực = RES gốc − 1,5 điểm phần trăm × stack
Mức giảm tối đa = 18 điểm phần trăm
```

| Stack | DEF khi nhận vật lý | RES khi nhận phép |
| ---: | ---: | ---: |
| ×1 | −2% | −1,5 điểm % |
| ×2 | −4% | −3 điểm % |
| ×3 | −6% | −4,5 điểm % |
| ×4 | −8% | −6 điểm % |
| ×5 | −10% | −7,5 điểm % |
| ×6 | −12% | −9 điểm % |
| ×7 | −14% | −10,5 điểm % |
| ×8 | −16% | −12 điểm % |
| ×9 | −18% | −13,5 điểm % |
| ×10 | −20% | −15 điểm % |
| ×11 | −22% | −16,5 điểm % |
| ×12 | −24% | −18 điểm % |

Thứ tự tính vật lý:

```text
DEF gốc
→ Cursed Ground
→ bonus Consecration và hiệu ứng class
→ hệ số Phòng thủ
→ công thức giảm damage vật lý
```

Thứ tự tính phép:

```text
RES gốc
→ Cursed Ground
→ penalty boss
→ bonus Consecration, Class Shrine và Phòng thủ
→ giới hạn RES
→ công thức giảm damage phép
```

Quy tắc:

- Không thay đổi DEF hoặc RES gốc trên hồ sơ nhân vật.
- Battle UI hiển thị DEF hoặc RES hiệu lực cho phản công kế tiếp.
- Quái hỗn hợp sử dụng loại giảm trừ tương ứng với damage đã khóa.
- Không giảm hồi máu, Max HP hoặc Barrier.
- True damage bỏ qua Cursed Ground.

## 11. Rift Severance

Rift Severance xuất hiện sau khi hoàn thành các tầng:

- Tầng 199.
- Tầng 399.
- Tầng 699.
- Tầng 899.

Người chơi chọn một Rift để xóa toàn bộ stack.

- Rift được chọn trở về ×0.
- Không hoàn lại damage, HP, MP hoặc phần thưởng đã xử lý.
- Các vòng phát Rift tiếp theo vẫn có thể cộng lại loại đó từ ×0.
- Không thể xóa Unstable Rift.
- Xóa Stone Skin hoặc Fortified không thay đổi encounter đã được tạo.
- Xóa Soul Drain không hoàn lại MP đã mất.
- Xóa Rift không được thay đổi thứ tự túi Rift đang lưu.
- Nếu không có Rift hợp lệ để xóa, người chơi được tiếp tục mà không thay đổi state.

Ví dụ: Soul Drain đang ×8 bị xóa tại tầng 399 sẽ trở về ×0. Khi túi Rift sau đó phát Soul Drain, nó tăng thành ×1.

## 12. Thứ tự xử lý combat

Mỗi lượt phản công phải xử lý theo thứ tự:

1. Khóa loại damage phản công.
2. Áp dụng Cursed Ground lên DEF hoặc RES hiệu lực.
3. Áp dụng Elemental Dominion.
4. Áp dụng Phòng thủ, Consecration và hiệu ứng class.
5. Roll trúng theo Swift Horror.
6. Áp dụng Bloodlust nếu đang sẵn sàng.
7. Tính damage sau mọi giảm trừ.
8. Barrier hấp thụ damage.
9. Xử lý Soul Drain nếu phản công trúng và đủ điều kiện.
10. Cập nhật Swift Exposed, Fury và các innate passive liên quan.

Mỗi lượt tấn công của người chơi phải xử lý theo thứ tự:

1. Khóa snapshot chỉ số và action version.
2. Áp dụng Swift Exposed nếu đang tồn tại.
3. Gây damage lên Stone Armor.
4. Damage vượt Armor tiếp tục trừ HP.
5. Kích hoạt Broken Armor nếu Stone Armor vừa bị phá.
6. Kiểm tra ngưỡng Fortified Exposed.
7. Kiểm tra ngưỡng Bloodlust.
8. Xử lý phase boss.
9. Cập nhật tài nguyên innate passive.

## 13. State bắt buộc

```js
state.rift = {
  version: 2,
  stacks: {
    stone_skin: 0,
    elemental_dominion: 0,
    bloodlust: 0,
    unstable_rift: 0,
    fortified: 0,
    swift_horror: 0,
    soul_drain: 0,
    cursed_ground: 0
  },
  bag: [],
  bagIndex: 0,
  cycle: 1
};
```

State combat liên quan được lưu bên trong encounter:

```js
encounter.rift = {
  stoneArmor: 0,
  stoneArmorMax: 0,
  brokenArmor: false,
  bloodlustReady: false,
  bloodlustUsedByPhase: {},
  fortifiedExposed: false,
  fortifiedUsedByPhase: {},
  swiftExposed: false,
  soulDrainCharges: 0,
  manaFracture: false,
  lockedCounterType: "physical"
};
```

- Encounter lưu các giá trị đã tính thay vì tính lại khi mở UI.
- Bag Rift và vị trí hiện tại phải được lưu trong SQLite cùng run.
- Interaction cũ không thể phát stack, tiêu charge hoặc kích hoạt Exposed lần hai.
- Normalize phải clamp mỗi Rift trong khoảng 0–12.

## 14. Quy tắc tương tác đặc biệt

- Class Awakening không thay đổi số stack Rift.
- Stone Armor là Barrier của quái, không được tính là Max HP cho Fortified.
- Arcane Echo và Grave Nova hưởng Swift Exposed nếu thuộc cùng action đã tiêu hiệu ứng.
- Shadow Step né bảo đảm nên không kích hoạt Swift Exposed.
- Phòng thủ của Divine Shield có thể ngăn Soul Drain theo luật Phòng thủ.
- Bark Barrier của Druid hấp thụ damage sau khi Cursed Ground và Elemental Dominion đã được tính.
- Fury của Barbarian kiểm tra HP thật bị mất sau Barrier, không kiểm tra damage trước Barrier.
- Consecration được tính sau Cursed Ground để bonus phòng thủ không bị trừ hai lần.
- Boss mechanic có true damage bỏ qua DEF, RES và Cursed Ground nhưng không bỏ qua Barrier của người chơi nếu mechanic không ghi rõ.
- Boss-specific mechanic được ưu tiên hơn Rift nếu hai luật xung đột; UI phải ghi rõ hiệu ứng Rift nào bị vô hiệu hoặc thay thế.
