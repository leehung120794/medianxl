# Chùa Online - Tích hợp vào Median XL Bot

Bot Chùa Online đã được tích hợp vào bot Median XL chính, sử dụng chung cấu trúc JavaScript và SQLite database.

## Cấu trúc tích hợp

### Commands
Các lệnh Chùa Online có prefix `chu` để tránh xung đột với lệnh hiện có:
- `/chubatdau` - Tạo nhân vật
- `/chunhanvat` - Xem hồ sơ nhân vật
- `/chutuluyen` - Bắt đầu tu luyện
- `/chunhantuvi` - Nhận phần thưởng tu vi
- `/chudotpha` - Đột phá cảnh giới
- `/chuchua` - Mở bản đồ chùa và hoạt động
- `/chudiemdanh` - Điểm danh hằng ngày
- `/chucuahang` - Mở cửa hàng
- `/chutuido` - Xem túi đồ
- `/chubequan` - Bắt đầu bế quan
- `/chunhiemvu` - Xem nhiệm vụ hằng ngày

### Database Tables
Tất cả tables Chùa Online có prefix `chu_`:
- `chu_spiritual_roots` - Cấu hình căn cốt
- `chu_characters` - Dữ liệu nhân vật
- `chu_cultivation_sessions` - Phiên tu luyện
- `chu_root_change_logs` - Lịch sử đổi căn cốt
- `chu_items` - Vật phẩm
- `chu_inventory` - Túi đồ
- `chu_temple_activities` - Hoạt động chùa
- `chu_activity_logs` - Lịch sử hoạt động
- `chu_daily_checkins` - Điểm danh
- `chu_transactions` - Ledger tài nguyên

### Component Handlers
Custom ID prefix: `chu:`
- `chu:character:*` - Các nút trên hồ sơ nhân vật
- `chu:cultivation:*` - Chọn thời gian tu luyện/bế quan
- `chu:breakthrough:*` - Đột phá cảnh giới
- `chu:temple:*` - Hoạt động chùa
- `chu:shop:*` - Cửa hàng
- `chu:inventory:*` - Túi đồ và sử dụng vật phẩm

## Cấu hình

Các file cấu hình nằm trong `src/chu-online/config/`:
- `spiritualRoots.js` - Cấu hình căn cốt
- `realms.js` - Cấu hình cảnh giới
- `cultivation.js` - Cấu hình tu luyện
- `templeActivities.js` - Cấu hình hoạt động chùa
- `items.js` - Cấu hình vật phẩm
- `quests.js` - Cấu hình nhiệm vụ

## Assets

Ảnh minh họa nằm trong `assets/chu-online/`:
- `realms/` - Ảnh cảnh giới
- `locations/` - Ảnh địa điểm
- `activities/` - Ảnh hoạt động
- `items/` - Ảnh vật phẩm

## Đăng ký Commands

Các lệnh Chùa Online đã được thêm vào `commandRegistry.js`. Khi chạy bot, chúng sẽ tự động được đăng ký với Discord.

## Sử dụng

1. Khởi động bot như bình thường:
   ```bash
   node src/index.js
   ```

2. Người dùng sử dụng lệnh:
   - `/chubatdau` để tạo nhân vật mới
   - `/chunhanvat` để xem hồ sơ
   - `/chutuluyen` để bắt đầu tu luyện
   - `/chunhantuvi` để nhận phần thưởng
   - `/chudotpha` để đột phá cảnh giới
   - `/chuchua` để tham gia hoạt động chùa
   - `/chudiemdanh` để điểm danh hàng ngày
   - `/chucuahang` để mua vật phẩm
   - `/chutuido` để xem và sử dụng túi đồ
   - `/chubequan` để bế quan
   - `/chunhiemvu` để xem nhiệm vụ

## Tính năng đã tích hợp

- ✅ Tạo nhân vật với random căn cốt
- ✅ Xem hồ sơ nhân vật với button interactions
- ✅ Tu luyện với select menu chọn thời gian
- ✅ Nhận phần thưởng tu vi khi phiên hoàn tất
- ✅ Đột phá cảnh giới (tiểu 100%, đại có tỷ lệ)
- ✅ Bế quan với hiệu suất cao hơn tu luyện thường
- ✅ Hoạt động chùa (Chính Điện, Thiền Đường, Vườn Hoa Sen, Sân Chùa)
- ✅ Điểm danh hằng ngày với chuỗi điểm danh
- ✅ Cửa hàng mua Đan Dược Nghịch Thiên
- ✅ Túi đồ và sử dụng vật phẩm
- ✅ Đan Dược Nghịch Thiên để đổi căn cốt
- ✅ Nhiệm vụ hằng ngày
- ✅ Button interactions cho refresh hồ sơ, đột phá
- ✅ SQLite database với transaction support
- ✅ Hệ thống component routing thống nhất

## Lưu ý

- Database sử dụng SQLite cùng với bot chính
- Rate limiting áp dụng giống như các lệnh khác
- Logging sử dụng cùng hệ thống pino
- Error handling thống nhất với bot chính
- Tất cả tài nguyên được ghi log trong `chu_transactions` table
