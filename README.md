# Median XL Item Bot

Discord bot chỉ phục vụ tra cứu dữ liệu item Median XL và quản lý database item.

## Lệnh

- `/item query:<từ khóa> type:<loại>` — tìm item theo tên, base hoặc stat; chọn kết quả để xem chi tiết.
- `/update` — admin đồng bộ lại database item từ các nguồn đã cấu hình.
- `/backup gui` — tạo backup SQLite và gửi lên Discord.
- `/backup xoa xacnhan:true` — xóa các file backup cũ trên VPS; không xóa database đang chạy.

## Cài đặt và cập nhật

1. Cài Node.js 18.17 trở lên và chạy `npm install`.
2. Cấu hình `.env`, tối thiểu `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` và `ADMIN_USER_ID`.
3. Đăng ký danh sách command hiện tại bằng `npm run register`.
4. Khởi động bot bằng `npm start`.

Khi cập nhật server, pull các file đã đổi, chạy lại `npm run register`, rồi restart bot. Đăng ký lại command sẽ gỡ các slash command game/profile cũ khỏi guild.

Không cần bật Message Content Intent. Bot chỉ cần Discord Guilds intent.

## Database và backup

SQLite mặc định nằm ở `data/game-bot.sqlite`. `/update` chỉ thay đổi bảng dữ liệu item; các bảng và dữ liệu cũ của game được giữ lại trong SQLite nhưng không còn được nạp vào command/router/runtime.

Bot tạo backup định kỳ tại `data/backups` và có thể gửi snapshot tới `DB_BACKUP_DISCORD_USER_ID`. Khi gửi thành công, snapshot local được xóa; nếu gửi lỗi, file vẫn được giữ để thử lại.

Các thiết lập backup tùy chọn:

```dotenv
DB_BACKUP_INTERVAL_MINUTES=1440
DB_BACKUP_RETENTION=14
# DB_BACKUP_DIR=/duong-dan-luu-backup
# DB_BACKUP_DISCORD_USER_ID=DiscordUserId
```

Dùng `npm run db:backup` để tạo snapshot nhất quán từ terminal. Không copy riêng file SQLite khi bot đang chạy vì giao dịch mới có thể còn trong WAL.

## Database item

`/item` hỗ trợ các loại TU, SU, RW, SET, UMO, CYCLE, RELIC và TROPHY. Dữ liệu được đồng bộ bằng `/update` hoặc `npm run update`.
