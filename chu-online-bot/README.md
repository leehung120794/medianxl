# Chùa Online - Tu Tiên Nhàn Nhã

Bot Discord mô phỏng hành trình tu luyện trong thế giới tiên hiệp mang màu sắc chùa chiền, thiền định và an lạc.

## Tính năng

- **Tạo nhân vật** với căn cốt ngẫu nhiên
- **Hệ thống căn cốt** quyết định hệ số nhân tu vi
- **Tu luyện và bế quan** tích lũy tu vi theo thời gian
- **Hoạt động chùa**: Thắp hương, lễ Phật, tụng kinh, ngồi thiền, quét sân, chăm sóc hoa sen
- **Đột phá cảnh giới** từ Phàm Nhân đến Tiên Đế
- **Điểm danh hằng ngày** với chuỗi điểm danh
- **Cửa hàng và túi đồ** mua Đan Dược Nghịch Thiên để đổi căn cốt
- **Giao diện Discord Embed** với ảnh và button tương tác

## Cài đặt

### Yêu cầu

- Node.js LTS
- PostgreSQL
- Discord Bot Token và Client ID

### Cài đặt dependencies

```bash
npm install
```

### Cấu hình môi trường

1. Copy file `.env.example` thành `.env`
2. Điền thông tin cấu hình:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DATABASE_URL=postgresql://username:password@localhost:5432/chua_online?schema=public
TIMEZONE=Asia/Ho_Chi_Minh
NODE_ENV=development
```

### Thiết lập database

```bash
# Tạo database migration
npm run prisma:migrate

# Tạo Prisma Client
npm run prisma:generate
```

### Đăng ký Discord commands

```bash
# Build TypeScript
npm run build

# Đăng ký commands
node dist/deploy-commands.js
```

### Chạy bot

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Lệnh Discord

### Lệnh người chơi

- `/batdau` - Tạo nhân vật và random căn cốt
- `/nhanvat` - Xem hồ sơ nhân vật
- `/cancot` - Xem thông tin căn cốt
- `/tuluyen` - Bắt đầu tu luyện
- `/bequan` - Bắt đầu bế quan
- `/nhantuvi` - Nhận phần thưởng tu vi khi phiên hoàn tất
- `/dotpha` - Xem điều kiện và thực hiện đột phá
- `/chua` - Mở bản đồ chùa và hoạt động
- `/diemdanh` - Điểm danh hằng ngày
- `/cuahang` - Mở cửa hàng
- `/tuido` - Xem túi đồ

## Cấu trúc dự án

```
chu-online-bot/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── assets/
│   ├── realms/                # Ảnh cảnh giới
│   ├── locations/             # Ảnh địa điểm
│   ├── activities/            # Ảnh hoạt động
│   └── items/                 # Ảnh vật phẩm
├── src/
│   ├── commands/              # Discord slash commands
│   ├── interactions/          # Button và select menu handlers
│   ├── events/                # Discord event handlers
│   ├── services/              # Business logic
│   ├── engines/               # Calculation engines
│   ├── config/                # Game configuration
│   ├── utils/                 # Utility functions
│   ├── index.ts               # Bot entry point
│   └── deploy-commands.ts     # Command deployment script
├── .env.example               # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Cơ chế game

### Căn cốt

- Phàm Cốt: ×1.0 (40%)
- Linh Cốt: ×1.2 (25%)
- Địa Linh Cốt: ×1.5 (15%)
- Huyền Linh Cốt: ×1.8 (10%)
- Thiên Linh Cốt: ×2.2 (6%)
- Thánh Linh Cốt: ×2.8 (3%)
- Tiên Linh Cốt: ×3.5 (1%)

### Cảnh giới

1. Phàm Nhân
2. Luyện Khí
3. Trúc Cơ
4. Kim Đan
5. Nguyên Anh
6. Hóa Thần
7. Luyện Hư
8. Hợp Thể
9. Đại Thừa
10. Độ Kiếp
11. Chân Tiên
12. Tiên Đế

Mỗi cảnh giới có 9 tầng (Sơ kỳ, Trung kỳ, Hậu kỳ).

## Bảo mật

- Mọi thao tác tài nguyên đều thực hiện trong database transaction
- Chống claim trùng bằng unique constraints
- Không tin dữ liệu từ client, luôn đọc từ database phía server
- Ghi log tất cả thao tác quan trọng

## License

ISC
