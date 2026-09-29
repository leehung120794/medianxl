# Median XL Discord Bot

Bot Discord chạy local bằng Node.js và discord.js v14. Bot đồng bộ tám nguồn Median XL về SQLite, sau đó tìm kiếm trên dữ liệu local.

## Nguồn và mã phân loại

| URL | Mã |
|---|---|
| `https://docs.median-xl.com/doc/items/tiereduniques` | TU |
| `https://docs.median-xl.com/doc/items/sacreduniques` | SU |
| `https://docs.median-xl.com/doc/items/runewords` | RW |
| `https://docs.median-xl.com/doc/items/sets` | SET |
| `https://docs.median-xl.com/doc/wiki/umos` | UMO |
| `https://docs.median-xl.com/doc/wiki/cycles` | CYCLE |
| `https://docs.median-xl.com/doc/wiki/relics` | RELIC |
| `https://docs.median-xl.com/doc/wiki/trophies` | TROPHY |
| `https://docs.median-xl.com/doc/quests/dungeons` (chỉ Nymyr's Light Reward) | SLEEP |

## Cài đặt

Cần Node.js 18.17 trở lên. Chạy `npm install`, copy `.env.example` thành `.env`, điền token bot, client ID và guild ID thử nghiệm. Bot cần quyền `View Channel`, `Send Messages`, `Embed Links` và `Use Application Commands`.

Chạy `npm run sync` để tải dữ liệu lần đầu, `npm run register` để đăng ký slash command vào guild thử nghiệm, rồi `npm start` để chạy bot. Sau đó admin có thể dùng `/update` trực tiếp trong Discord để đồng bộ lại toàn bộ database; `/sync` vẫn được giữ như alias cũ.

## Lệnh

`/item query:<từ khóa> [type:TU|SU|RW|SET|UMO|CYCLE|RELIC|TROPHY|ALL]`

`/compare item_1:<item> item_2:<item>` so sánh metadata và stats của hai item. Hai ô item có autocomplete và dùng ID nội bộ để phân biệt các item trùng tên.

`/sleep [query]` tìm bonus awakening của The Sleep trong dungeon Nymyr's Light. Query có autocomplete theo các tên Trophy màu vàng, ví dụ `lord of lies`, `legacy of blood`, `yshari sanctum`, hoặc có thể tìm một phần như `lies`, `yshari`. Khi chạy `/sleep` không có query, bot yêu cầu nhập từ khóa. Embed chỉ hiển thị bonus tương ứng, kèm dungeon, reward và icon.

### Xu, hồ sơ và trò chơi

Mỗi thành viên có một hồ sơ riêng trong từng server. `/hoso [user]` tạo thẻ profile PNG đơn giản với avatar, màu chủ đạo, số xu, thứ hạng và thành tích thắng/thua/hòa. Người chơi có thể mua màu trong shop rồi trang bị bằng `/use`; hồ sơ không còn danh hiệu, huy hiệu, khung hoặc hình nền riêng. `/xu sodu` xem nhanh số dư cá nhân, `/xu daily` nhận xu mỗi 24 giờ, `/xu top` mở bảng xếp hạng và `/xu chuyen user:<người nhận> xu:<số lượng>` chuyển xu cho thành viên khác. Hai phía của giao dịch được ghi trong cùng một transaction SQLite nên không có trường hợp trừ người gửi mà chưa cộng người nhận.

`/shop xem` mở cửa hàng xoay vòng 6–10 món mỗi ngày. Mỗi vòng ưu tiên vật phẩm liên quan đến game và chỉ dành tối đa một ô cho màu profile. Người chơi dùng `/buy`, `/inventory`, `/use`, `/collection`, `/craft` và `/giftitem` để mua, dùng, sưu tập, chế tạo hoặc tặng đồ. Catalog gồm vật phẩm hỗ trợ quiz/craft/Mines/Hardcore, hai cấp bảo hiểm cược, Bùa Chống Trùng, Bùa May Mắn, túi/rương mảnh, năm loại hòm và các màu hồ sơ. Hòm Trophy Hunter, Charm Sanctuary và Sacred Set chỉ mở đúng nhóm thẻ tương ứng. Bộ sưu tập có 37 thẻ boss, class, pet, relic, charm và set Median XL; vật phẩm trùng được đổi thành Mảnh linh hồn. `/inventory` hiển thị cả hiệu ứng đang kích hoạt và thời gian còn lại. Giá catalog mặc định được nhân 100 lần so với bảng giá ban đầu; giá do admin tự chỉnh được giữ nguyên. Admin quản lý bằng `/shop add`, `/shop edit`, `/shop remove`, `/shop rotate`, `/shop stock` và `/shop discount`; vật phẩm chỉ được chọn từ catalog hiệu ứng có sẵn.

`/nhiemvu xem` hiển thị ba nhiệm vụ ngày và ba nhiệm vụ tuần; tiến độ được cập nhật trực tiếp từ kết quả các game. `/nhiemvu nhan` nhận các phần thưởng hoàn thành đúng một lần. `/nhiemvu diemdanh` tạo chuỗi tối đa 7 ngày, ngày thứ bảy nhận thêm Hòm Sanctuary. Thẻ Giữ Chuỗi tự bảo vệ khi bỏ lỡ đúng một ngày. Dầu Săn Boss và Cờ Hiệu Mùa Giải có ba lượt dùng, lần lượt nhân đôi sát thương boss và điểm mùa.

`/sukien boss` hiển thị boss cộng đồng hằng tuần. Mỗi chiến thắng tự gây sát thương; người đã đóng góp nhận 100.000 xu và một Hòm Sanctuary sau khi boss bị hạ bằng `/sukien nhan`. `/xephang mua` hiển thị điểm mùa theo tháng; top 10 mùa trước nhận xu và hòm bằng `/xephang nhan`. Admin dùng prefix `!economystats` để xem tổng cung, trung bình số dư, xu tạo ra và xu đã tiêu/hủy trong 24 giờ.

`/anxin user:<người cho> xu:<số lượng> [lydo]` đăng yêu cầu có nút chấp nhận/từ chối trong 30 giây. Chỉ người được xin mới thao tác được; khi chấp nhận, xu được chuyển trong một transaction duy nhất. Mỗi người chỉ được có một yêu cầu mở và phải chờ 60 giây giữa hai yêu cầu.

Lịch sử mua hàng tự xóa sau 7 ngày. Yêu cầu xin xu đã đóng tự xóa cả bài Discord lẫn bản ghi SQLite sau 1 ngày. Kho đồ chỉ giữ một dòng cho mỗi loại vật phẩm/người chơi, nên vật phẩm cộng dồn không làm SQLite tăng một dòng cho mỗi món.

Các trò chơi hiện có:

Không game nào thu phí mở ván. Nối từ và Vua tiếng Việt được mở hoàn toàn miễn phí. Bầu cua, Oẳn tù tì và Tài xỉu chỉ thay đổi số dư theo khoản cược mà người chơi tự chọn, không trừ thêm phí hệ thống.

- `/oantuti chon:<bua|keo|bao> xu:<mức cược>`: thắng nhận lãi bằng tiền cược, hòa hoàn cược.
- `/baucua` mở một bàn cược chung trong 30 giây. Người chơi bấm nút linh vật, nhập số xu trong form và có thể cược nhiều cửa. Linh vật xuất hiện 1/2/3 lần trả lãi 1×/2×/3×.
- `/taixiu` mở bàn Sic Bo chung trong 30 giây. Các nút gồm Tài, Xỉu, Chẵn, Lẻ, Bộ ba bất kỳ và Tổng cụ thể. Tài/Xỉu và Chẵn/Lẻ trả 1:1 nhưng đều thua khi kết quả là bộ ba; Bộ ba bất kỳ trả 31:1; tổng 4–17 trả từ 6:1 đến 62:1 theo độ hiếm.
- `/blackjack xu:<mức cược>` mở một ván riêng với dealer. Người chơi dùng nút Rút bài, Dừng, Gấp đôi, Tách bài hoặc Bỏ ván. Game dùng shoe 6 bộ bài; dealer đứng ở mọi mức 17, Blackjack tự nhiên trả 3:2, thắng thường trả 1:1 và hòa hoàn cược. Chỉ được split một lần khi hai lá cùng hạng; hai Át sau split tự nhận thêm một lá rồi dừng, và Blackjack sau split được tính như thắng thường.
- `/duangua` mở một ván chung cho nhiều người và nhận cược trong 30 giây. Người chơi bấm một trong năm ngựa để nhập cược, có thể cược nhiều ngựa trong cùng ván. Mỗi ngựa có xác suất và multiplier công khai từ x2.8 đến x8.5; multiplier đã gồm tiền cược hoàn lại. Bot khóa toàn bộ cược cùng lúc, công bố thứ tự về đích rồi thanh toán mọi người.
- `/mines xu:<mức cược> min:<1–7>` mở bảng riêng 20 ô. Mỗi ô an toàn làm multiplier tăng theo xác suất còn sống; người chơi có thể rút sau ít nhất một ô hoặc tiếp tục mạo hiểm. Trúng mìn mất cược, mở hết ô an toàn tự động thanh toán. Ván chưa kết thúc được lưu SQLite và dùng lại được sau khi bot restart.
- `/hardcore batdau xu:<mức cược> class:<class>` mở Hardcore Run cá nhân với Barbarian, Assassin hoặc Sorceress. Mỗi lượt dùng nút Tấn công, Phòng thủ, kỹ năng, bình máu hoặc rút thưởng. Boss xuất hiện mỗi 5 tầng; tầng 100 là mốc hoàn thành chính thức và có thể tiếp tục Overrun đến giới hạn kỹ thuật 999. Payout ngừng tăng theo tầng sau 100 và bị giới hạn 10.000.000 xu.
- Các game đặt cược sẽ chọn ngẫu nhiên một câu khịa vui khi người chơi thua và không nhận lại xu nào. Bầu cua, Tài xỉu và Đua ngựa gom phần khịa vào kết quả chung; Oẳn tù tì, Blackjack và Mines hiện ngay trong kết quả cá nhân. Hòa, thắng, còn nhận payout hoặc chủ động bỏ ván sẽ không bị khịa.
- `/noitu batdau`, sau đó các thành viên luân phiên nhập cụm từ trực tiếp vào channel Nối từ. Người vừa nối đúng phải chờ người khác nối đúng mới được chơi tiếp. Bot thả ✅ vào đáp án hợp lệ và lấy chính cụm từ đó làm mốc nối tiếp. Nối từ không có câu khó hoặc giới hạn thời gian; chỉ người kết thúc một chuỗi không còn đường nối mới nhận thưởng x10. Kho Nối từ dùng hơn 32.000 cụm từ. Dùng `/noitu boqua` khi không ai nối được.
- Người chơi báo từ còn thiếu bằng `/noitu baotu` hoặc `!noitu baotu <cụm từ>`, và xem các từ riêng của server bằng `/noitu tudien` hoặc `!noitu tudien [trang]`. Admin xem hàng chờ bằng `/noitu choduyet`, sau đó dùng `/noitu duyet id:<id>` hoặc `/noitu tuchoi id:<id>`. Admin có thể thêm trực tiếp bằng `/noitu themtu tu:<cụm từ>` và xóa bằng `/noitu xoatu tu:<cụm từ>`; cả hai đều có prefix tương đương. Thay đổi có hiệu lực ngay và vẫn được giữ sau khi bot khởi động lại.
- `/vuatiengviet batdau` xáo trộn các chữ cái của một từ hoặc cụm từ có nghĩa. Thành viên nhập đáp án trực tiếp trong channel; câu được giữ đến khi có người giải đúng hoặc dùng `/vuatiengviet boqua`.
- `/doanitem batdau` dùng dữ liệu TU, SU, Set và Runeword từ SQLite; Trophy, Relic, Cycle và UMO không xuất hiện. TU chủ yếu hỏi base item hoặc Required Level. SU và Set có thể hỏi base item, Required Level hoặc Item Level; Runeword chỉ hỏi base và không yêu cầu nhớ chuỗi rune. Câu khó x10 giấu các metadata trực tiếp trong 30 giây.

Các lệnh chơi đều có dạng prefix tương đương khi Message Content Intent đã bật: `!baucua`, `!taixiu`, `!duangua`, `!mines 100 3`, `!hardcore 100 barbarian`, `!oantuti bua 100`, `!blackjack 100`, `!noitu batdau`, `!vuatiengviet boqua` và `!doanitem batdau`. `!xidach 100` là alias của Blackjack và `!hc` là alias của Hardcore Run. Prefix cũ `!doanruneword` vẫn chuyển sang game Đoán item để tương thích. Với game phiên chung, có thể dùng `batdau`, `boqua`, `ketthuc` hoặc alias tiếng Anh `start`, `skip`, `end`.

`/trochoi` hoặc `!trochoi` (`!games`, `!gamehelp`) hiển thị toàn bộ lệnh dành cho người chơi, cách trả lời và các lệnh quản lý xu. Hướng dẫn này không liệt kê lệnh thiết lập hoặc lệnh admin.

Admin đặt phần thưởng riêng cho từng server bằng `/game reward trochoi:<game> xu:<số>` hoặc prefix `!setreward <game> <số>`. `/game rewards` và `!rewards` hiển thị cấu hình hiện tại. Các game hỗ trợ thưởng cố định là `noitu`, `vuatiengviet`, `doanitem`; nhập `0` để tắt thưởng. Bầu cua, Tài xỉu và Oẳn tù tì thanh toán theo tiền cược nên không có mức thưởng cố định.

`/xu lichsu` hiển thị 10 giao dịch xu gần nhất của chính người dùng. `/xephang game trochoi:<game>` hiển thị top 10 riêng theo số trận thắng và tỷ lệ thắng của game được chọn.

Admin đặt trần cược riêng cho từng server/game bằng `/game maxbet trochoi:<game> xu:<10–100000>` hoặc `!setmaxbet <game> <10–100000>`. `/game maxbets` và `!maxbets` hiển thị toàn bộ giới hạn; mặc định là 100.000 xu. Cấu hình áp dụng cho Bầu cua, Tài xỉu, Oẳn tù tì, Blackjack, Đua ngựa, Mines và Hardcore Run. Với game nhiều cửa/ngựa, bot kiểm tra tổng tiền một người đã cược trong cả ván. Blackjack tính cả cược ban đầu, Double và Split vào cùng giới hạn.

Mỗi game bắt buộc có một channel riêng. Admin dùng `/game setup trochoi:<game> channel:<channel>` rồi dùng `/game channels` để kiểm tra. Channel Đoán runeword cũ được tự động chuyển thành channel Đoán item nếu server chưa cấu hình channel này. Bot không cho gán cùng một channel cho hai game và sẽ từ chối lượt chơi gửi sai channel.

Dữ liệu Nối từ và Vua tiếng Việt được đóng gói trong `data/games/vietnamese-game-words.json`. Sau khi lọc trùng và chuẩn hóa cách viết, bot có hơn 27.000 cụm hai tiếng cho Nối từ và hơn 25.000 từ/cụm từ cho Vua tiếng Việt. Bot tạo chỉ mục theo tiếng đầu khi khởi động nên không phải quét toàn bộ dữ liệu ở mỗi lượt và không cần gọi mạng khi chơi. Dữ liệu được tạo lại bằng `npm run build:game-data` từ Viet39K của dự án `duyet/vietnamese-wordlist`; thông tin nguồn và giấy phép nằm trong `data/games/README.md`.

Trong Nối từ, bot chỉ chọn từ của mình khi từ đó vẫn còn đường nối cho người chơi. Nếu người chơi đưa ra từ hợp lệ cuối cùng khiến bot không còn đường đi, bot công bố người đó thắng chuỗi, thưởng x10 mức xu cơ bản và tự mở một chuỗi thường mới. Danh sách từ đã dùng vẫn được lưu theo phiên để hạn chế lặp.

Nối từ và Vua tiếng Việt yêu cầu đúng dấu tiếng Việt. Viết hoa/thường, dấu câu và khoảng trắng thừa vẫn được chuẩn hóa, nhưng câu trả lời bỏ dấu không được tính là đúng.

Phiên đang chơi được lưu trong bảng `game_sessions`, vì vậy không hết hạn và tiếp tục sau khi bot restart. Mỗi server chỉ có tối đa một bản ghi cho mỗi trò chữ; trạng thái cũ được cập nhật tại chỗ nên bảng này không tăng vô hạn.

Trong các channel trả lời trực tiếp, bot giữ im lặng với mọi đáp án sai và chỉ phản hồi khi có người trả lời đúng. Điều này áp dụng cho Nối từ, Vua tiếng Việt và Đoán item để tránh spam channel.

Nối từ, Vua tiếng Việt và Đoán item có 10% khả năng xuất hiện câu khó. Câu khó thưởng gấp 10 lần mức thưởng đã cấu hình và chỉ có hiệu lực trong 30 giây. Khi hết giờ, bot tự thông báo và thay bằng câu thường không giới hạn thời gian. Có thể đổi tỷ lệ bằng `HARD_QUESTION_CHANCE` trong `.env`, ví dụ `0.1` là 10%. Mỗi phiên lưu lịch sử gần đây để ưu tiên câu chưa xuất hiện và giảm lặp.

Ván Bầu cua/Tài xỉu và các lượt cược được lưu trong `multiplayer_rounds` và `multiplayer_bets`. Bot khôi phục bộ đếm khi restart, tự thanh toán khi hết 30 giây và xóa lịch sử ván đã đóng sau 7 ngày. Có thể đổi thời hạn bằng `MULTIPLAYER_ROUND_RETENTION_DAYS` (1–90). Bảng trả thưởng Tài xỉu dựa trên luật Sic Bo của Singapore Gambling Regulatory Authority: `https://www.gra.gov.sg/docs/default-source/game-rules/mbs/dice-games/sic-bo-mbs-version-5.pdf`.

Ván Blackjack đang chơi được lưu trong `blackjack_sessions`; mỗi người chỉ có một ván đang mở trong mỗi server. Bảng chỉ giữ ván chưa kết thúc và xóa ngay khi thanh toán hoặc người chơi bấm Bỏ ván, nên dữ liệu không tăng theo lịch sử chơi. Tiền cược, Double và Split đều được giữ trước khi chia/rút bài; bot chỉ cộng khoản thanh toán sau khi dealer hoàn tất lượt.

Ván Mines đang chơi được lưu trong `mines_sessions` theo cách tương tự và xóa ngay khi trúng mìn, rút thưởng, mở sạch bảng hoặc bỏ ván. Đua ngựa dùng `multiplayer_rounds` và `multiplayer_bets`; lịch sử ván đóng được dọn theo cùng thời hạn lưu của Bầu cua/Tài xỉu.

Hardcore Run lưu duy nhất ván đang hoạt động của mỗi người trong `hardcore_sessions`. Mỗi nút chứa số lượt hiện tại để nút cũ không thể xử lý lại sau khi trạng thái đã thay đổi. Phiên không hoạt động 7 ngày được tính là bỏ run và xóa. `hardcore_records` chỉ giữ một dòng thành tích tổng hợp cho mỗi thành viên/server, gồm tầng cao nhất, số run, số lần chết, rút thưởng và hoàn thành tầng 100; dữ liệu không tăng theo từng lượt chơi.

Gacha Hardcore Run có hòm rỗng, Legendary giả không có chỉ số, đồ Common/Rare/Legendary/Cursed, Mimic và Ancient Mimic. Sau 5 hòm không có Rare, hòm kế tiếp tối thiểu Rare; sau 10 hòm không có Legendary, tỷ lệ Legendary tăng thêm 2% mỗi hòm. Các sự kiện xấu gồm Tax Collector lấy 15% payout, trộm bình máu và Wrong Portal giữ nguyên tầng rồi roll encounter mới.

RNGesus dùng Chaos động thay vì một tỷ lệ cố định. Tỷ lệ base theo tầng được nhân ngẫu nhiên từ x0,25 đến x3, tăng nhiệt theo số tầng chưa gặp, và mỗi tầng có 2,5% khả năng Chaos Spike cộng thêm 4–10%; xác suất cuối cùng tối đa 12%. Embed chỉ hiển thị Chaos xanh/vàng/đỏ. RNGesus không thể bị đánh bại: người chơi phải bỏ chạy, hối lộ, cầu nguyện hoặc dùng Escape Relic. `/hardcore rates` và `!hardcore rates` hiển thị thuật toán tỷ lệ; `/hardcore hoso`, `/hardcore top` cùng các prefix tương ứng hiển thị thành tích.

Hardcore Run tính hit theo Accuracy/Evasion với giới hạn 20–95%. Physical damage dùng giảm trừ `Defense / (Defense + 50 + tầng × 8)` và giới hạn tối đa 75%; magic damage dùng Resistance từ −50% đến 75%. Crit mặc định nhân 1,75 và tối đa 75%. Sau tầng 50, HP và damage của quái nhận thêm scaling lũy thừa để tạo trần độ khó thực tế trước tầng 100.

Tài khoản mới mặc định có 1.000 xu và quà hằng ngày là 500 xu. Có thể đổi bằng `ECONOMY_STARTING_COINS` và `ECONOMY_DAILY_COINS`. Xu chỉ dùng trong game của server, không quy đổi thành tiền hoặc item. Bot chỉ giữ một dòng tổng hợp cho mỗi thành viên; nhật ký giao dịch được tự xóa sau 30 ngày để SQLite không tăng vô hạn. Đổi thời hạn bằng `ECONOMY_LOG_RETENTION_DAYS` (1–365 ngày).

Admin có ID trong `ADMIN_USER_ID` có thể quản lý xu ngay trong Discord bằng prefix command `!addgold @user <số xu> [lý do]` và `!removegold @user <số xu> [lý do]`. Khi mức phạt lớn hơn số dư, `!removegold` chỉ trừ hết số xu hiện có và không để tài khoản bị âm; thao tác cùng lý do được lưu vào lịch sử giao dịch. Có thể đổi dấu `!` bằng `COMMAND_PREFIX`. Các lệnh này không phải slash command và không được đăng ký vào danh sách guild command. Để bật lệnh, mở Discord Developer Portal → Bot → Privileged Gateway Intents, bật **Message Content Intent**, rồi đặt `ENABLE_PREFIX_COMMANDS=true` trong `.env`. Nếu chưa cấu hình quyền, bot vẫn khởi động bình thường nhưng prefix command sẽ được tắt.

`/update` đồng bộ lại toàn bộ database Median XL trực tiếp từ Discord. Lệnh chỉ hoạt động với user có ID nằm trong `ADMIN_USER_ID`, báo cáo số lượng từng nguồn và không cho chạy đồng thời hai lần. Có thể khai báo nhiều admin bằng dấu phẩy, ví dụ `ADMIN_USER_ID=111111111111111111,222222222222222222`. `/sync` là alias tương thích cho cùng thao tác. `/status` hiển thị lần sync gần nhất, số bản ghi theo loại và nguồn nào đang lỗi; command này được đăng ký vào runtime và chỉ admin mới xem được khi `ADMIN_USER_ID` đã cấu hình.

Với Tiered Unique, database vẫn lưu từng Tier 1–4 để giữ dữ liệu đầy đủ, nhưng `/item` sẽ gộp các bản ghi cùng tên/base item và chỉ trả về Tier 4; nếu một item không có Tier 4 thì dùng tier cao nhất đang có. Tìm kiếm được thực hiện theo thứ tự ưu tiên: tên item khớp chính xác, tên bắt đầu bằng query, tên chứa query, base type, group/variant, rồi mới đến stat/raw text. Vì vậy query `raven` sẽ ưu tiên các tên như `Ravenbeak`, `Ravenflock` và `Graven Image` trước các item chỉ có chữ raven trong bonus. Search không phân biệt hoa thường, hỗ trợ dấu cách tùy chọn và keyword một phần. Nếu query khớp một item, bot gửi embed chi tiết. Nếu khớp nhiều item, bot gửi danh sách và select menu; chỉ người gọi lệnh được chọn và phiên chọn hết hạn sau 60 giây. Discord giới hạn select menu tối đa 25 lựa chọn; search service sẽ xếp hạng trước khi cắt kết quả để không làm mất name match quan trọng.

## Autocomplete, phân trang, embed và monitoring

`/item query:` hiện có autocomplete theo tên item, base item, nhóm, tier và stat. Kết quả được xếp hạng theo độ phù hợp và giới hạn 25 lựa chọn theo giới hạn của Discord. Khi search có nhiều hơn 25 kết quả, bot hiển thị select menu theo từng trang với nút `Trước`, `Sau` và `Đóng`; chỉ người gọi lệnh mới được thao tác và phiên hết hạn sau 120 giây. `/sleep query:` tiếp tục gợi ý tên Trophy màu vàng và hỗ trợ tìm một phần tên.

Khi message command đã bật, `/item` cũng dùng được dưới dạng `!item <tên hoặc stat>`. Có thể lọc loại ở đầu query, ví dụ `!item SU Ophiophagus` hoặc `!item RW sword`. Prefix command dùng chung bộ xếp hạng, embed chi tiết và menu chọn kết quả với slash command.

Embed chi tiết dùng màu riêng cho TU, SU, RW, SET, UMO, CYCLE, RELIC, TROPHY và SLEEP. Tiêu đề, category, base item, variant/tier, requirements và stats được tách rõ; mỗi dòng stat được hiển thị bằng bullet và cách một dòng để dễ đọc trên Discord. Các dòng có tính chất tiêu đề hoặc mở đầu nhóm được tạo khoảng cách riêng; stat dài tự động chia thành nhiều embed. Discord không giữ được màu CSS của trang Median XL, nên bot dùng màu embed theo loại item kết hợp với phân nhóm, khoảng cách và bullet để thay thế trực quan. Runeword có các field riêng cho base item, rune sequence và runes; TU có tier/base item; SET, UMO, CYCLE, RELIC, TROPHY và SLEEP có metadata tương ứng. Thumbnail được lấy từ icon item nếu source cung cấp.

Bot ghi log Pino ra console và file `logs/bot.log`, event monitoring dạng JSON Lines tại `logs/events.jsonl` và snapshot sync tại `logs/status.json`. Runtime đã tích hợp monitoring cho sync, command, autocomplete, login, unhandled rejection và uncaught exception. Có thể đổi thư mục log bằng `LOG_DIR`, tên file bằng `LOG_FILE_NAME` và mức log bằng `LOG_LEVEL` trong `.env`. Không nên commit thư mục `logs/` lên Git hoặc upload các log chứa thông tin nhạy cảm.

Chạy `npm run audit:bot` để kiểm tra đồng thời slash command runtime/register, schema command, SQLite integrity, khóa ngoại, số dư âm, JSON phiên game và item không còn trong catalog. Lệnh chỉ đọc trạng thái hiện tại và trả `ok: true` khi không phát hiện lỗi.

## Lưu ý parser

Website có nhiều bố cục bảng/card khác nhau. Parser mặc định dùng DOM table/card và giữ `raw_text` để dễ kiểm tra. Mỗi source được kiểm tra số lượng tối thiểu, mức giảm so với database cũ, type code, content hash và tên đáng ngờ trước khi được ghi. Nếu validation thất bại, dữ liệu cũ của riêng source đó được giữ nguyên và báo cáo sync ghi rõ nguyên nhân.


## Breakpoint calculator

Bot có command `/breakpoint` native trong Discord. Các tham số gồm `character`, `mode`, `weapon`, `speed` và `skill_slow`. Trường `weapon` có autocomplete và hiển thị WSM tương ứng.

Ví dụ:

```text
/breakpoint character:Amazon mode:attack weapon:Short Bow speed:100 skill_slow:None (0)
/breakpoint character:Sorceress mode:cast weapon:Short Staff speed:100 skill_slow:None (0)
```

Các mode hiện hỗ trợ `Attack Speed`, `Cast Speed`, `Block Speed` và `Hit Recovery`. Engine sử dụng bảng `data/speedcalc.json`, được trích xuất từ [Median XL Speed Calculator](https://dev.median-xl.com/speedcalc/) và tệp animation data chính thức của calculator. Công thức frame dùng effective speed, WSM, animation speed, frames per direction và skill slow theo logic JavaScript của trang nguồn.

Khi website thay đổi phiên bản hoặc animation data, cần trích xuất lại `SpeedcalcData.txt`, cập nhật `data/speedcalc.json`, sau đó chạy bộ kiểm thử breakpoint. Vì speed calculator có nhiều trường hợp morph/dual-wield/throwing chuyên biệt, nên các trường hợp nâng cao cần được đối chiếu thêm với website trước khi dùng cho build quan trọng.
