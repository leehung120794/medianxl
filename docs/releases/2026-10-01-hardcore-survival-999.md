# Sinh tồn: Hành trình 999 tầng

**Ngày phát hành:** 01/10/2026  
**Trạng thái:** Sẵn sàng phát hành  
**Phiên bản bot:** 2.0.0

## Tổng quan

Sinh tồn là chế độ chơi một người dùng xu làm tiền cược, vượt từng tầng bằng các nút tương tác và tự quyết định thời điểm rút thưởng. Người chơi giữ toàn bộ payout hiện tại khi rút an toàn; nếu chết trước khi rút, payout của run đó mất hết.

Tầng 100 là mốc hoàn thành chính thức. Sau mốc này, người chơi có thể tiếp tục **Overrun** đến tầng 999. Tầng cuối luôn là trận bắt buộc với **Deimoss the Fleshweaver**; chỉ đánh bại Deimoss mới được công nhận đã chinh phục tầng 999.

## Cách bắt đầu

- Slash command: `/choi sinhton batdau xu:<số xu> nhanvat:<class>`
- Prefix command: `!sinhton <số xu> <class>`
- Xem luật: `/luat trochoi:Sinh tồn`
- Xem tỷ lệ: `/choi sinhton tyle`
- Xem hồ sơ: `/choi sinhton hoso`
- Xem bảng xếp hạng: `/choi sinhton xephang`

Tiền cược hợp lệ từ **10 đến 100.000 xu**, đồng thời chịu giới hạn cược riêng do server thiết lập. Tiền được giữ ngay khi bắt đầu. Mỗi người chỉ có một run Sinh tồn đang hoạt động trong cùng server.

## Bảy class nhân vật

| Class | Điểm mạnh | Kỹ năng |
| --- | --- | --- |
| Amazon | Chính xác cao, sát thương ổn định | **Barrage** bắn hai phát, mỗi phát gây 85% sát thương |
| Assassin | Né và chí mạng cao | **Shadow Step** gây 130% sát thương và né toàn bộ phản công |
| Barbarian | HP cao, đánh vật lý mạnh | **Iron Will** gây 165% sát thương vật lý |
| Druid | Cân bằng và tự hồi phục | **Wild Regeneration** gây 135% sát thương và hồi 12% HP tối đa |
| Necromancer | Nhiều năng lượng, thiên về phép | **Totem Ward** gây 155% sát thương phép và chặn phản công |
| Paladin | Defense và Resistance cao | **Divine Shield** gây 140% sát thương rồi thủ trước phản công |
| Sorceress | Sát thương phép cao | **Arcane Burst** gây 210% sát thương phép |

Kỹ năng tiêu tốn 2 Energy. Tấn công thường và Phòng thủ hồi 1 Energy, không vượt quá giới hạn của class.

## Hành trình 999 tầng

| Tầng | Khu vực |
| ---: | --- |
| 1–99 | Sanctuary |
| 100–199 | Duncraig |
| 200–299 | Fauztinville |
| 300–399 | Teganze |
| 400–499 | Scosglen |
| 500–699 | Dimensional Labyrinth |
| 700–899 | Heroic Rift |
| 900–999 | Dimensional Plane |

Quái tăng sức mạnh theo tầng bằng công thức tuyến tính theo từng giai đoạn. Cách tăng này giữ giai đoạn đầu dễ tiếp cận hơn nhưng vẫn khiến các vùng cuối trở nên rất khắc nghiệt.

## Checkpoint và nâng cấp

Mỗi 5 tầng, người chơi nhận checkpoint:

- Hồi đầy HP.
- Nhận 2 bình máu, tối đa 5 bình.
- Tăng chỉ số nền theo khu vực.
- Chọn một nâng cấp cho phần còn lại của run: **+5 sát thương**, **+30 HP**, **+6 Defense** hoặc **+2 Luck**.

Mức tăng tự động tại checkpoint:

| Mốc tầng | HP tối đa | Sát thương |
| --- | ---: | ---: |
| Dưới 100 | +6 | +1 |
| 100–399 | +10 | +2 |
| 400–699 | +14 | +3 |
| 700–999 | +30 | +6 |

## Rift Modifier

Mỗi 10 tầng, run nhận thêm một modifier. Bot ưu tiên phát đủ tám loại trước khi cho phép lặp; sau đó modifier tiếp tục cộng dồn.

| Modifier | Hiệu ứng mỗi cộng dồn |
| --- | --- |
| Stone Skin | Quái tăng 10% Defense |
| Elemental Dominion | Quái tăng 4% sát thương và khả năng dùng phép |
| Bloodlust | Quái dưới 50% HP gây thêm 8% sát thương |
| Unstable Rift | Tăng cơ hội hòm tốt, đồng thời tăng Mimic |
| Fortified | Quái tăng 10% HP |
| Swift Horror | Quái tăng Accuracy và Evasion |
| Soul Drain | Đòn trúng rút Energy của người chơi |
| Cursed Ground | Giảm All Resistance khi người chơi nhận phép |

## Boss

Boss xuất hiện mỗi 50 tầng và luân phiên theo chu kỳ:

| Boss | Loại sát thương | Cơ chế |
| --- | --- | --- |
| The Butcher | Vật lý | Mỗi lần ra đòn tăng 8% sát thương, tối đa 5 cộng dồn |
| Ascendant Riftwalker | Phép | Miễn nhiễm đòn đầu tiên trong mỗi chu kỳ ba lần người chơi tấn công |
| Assur | Vật lý | Evasion và tỷ lệ chí mạng cao |
| Lucion | Phép | Hồi HP bằng 35% sát thương gây ra |
| Deimoss the Fleshweaver | Vật lý | Abyssal Spires giảm 25% sát thương nhận vào |

Tại tầng 999, Deimoss xuất hiện dưới dạng **Boss cuối** với lượng HP, sát thương và Defense cao hơn boss thông thường. Người chơi không thể bỏ qua trận này để hoàn thành tầng 999.

## Giao tranh

- **Tấn công:** đánh thường và hồi 1 Energy. Quái phản công nếu còn sống.
- **Phòng thủ:** hồi 1 Energy, nhân đôi Defense, chặn thêm 40% sát thương còn lại và miễn chí mạng trong đòn kế tiếp.
- **Kỹ năng:** dùng kỹ năng riêng của class, tốn 2 Energy.
- **Bình máu:** hồi 35% HP tối đa, tối thiểu 20 HP. Quái vẫn phản công nếu còn sống.
- **Rút thưởng:** kết thúc run và nhận payout đang hiển thị. Không thể rút khi đối mặt RNGesus.

Defense giảm sát thương vật lý nhưng có giới hạn tối đa 75%. Resistance áp dụng cho sát thương phép, nằm trong khoảng −50% đến 75%. Accuracy và Evasion quyết định xác suất đánh trúng, với giới hạn từ 20% đến 95%.

## Hòm và item Median XL thật

Hòm lấy tên, base item và stat từ bảng `items` hiện có của bot. Item chỉ tồn tại trong run, không đi vào kho đồ chung và biến mất khi run kết thúc.

| Độ hiếm trong Sinh tồn | Nguồn item |
| --- | --- |
| R | Tiered Unique (TU) |
| SR | Runeword (RW) |
| SSR | Sacred Unique (SU) hoặc Set |
| UR · Nguyền | Sacred Unique (SU), kèm giảm payout |

Các stat Median XL được quy đổi thành Attack, Defense, Resistance, HP hoặc Critical Chance. Nếu item không có stat phù hợp để quy đổi, item nhận Attack mặc định theo độ hiếm. Nhặt lại cùng item sẽ tăng cấp và cộng hiệu ứng thêm một lần.

Tỷ lệ encounter cơ bản, sau khi đã vượt qua lần roll RNGesus:

- 53% quái thường, 12% Elite, 10% hòm thường, 8% Shrine, 5% hòm kho báu, 6% bẫy, 4% sự kiện bất ngờ và 2% phòng trống.
- Unstable Rift chuyển một phần tỷ lệ quái sang hòm và làm thay đổi tỷ lệ hòm tốt/Mimic.

Tỷ lệ bên trong hòm khi chưa có Unstable Rift:

- 3% Ancient Mimic và 12% Mimic.
- Nếu hòm thường không phải Mimic: 20% hòm rỗng, 5% đồ giả, 40% TU, 22% Runeword, 10% SU/Set và 3% SU Nguyền.
- Nếu hòm kho báu không phải Mimic: 65% Runeword và 35% SU/Set.
- Sau 5 hòm không nhận SR trở lên, hòm kế tiếp bảo đảm tối thiểu SR.
- Sau 10 hòm không nhận SSR, mỗi hòm tiếp theo cộng thêm 2% cơ hội SSR, tối đa theo giới hạn hệ thống.
- Luck tăng khả năng phát hiện Mimic và tăng cơ hội SSR.

Người chơi có thể kiểm tra hòm một lần, mở hòm, bán hòm để cộng 15% tiền cược vào payout, hoặc tránh Mimic nếu đã phát hiện thành công.

## Sự kiện bất ngờ

- **Thợ rèn lang thang:** đề nghị nâng item được chọn thêm một cấp. Chi phí bằng 12% payout hiện tại và được trừ trực tiếp khỏi payout của run. Cấp mới cộng lại hiệu ứng của item.
- **Tu sĩ giải nguyền:** dùng 20% payout hiện tại để giải lời nguyền. Item giữ hiệu ứng có lợi, trở thành SSR và hoàn tác giảm payout, giảm HP hoặc mất Defense do lời nguyền gây ra.
- **Người chữa trị lang thang:** hồi 30% HP tối đa và tặng một bình máu miễn phí.
- **Treasure Goblin:** 60% bắt thành công để tăng payout; nếu thất bại sẽ mất 10% payout.

Người chơi luôn có thể bỏ qua các sự kiện này và tiếp tục.

## RNGesus và sự kiện nguy hiểm

RNGesus bắt đầu có thể xuất hiện từ tầng 5 và không thể bị đánh bại. Tỷ lệ nền tăng theo tầng, sau đó được nhân với độ biến động ngẫu nhiên, chuỗi lâu không gặp và Chaos Spike. Xác suất cuối cùng bị giới hạn ở 12% cho từng lần roll.

- **Bỏ chạy:** 75% sống sót. Nếu thất bại và đang có Vé Thoát Hiểm, vé tự kích hoạt làm bảo hiểm và cứu run.
- **Hối lộ:** sống sót nhưng mất 40% payout hiện tại.
- **Cầu nguyện:** 10% nhận trang bị SSR trở lên và đi tiếp; thất bại là chết.
- **Vé Thoát Hiểm:** tiêu thụ một vé để đi tiếp an toàn.
- **Chiến đấu:** chết ngay.

Các bẫy khác gồm Tax Collector làm giảm 15% payout, kẻ trộm lấy bình máu và Wrong Portal giữ nguyên tầng rồi tạo encounter mới.

## Payout và điều kiện hoàn thành

- Chỉ tầng đã vượt mới làm tăng payout.
- Hệ số tầng dừng tăng sau tầng 100; bonus từ encounter, hòm và Shrine vẫn tiếp tục cộng.
- Payout tối đa của một run là **10.000.000 xu**.
- Rút trước khi vượt tầng đầu tiên được tính là bỏ run và không hoàn cược.
- Đạt tầng 100 được ghi nhận là một lần hoàn thành, kể cả khi người chơi tiếp tục Overrun.
- Tầng cao nhất, số run, số lần chết, số lần rút an toàn và số lần hoàn thành được lưu vào hồ sơ Sinh tồn.
- Run không hoạt động trong 7 ngày sẽ bị hệ thống đóng và mất khoản cược đang giữ.

## Mức độ khó tầng 999

Bản cân bằng này dùng bộ mô phỏng chơi thận trọng và lấy item thật từ database Median XL. Kết quả hiệu chuẩn ổn định gần nhất:

- 100 run Assassin mô phỏng đến tầng 999.
- 14 run tạo được trạng thái trước Boss cuối.
- 2.800 lượt tái đấu Deimoss từ các trạng thái đó.
- 72 lượt thắng Boss cuối.
- Tỷ lệ hoàn thành ước tính: **0,36%**, dưới giới hạn 0,5%.

Đây là tỷ lệ thực nghiệm của chiến thuật mô phỏng, không phải xác suất được khóa cứng. Class, lựa chọn nâng cấp, quyết định mở hòm, thời điểm dùng bình và hành vi rút thưởng sẽ làm kết quả thực tế thay đổi.

## Ghi chú vận hành

- Cần bật Message Content Intent nếu server dùng prefix command.
- Cần giữ bảng `items` trong `data/median-xl.sqlite`; thiếu dữ liệu item sẽ khiến hòm dùng bộ item dự phòng.
- Sau khi cập nhật, chạy `npm run register` để đồng bộ lựa chọn 7 class và các subcommand Sinh tồn.
- Có thể kiểm tra cân bằng bằng `npm run simulate:hardcore -- 100 999 40000 assassin 100`.
- Bộ kiểm thử đầy đủ: `npm test`.

