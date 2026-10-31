# Vietnamese Discord Game Bot

Bot giữ các trò chơi còn hoạt động cùng economy xu riêng. Tra cứu Median XL vẫn dùng `/item`, `/update` và hệ thống backup riêng.

## Trò chơi

- Bầu cua, Tài xỉu
- Xì dách, Poker, Đua ngựa nhiều người, Dò mìn
- Vua tiếng Việt

## Cài đặt

1. Cài Node.js 18.17 trở lên.
2. Giải nén và chạy `npm install`.
3. Sao chép `.env.example` thành `.env`, sau đó điền token và ID Discord.
4. Chạy `npm run register` để đăng ký slash command cho server.
5. Chạy `npm start`.

### Chạy bằng Docker

1. Tạo `.env` từ `.env.example` và đăng ký lệnh một lần bằng `npm run register`.
2. Chạy `docker compose up -d --build`.
3. Database, WAL, backup và log được giữ ngoài container trong `./data` và `./logs`.
4. Dùng `docker compose logs -f gamebot` để theo dõi; `docker compose down` sẽ gửi SIGTERM và cho bot tối đa 30 giây để đóng sạch.

Bot cần bật **Message Content Intent** trong Discord Developer Portal nếu muốn dùng prefix command và trả lời trực tiếp trong Vua tiếng Việt.

## Lịch sử cập nhật

Người chơi dùng `/changelog` để xem thời gian và nội dung cập nhật bằng tiếng Việt. Mỗi trang có 3 bản cập nhật, mới nhất ở trang 1, hiển thị giờ Việt Nam (UTC+7). Có nút Trước/Sau, Mới nhất/Cũ nhất và tùy chọn `/changelog trang:2`.

Sau mỗi lần cập nhật, audit thay đổi rồi ghi lịch sử trước khi commit/push:

```sh
npm run changelog:add -- --title "Sinh tồn: cập nhật cân bằng" --change "Mô tả thay đổi cho người chơi" --change "Nội dung bổ sung"
```

Công cụ tự ghi thời gian cập nhật và audit. Khi bổ sung lịch sử cũ, thêm `--commit <SHA>` để lấy thời gian commit từ Git; không sửa nội dung lịch sử để phản ánh thay đổi mới. Dữ liệu ở `src/changelog.json`, không cần thêm bảng database. Chạy `npm run test:changelog` để kiểm tra dữ liệu và phân trang.

Để lệnh mới xuất hiện trên Discord: sau khi pull, chạy `npm run register` trên server đã có env Discord rồi restart bot.

## Lệnh tin nhắn (prefix)

Mọi lệnh slash đang đăng ký đều có bản prefix dùng chung handler, quyền quản trị, kiểm tra bảo trì và tham số với slash. Đặt `ENABLE_MESSAGE_COMMANDS=true` (hoặc `ENABLE_PREFIX_COMMANDS=true`) và bật Message Content Intent; `COMMAND_PREFIX` mặc định là `!`.

- Game: `!baucua`, `!taixiu`, `!xidach`, `!poker`, `!duangua`, `!domin`, `!vtv`.
- Người chơi: `!batdau`, `!hoso`, `!xu`, `!xephang`, `!anxin`.
- Hướng dẫn/quản trị: `!trogiup`, `!huongdan`, `!luat`, `!quantri`.
- Chức năng con: `!vtv batdau`, `!vtv boqua`, `!quantri baotri`.
- Tham số theo thứ tự trong slash: `!domin 1000 3`, `!xu chuyen @nguoinhan 1000`, `!quantri datkenh baucua #kenh`.
- Có thể ghi tên tham số để bỏ qua tùy chọn; chuỗi nhiều từ đặt trong ngoặc kép. Prefix không có autocomplete của Discord.
- Median XL: `!item [loại] <từ khóa>`, `!update` cập nhật dữ liệu item, `!backup` sao lưu dữ liệu bot.

Tin trả lời prefix hiển thị trong kênh, kể cả bảng vốn là ephemeral của slash. Những nút mở bảng riêng tiếp tục dùng tương tác Discord và kiểm tra người sở hữu như trước.

## Bắt đầu và tiến độ

- `/batdau`: hướng dẫn nhanh; không có gói quà tân thủ.
- `/trogiup` và `/huongdan`: xem các lệnh và trò chơi còn hoạt động.
- Lệnh game: `/baucua`, `/taixiu`, `/xidach`, `/poker`, `/duangua`, `/domin` và `/vtv`.
- Cửa hàng, Gacha, nhiệm vụ/điểm danh/tân thủ và vật phẩm hỗ trợ game đã được gỡ.
- `/xephang`: bảng xếp hạng chung có dropdown để chuyển giữa tài sản và từng game.
- `/xu vanchoi`: xem kết quả, tiền cược và payout của 10 ván gần nhất.
- `/hoso [nguoidung]`: hồ sơ và thống kê bảy game còn hoạt động.

## Kiểm chứng công bằng

Các game cược tiếp tục dùng seed và HMAC-SHA256 nội bộ để tạo kết quả xác định. Thông tin kỹ thuật về seed/commit không hiển thị trên embed game để giao diện ngắn gọn hơn.

### Xì dách

- Chọn đối thủ bằng `chedochoi`: **nhà cái bot** (mặc định, chơi một mình với tách bài) hoặc **người chơi khác**: `/xidach ante:<số xu> chedochoi:nguoichoi` mở bàn, bạn làm nhà cái, tối đa 3 người vào bàn trong 30 giây.
- Ở bàn nhiều người, bài mỗi người được giữ kín: bấm **Xem bài của tôi** để xem bài và Rút bài/Dừng trong bảng riêng (chỉ bạn thấy); bot nhắc người đến lượt trong kênh và bài chỉ lộ khi ván kết thúc.
- Với prefix: `!xidach <số xu> [bot|nguoichoi]` (mặc định bot).

Trong ván với nhà cái bot, thắng thường nhận 2× tổng cược, Xì dách hoặc Xì bàng tự nhiên nhận 2,5×. **Xì bàng (đúng 2 lá A) là bộ mạnh nhất**, tự động dừng và thắng cả Ngũ linh lẫn Xì dách; cùng Xì bàng thì hòa. Người chơi chỉ được Dừng khi có ít nhất 16 điểm nhà cái rút đến khi có ít nhất 15 điểm. Người chơi quắc trên 21 thua, nhưng nếu nhà cái cũng quắc thì **hòa** và hoàn cược; khi quắc mọi nút thao tác bị khóa. Luật 16/15 và cùng quắc = hòa áp dụng cho cả bàn nhiều người và đấu người (đấu người vốn đã hòa khi cả hai quắc). Lưu ý cân bằng: với hệ số 2× và luật mới, mô phỏng cho RTP khoảng 108% với chiến thuật cơ bản (người chơi có lợi); hạ `REGULAR_WIN_MULTIPLIER` xuống 1,8 để về khoảng 99%. Ngũ linh (đủ 5 lá không quắc) thắng nhà cái không có Ngũ linh hoặc Xì bàng. Trong ván 1v1, mỗi người xem tay bài bằng nút riêng, sau đó chọn Rút bài hoặc Dừng. Người có tay gần 21 nhất thắng toàn bộ tiền cược; Xì bàng được ưu tiên cao nhất, rồi đến Xì dách tự nhiên. Nếu ván hết hạn, cược được hoàn cho cả hai.

### Poker

`/poker` chơi với hai bot và hỗ trợ Texas Hold’em, Poker 6+, Crazy Pineapple và Omaha 5 lá. Lệnh không cần nhập buy-in: mỗi người tự đóng ante 50 xu (đổi bằng `POKER_ANTE`), sau đó xu chỉ bị trừ thêm khi Call hoặc Raise. Ngay từ Flop, mỗi bot lật công khai một lá tẩy và giữ nguyên lá đó trong suốt ván. Ván có ba hành động Tố, Theo/Check và Bỏ bài; Turn và River có vòng cược riêng. Nhập toàn bộ stack trong cửa sổ Tố để All-in. Giao diện đánh giá bộ bài mạnh nhất hiện tại của người chơi sau mỗi lượt. Bot cân nhắc sức mạnh bài, draw sảnh/thùng, pot odds, áp lực stack, phong cách riêng và bluff; bot Crazy Pineapple tự chọn lá bỏ tốt nhất nhưng không được bỏ lá đã công khai. Hệ thống tự động hoàn phần cược không ai theo, tạo Main Pot và nhiều Side Pot theo mức đóng góp, rồi xét riêng những người đủ điều kiện cho từng pot khi Showdown. Omaha bắt buộc dùng đúng hai lá tẩy và ba lá chung.

`/domin` có một ô đặc biệt không trùng vị trí mìn. Mở một ô cùng hàng hoặc cùng cột với ô đặc biệt sẽ phát cảnh báo trong mục tín hiệu riêng, còn ô trên bàn vẫn hiển thị 💎 như mọi ô an toàn khác. Tìm đúng ô 🌟 sẽ nhân thêm x1.50 vào multiplier hiện tại cho đến khi rút thưởng. Hệ số cơ sở đã tính xác suất nhận bonus và giảm dần theo số ô mở để tránh chiến thuật rút thưởng tạo xu vô hạn. Bỏ ván ngay không tính EXP.

Dò mìn dùng 2–7 mìn trên bàn 20 ô. Không còn vật phẩm bảo hiểm hay vật phẩm hỗ trợ trong game.

### Đua ngựa trực tiếp

Sau 30 giây nhận cược, bot khóa cược và hiển thị cuộc đua trực tiếp trong 18 giây qua 9 chặng. Hệ thống có 20 ngựa thường và 1 Thiên Mã đặc biệt; mỗi ván chọn đúng 6 con. Thiên Mã có 7% cơ hội xuất hiện và chiếm một trong sáu vị trí. Mỗi ngựa có kỹ năng và nhịp chạy riêng: xuất phát nhanh, ôm cua, giữ sức, núp gió, chống sự cố hoặc lội ngược dòng. Hệ số được tạo riêng cho từng ván theo RNG, ngày, khung giờ và phong độ hiện tại rồi được khóa trong suốt ván. Trong cuộc đua có thể xuất hiện các biến cố gây giảm tốc như đau bụng, vấp chân, dừng gặm cỏ, chạy nhầm làn hoặc mải tạo dáng. Khi cán đích, bot công bố bục vinh quang, khoảnh khắc quyết định, thông số nhà vô địch và thanh toán cược.

Ngựa được chia thành các hệ Cân bằng, Tốc độ, Bền bỉ, Kỹ thuật, Bí ẩn, Phòng thủ, Đột biến và Thần thoại. Sau khi khóa cược, bot mới RNG và công bố debuff của đường đua như mưa lớn, bùn lầy, gió ngược, cua gắt, nắng nóng, sương mù, mặt đường trơn hoặc khán đài náo loạn. Debuff tăng hoặc giảm cơ hội chiến thắng theo hệ ngựa và không được tiết lộ trong thời gian đặt cược.

## Thiết lập kênh

Dùng `/quantri datkenh` để đặt kênh cho từng game. Đua ngựa là bàn chung nhiều người và nhận cược trong 30 giây.

Các lệnh thông thường có trong `/trogiup` và `/huongdan`. Quản trị viên dùng `/quantri` để cấu hình kênh, phần thưởng, giới hạn cược và vận hành.

`/hoso` lấy cấp độ và thanh EXP làm tiến trình chính thay cho tỷ lệ thắng tổng. EXP cần cho cấp kế tiếp bằng cấp hiện tại nhân hệ số cấu hình; mỗi mốc cấp tự hiển thị phần thưởng kế tiếp. Mỗi ván thua/hòa nhận 10 EXP; ván thắng nhận `10 + floor(xu lãi / 2.000)`, tối đa 500 EXP/ván. Kết quả EXP và cấp mới được ghi ngay trên embed kết quả. Vua Tiếng Việt không nhận EXP trực tiếp từ ván chơi và trang chi tiết chỉ ghi tổng xu đã kiếm được, không hiển thị tỷ lệ thắng/thua.

Quản trị viên có thể dùng `/quantri kinhte` để xem tổng cung và dòng xu trong 24 giờ, hoặc `/quantri trangthai` để kiểm tra tính toàn vẹn database, backup gần nhất, phiên đang hoạt động và lỗi runtime.

Các biến cân bằng game không còn bắt buộc phải sửa file rồi khởi động lại bot. Dùng `/quantri xemcauhinh` để xem và chỉnh giá trị bằng menu, hoặc `/quantri khoiphuc` để trở về giá trị `.env`/mặc định theo từng server. Hiện hỗ trợ cấu hình economy, phần thưởng game, tỷ lệ câu khó, ante Poker và hệ số EXP/level; thay đổi áp dụng ngay, riêng xu khởi đầu chỉ áp dụng cho tài khoản được tạo mới.

Admin dùng `/quantri xoadulieu` để xóa xu, kim cương cũ hoặc EXP/cấp của một người chơi. Bỏ trống người chơi để xem trước số tài khoản bị ảnh hưởng và xác nhận thao tác trên toàn server.

`/quantri xoadulieu dulieu:RESET SERVER` (bỏ trống người chơi) xóa dữ liệu đã lưu của server: ví, cấp/EXP, lịch sử, thành tựu, thống kê, xếp hạng và ván còn tồn tại. Cấu hình kênh, phần thưởng, giới hạn cược và cân bằng game được giữ nguyên.

## Vận hành và cân bằng

- `npm run test:coverage`: chạy test và bắt buộc đạt ngưỡng coverage trong CI.
- `npm run test:stress -- 1000 12`: mô phỏng 1.000 người trên 12 kết nối, thao tác xu đồng thời, SQLite bị giữ khóa và tiến trình khởi động lại sau thanh toán.
- `npm run simulate:rtp -- 1000000`: mô phỏng RTP và làm CI thất bại khi vượt `RTP_MAX_PERCENT`. Các cửa cược xúc xắc được liệt kê chính xác toàn bộ kết quả để tránh cảnh báo sai do nhiễu Monte Carlo. Xì dách với nhà cái được mô phỏng bằng đúng luật của game (bộ bài 6 bộ không hoàn lại, quắc luôn thua, Ngũ linh, split, double; không tính vật phẩm) và có test đối chiếu từng ván với engine thật; RTP ước tính khoảng 91–95% tùy chiến thuật.
- `/luat` mở luật ngắn theo từng game. Kết quả có nút chơi lại; thành tựu mới hiện ngay và huy hiệu xuất hiện trên `/hoso`.

SQLite được tạo tự động tại `data/game-bot.sqlite`, dùng WAL và `synchronous=FULL` để đồng bộ mỗi commit trước khi báo thành công. Bot tạo backup nhất quán khi khởi động, sau mỗi 24 giờ và khi dừng bình thường vào `data/backups`. Mỗi snapshot được kiểm tra toàn vẹn trước khi dùng. Khi DM Discord đã cấu hình và gửi thành công, bot xóa file snapshot khỏi VPS; nếu gửi lỗi hoặc chưa cấu hình người nhận, snapshot vẫn được giữ local để thử lại. Admin có thể dùng `/backup gui` để tạo và gửi ngay, hoặc `/backup xoa xacnhan:true` để xóa các snapshot local; lệnh này không xóa database bot đang chạy. Dùng `/update` để đồng bộ database item Median XL; lệnh terminal tương đương là `npm run update` (hoặc `npm run sync`).
`/quantri ketthucvan mavan:<mã>` buộc kết thúc các ván Bầu cua, Tài xỉu, Xì dách, Poker, Đua ngựa hoặc Dò mìn đang hoạt động và hoàn cược theo luật của từng game. Ván Xì dách với bot và Dò mìn quá thời hạn sẽ được xử lý tự động; bàn nhiều người có thời hạn chờ riêng.

Duel và bàn Xì dách đã kết thúc được giữ `GAME_RECORD_RETENTION_DAYS` ngày (mặc định 7) rồi tự xóa cùng dữ liệu bộ bài/tay bài.

Khi nhận `SIGINT` hoặc `SIGTERM`, bot ngừng nhận thao tác mới, dừng timer, chờ tối đa 10 giây cho handler đang chạy, chờ backup đang thực hiện rồi tạo một backup mới trước khi đóng Discord/SQLite và kênh IPC. Nếu handler quá hạn, chỉ dữ liệu đã commit được bảo vệ. Khi có `uncaughtException`, bot chờ backup đang chạy và đóng database nhưng không tạo thêm bản mới từ tiến trình lỗi. Mất điện/`SIGKILL` không chạy được bước shutdown; SQLite phục hồi transaction đã commit từ WAL trên ổ đĩa còn nguyên.

## Emoji của ứng dụng (Developer Portal → Bot → Emojis)

Emoji tải lên ở Developer Portal dùng được ở mọi server mà bot có mặt. Khi khởi động bot tự tải danh sách và tra id theo tên. Trong code dùng `appEmoji` hoặc `appEmojiObject` (`src/utils/appEmoji.js`).

## Định dạng tin nhắn kết quả và thưởng

Game dùng chung `src/utils/rewardText.js`: xu (`:coin:`) và EXP (`:test_tube:`) được ghi gọn cùng kết quả của người chơi.

```
<người chơi> thắng: +102.000 :coin: +11 :test_tube:
🎉 Thắng: +102.000 :coin: · +11 :test_tube:
```

Số xu là **thay đổi ròng** (tiền nhận về − tiền cược): thắng `+`, thua `-`, hòa `±0`.

## Hệ số thắng cược 1-1 với nhà cái

`/quantri hesothang` mở bảng (menu + modal) để admin chỉnh **hệ số thắng** của các game đấu 1-1 với nhà cái. Hệ số là tổng tiền nhận về / tiền cược khi thắng (x2 = ăn 1 đền 1), cho phép từ **x1,1 đến x3**:

| Game | Mặc định | Phạm vi áp dụng |
|---|---|---|
| Xì dách (với bot) | x2 | Thắng thường và Ngũ linh; Xì dách/Xì bàng tự nhiên = hệ số + 0,5 |
| Tài xỉu | x2 | Cửa Tài/Xỉu/Chẵn/Lẻ (ra bộ ba vẫn thua); Bộ ba và Tổng cụ thể giữ nguyên |

Hệ số được khóa vào ván lúc bắt đầu (Tài xỉu: lúc mở ván), nên ván đang chơi không bị đổi giữa chừng. Bảng hiển thị RTP ước tính khi chơi tối ưu và không dùng vật phẩm, kèm cảnh báo ⚠️ nếu trên 100% (người chơi có lợi). Giá trị được lưu theo từng server và có nút **Khôi phục mặc định**. Chênh lệch nhỏ vì làm tròn xu xuống số nguyên.

## Các chế độ đã gỡ
Các nội dung về Rift Paradox, Tháp Định Mệnh và Sinh tồn trong các bản cũ đã được gỡ khỏi bot.

### Backup và phục hồi khi server lỗi

Không copy riêng file `game-bot.sqlite` khi bot đang chạy: giao dịch mới có thể còn trong `-wal`. Dùng `npm run db:backup` để tạo snapshot nhất quán bằng SQLite Backup API; chạy từ thư mục bot với cùng `DB_PATH`/env. `/quantri trangthai` hiển thị lần backup thành công, lỗi, lịch sao lưu và chế độ ghi; trạng thái toàn vẹn không đồng nghĩa đã có backup ngoài server.

Có thể cấu hình trên server:

```dotenv
DB_BACKUP_INTERVAL_MINUTES=15
DB_BACKUP_RETENTION=14
# DB_BACKUP_DIR=/duong-dan-luu-backup
```

`DB_BACKUP_INTERVAL_MINUTES` (1–10080) ưu tiên hơn `DB_BACKUP_INTERVAL_HOURS`; bỏ trống sẽ dùng cấu hình giờ cũ, mặc định 24 giờ. Retention là số bản, không phải số ngày: 14 bản mỗi 15 phút giữ khoảng 3,5 giờ, và restart/shutdown tạo thêm bản làm khoảng thời gian lưu ngắn hơn. Tăng retention (2–90) nếu ổ đĩa đủ dung lượng. Theo dõi dung lượng ổ đĩa vì mỗi snapshot là toàn bộ database, không phải bản tăng dần. Không ghi live SQLite lên filesystem mạng; chỉ chuyển file backup đã hoàn tất ra ngoài.

Với PM2, đặt `kill_timeout: 120000` trong cấu hình ứng dụng hiện có để bot có thời gian drain và backup trước khi bị kill. Mặc định PM2 chỉ đợi khoảng 1,6 giây. Nếu chạy Docker, cấp `stop_grace_period` đủ dài tương ứng. Thời gian cần thực tế phụ thuộc kích thước database/ổ đĩa; không thể cam kết backup hoàn tất trước khi supervisor cưỡng bức dừng.

Khi cần phục hồi:

1. Dừng bot bằng PM2 và giữ bot dừng trong lúc phục hồi.
2. Chọn một bản backup nguyên vẹn; giữ database cũ và các sidecar để có thể điều tra.
3. Chạy `npm run db:restore -- "/duong-dan/backup.sqlite" "/duong-dan/game-bot-restored.sqlite"`. Thư mục đích phải tồn tại, file đích và các sidecar chưa được tồn tại. Công cụ kiểm tra source, tạo snapshot độc lập rồi xuất bản nguyên tử; không ghi đè database cũ và không tự chạy migration.
4. Đặt `DB_PATH` tới file mới, khởi động bot và kiểm tra `/quantri trangthai`, xu/túi đồ/lượt chơi. Bot sẽ chạy migration bình thường nếu phiên bản code mới hơn bản backup.

Phục hồi backup sẽ mất những thay đổi sau thời điểm snapshot. Nếu ổ đĩa còn nguyên, hãy ưu tiên phục hồi live SQLite cùng WAL của nó trước khi quay về bản backup cũ. Nếu mất hẳn server/ổ đĩa, cần một bản sao ngoài server; bot đã hỗ trợ gửi file qua DM Discord như hướng dẫn bên dưới. Muốn giảm mất dữ liệu xuống gần 0 khi mất máy chủ cần cơ chế sao chép liên tục/commit sang một hệ thống độc lập, khác với snapshot định kỳ.

Chạy `npm run test:db:recovery`: kiểm tra kill tiến trình giữa transaction, phục hồi xu/lượt chơi, bản backup độc lập, retention, lỗi backup, shutdown khi Discord chưa ready và chờ thao tác đang chạy. Kiểm tra SIGKILL không mô phỏng được mất điện thật hoặc lỗi phần cứng.

Tham khảo: [SQLite WAL](https://www.sqlite.org/wal.html), [SQLite synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous), [SQLite Backup API](https://www.sqlite.org/backup.html), [PM2 graceful shutdown](https://pm2.keymetrics.io/docs/usage/signals-clean-restart/).


### Nhận backup qua DM Discord

Bot này mặc định gửi backup tới User ID `697794640148955206`, theo cấu hình `src/discordBackupConfig.json`. Có thể đổi bằng `DB_BACKUP_DISCORD_USER_ID`; đặt biến này thành chuỗi rỗng để tắt gửi DM. Không suy ra người nhận từ danh sách admin và không gửi ra channel công khai. Cấu hình chỉ chứa User ID, không chứa token.

Sau khi kết nối Discord, bot gửi bản snapshot mới nhất đã kiểm tra, rồi gửi các bản theo lịch backup và bản cuối lúc dừng bình thường. Gửi chạy nền, không giữ handler game phải chờ. Lịch mặc định vẫn 24 giờ; đặt `DB_BACKUP_INTERVAL_MINUTES=15` nếu muốn gửi mỗi 15 phút. `npm run db:backup` tạo snapshot tại chỗ, không tự đăng nhập Discord để gửi DM; scheduler trong bot mới thực hiện gửi.

File được nén bằng gzip qua stream; mỗi phần upload tối đa 8 MiB để giữ RAM thấp, mỗi request chỉ gửi một phần. Một backup tối đa 100 phần; file quá lớn sẽ báo lỗi và vẫn giữ snapshot local. Với một phần, file `.sqlite.gz` và `.manifest.json` nằm trong cùng tin nhắn. Với nhiều phần, bot gửi `.gz.part001`, `.gz.part002`... và cuối cùng gửi manifest xác nhận hoàn tất. Không coi những phần chưa có manifest cuối là một backup hoàn chỉnh.

Manifest chứa kích thước, thứ tự file và SHA-256 của từng phần, file nén và database gốc. Nén gzip không phải mã hóa. Đây là toàn bộ database của bot, chỉ gửi tới chủ bot đã chỉ định. `/quantri trangthai` hiển thị riêng backup local và DM thành công gần nhất, cùng lỗi gửi. Bot không tự xóa những DM backup cũ.

Nếu DM bị chặn, lỗi mạng, file bị Discord từ chối hoặc timeout, local backup vẫn giữ nguyên; bot báo lỗi và thử gửi bản mới nhất sau 5 phút. Mỗi lần gửi có deadline mặc định 60 giây, đổi bằng `DB_BACKUP_DISCORD_TIMEOUT_SECONDS` (5–600); snapshot được ghi nhận đã gửi chỉ sau khi Discord chấp nhận toàn bộ file/manifest. Khi Discord chưa kết nối, bot vẫn backup local và chờ kết nối để gửi. Mất điện/SIGKILL không thể gửi bản cuối; phục hồi ngoài server chỉ đến bản DM đã hoàn tất gần nhất.

Bật quyền nhận DM từ bot, cùng server với bot và không chặn bot. Sau khi pull/restart, kiểm tra DM đầu tiên và `/quantri trangthai`; kiểm tra giả lập không thay thế cho việc xác nhận nhận file thật. Với PM2 nên đặt `kill_timeout: 180000` cho cấu hình timeout mặc định để có thời gian chờ lượt chơi, upload đang chạy và upload snapshot cuối; tăng tương ứng nếu tăng deadline hoặc database lớn.

Để phục hồi trên máy mới:

1. Mở các tin nhắn DM backup và tải file nén/tất cả các phần cùng manifest, giữ nguyên tên file, đặt chung một thư mục. URL CDN đính kèm có hạn; mở lại tin nhắn để lấy link mới, không dùng một URL đã lưu lâu làm nơi lưu duy nhất.
2. Dừng bot, giữ database cũ. Chạy `npm run db:restore:discord -- "/thu-muc/backup.manifest.json" "/thu-muc/game-bot-restored.sqlite"`. Thư mục đích phải tồn tại; file đích và sidecar chưa được tồn tại.
3. Công cụ kiểm tra phần thiếu/hỏng và SHA-256, ghép/giải nén bằng stream rồi kiểm tra SQLite; file hỏng không được xuất bản và database cũ không bị ghi đè.
4. Đặt `DB_PATH` tới database đã phục hồi, khởi động bot và kiểm tra dữ liệu.

Có thể giải nén một file `.sqlite.gz` rồi dùng `db:restore` như trước; công cụ manifest giúp kiểm tra thêm hash. Dữ liệu sau thời điểm snapshot sẽ không có trong bản phục hồi. Giữ DM và nên tải thêm bản quan trọng về máy: Discord là một nơi nhận file độc lập với server bot, không phải cam kết lưu trữ database vĩnh viễn.

Chạy `npm run test:db:discord` để kiểm tra recipient, gzip/chia file, checksum/phục hồi, lỗi DM, deadline, retry và gửi khi shutdown. Test dùng transport giả lập, không gửi dữ liệu thật.

Tham khảo: [Discord Create DM](https://docs.discord.com/developers/resources/user#create-dm), [upload file](https://docs.discord.com/developers/reference#uploading-files), [URL đính kèm có thời hạn](https://docs.discord.com/developers/reference#signed-attachment-cdn-urls).
