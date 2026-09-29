const crypto = require('node:crypto');

const LOSS_TAUNTS = Object.freeze([
  'Nhà cái xin cảm ơn khoản tài trợ đầy tự tin này.',
  'Kèo này đọc rất đúng, tiếc là đọc ngược.',
  'Xu vào bàn nhanh hơn vận may kịp đăng nhập.',
  'Chiến thuật rất bí ẩn, đến kết quả cũng không hiểu.',
  'May mắn vừa đi ngang qua nhưng không ghé bàn này.',
  'Một pha đặt cược giúp nhà cái có thêm niềm tin vào cuộc sống.',
  'Ván này kỹ năng có mặt, còn vận may xin nghỉ phép.',
  'Đừng buồn, ít nhất bạn đã làm con số thống kê đẹp hơn.',
  'Cược thì rất dứt khoát, kết quả cũng dứt xu luôn.',
  'Nhà cái đã nhận xu và gửi lại một bài học kinh nghiệm.',
  'Vận may bảo đang bận, hẹn bạn ở ván sau.',
  'Một cú cược táo bạo, chỉ thiếu mỗi phần thắng.',
]);

function randomLossTaunt() {
  return LOSS_TAUNTS[crypto.randomInt(LOSS_TAUNTS.length)];
}

module.exports = { LOSS_TAUNTS, randomLossTaunt };
