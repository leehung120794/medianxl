# Median XL + Tu Tiên Nhàn Nhã Discord Bot

Bot giữ nguyên tra cứu item Median XL và bổ sung một mode idle RPG tu tiên không có chiến đấu.

## Lệnh Median XL

- `/item query:<từ khóa> type:<loại>` — tìm theo tên, base hoặc stat và xem chi tiết.
- `/update` — admin đồng bộ database item.
- `/backup gui` — tạo/gửi backup; `/backup xoa xacnhan:true` dọn snapshot cũ trên VPS.

## Lệnh tu tiên

- `/batdau`, `/nhanvat`, `/cancot` — tạo và xem nhân vật/căn cốt.
- `/chua`, `/nhiemvu`, `/diemdanh` — hoạt động chùa, nhiệm vụ ngày, điểm danh.
- `/tuluyen`, `/bequan`, `/nhantuvi` — bắt đầu và nhận thưởng phiên theo thời gian.
- `/dotpha` — xem trước điều kiện, chi phí và tỷ lệ rồi xác nhận thử.
- `/cuahang`, `/tuido`, `/sudung` — mua và dùng Đan Dược Nghịch Thiên.
- `/bicanh`, `/trogiuptu` — xem địa điểm và hướng dẫn.

Tu vi từ hoạt động, nhiệm vụ và phiên tu luyện được nhân theo căn cốt. Linh thạch, công đức và đạo tâm không bị nhân theo căn cốt. Hoạt động, điểm danh, mua/bán, dùng vật phẩm và đột phá được ghi bằng transaction; mỗi nhân vật chỉ có một phiên tu luyện đang chạy.

## Cài đặt và cập nhật

1. Cài Node.js 18.17 trở lên và chạy `npm install`.
2. Cấu hình `.env` với `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `ADMIN_USER_ID`.
3. Chạy `npm run register` để đăng ký slash command cho guild.
4. Chạy `npm start`.

Sau khi cập nhật server, chạy lại `npm run register`, sau đó restart bot. Bot chỉ cần Discord Guilds intent; không cần Message Content Intent.

## Database và backup

SQLite mặc định ở `data/game-bot.sqlite`; bot tự tạo backup định kỳ trong `data/backups`. Có thể cấu hình `DB_BACKUP_INTERVAL_MINUTES`, `DB_BACKUP_RETENTION`, `DB_BACKUP_DIR` và `DB_BACKUP_DISCORD_USER_ID`. `/backup` chỉ dành cho admin. Backup gửi Discord thành công sẽ được xóa khỏi VPS; khi gửi lỗi, snapshot được giữ lại để thử lại.

Dùng `npm run db:backup` để tạo snapshot nhất quán từ terminal. Không copy riêng file SQLite khi bot đang chạy vì giao dịch mới có thể còn trong WAL.

## Dữ liệu Median XL

`/update` đồng bộ bảng item hiện có. Không thay đổi cấu trúc hay dữ liệu item khi cài phần tu tiên.
