# Các lời nguyền dành cho boss Sinh tồn

Tài liệu này đề xuất các lời nguyền để tạo biến thể cho trận boss. Đây là tài liệu thiết kế, chưa thay đổi mã nguồn hay cân bằng trong game.

## Quy tắc chung

- Mỗi trận chỉ có một lời nguyền boss đang hoạt động.
- Giao diện báo trước lời nguyền và cách nó kích hoạt trước khi người chơi chọn hành động.
- Lời nguyền thay đổi quyết định chiến đấu, không chỉ cộng máu hoặc sát thương cho boss.
- Hiệu ứng kết thúc cùng trận boss; không tự ý xóa vật phẩm, xu hay chỉ số vĩnh viễn.
- Sát thương lớn phải có dấu hiệu báo trước và ít nhất một cách đối phó.
- Lời nguyền không thay thế Phase Gate. Người chơi vẫn phải hoàn thành cơ chế mở khóa giai đoạn và chỉ có thể kết liễu boss khi cổng cho phép.
- Các con số dưới đây là giá trị khởi điểm để thử nghiệm; cần chỉnh theo sát thương thực tế của từng boss.

## Danh sách lời nguyền

### 1. Nợ Máu

Boss ghi lại 25% sát thương người chơi gây ra. Khi khoản nợ đạt 20% Max HP, boss báo trước một đòn hút máu.

Người chơi có thể dùng một lượt để trả nợ bằng HP, dùng kỹ năng để chuyển một phần nợ thành sát thương lên boss, hoặc tiếp tục tấn công và chịu cú hút máu đã báo trước. Lượng nợ bị giới hạn ở 40% Max HP.

### 2. Thuế Phép

Mỗi lần dùng kỹ năng, người chơi nhận một dấu Thuế. Đòn đánh thường xóa một dấu. Khi đủ ba dấu, boss tạo khiên trong một lượt.

Người chơi cân nhắc xen kẽ đòn thường và kỹ năng, hoặc chấp nhận khiên để tích lũy tài nguyên. Nếu kỹ năng cần MP, Thuế Phép không được tự ý trừ thêm MP ngoài mức đã báo trên giao diện.

### 3. Gương Nợ

Sau mỗi đòn, boss tạo gương chống loại sát thương vừa nhận: vật lý hoặc phép. Gương tồn tại đến hết lượt kế tiếp.

Đổi sang loại sát thương còn lại sẽ phá gương và khiến boss mất một phần kháng trong lượt đó. Nếu nhân vật không có cách đổi loại sát thương, có thể dùng đòn thường để chờ gương tự tan.

### 4. Tiếng Vọng

Boss ghi nhớ hành động của người chơi. Cứ sau hai hành động, nó lặp lại một phiên bản yếu hơn của hành động gần nhất, gây khoảng 50% hiệu quả ban đầu.

Người chơi có thể chủ động dùng hành động ít rủi ro trước nhịp vọng, hoặc dùng kỹ năng tốn 1 MP để xóa hành động đang bị ghi nhớ. Giao diện luôn hiện hành động nào sẽ bị lặp.

### 5. Trói Bình Máu

Boss đánh dấu một bình máu. Sau hai lượt, bình đó bị khóa trong một lượt.

Người chơi có thể dùng bình trước khi bị khóa, dùng kỹ năng để chuyển dấu sang boss, hoặc chờ khóa rồi chiến đấu không dùng bình trong một lượt. Lời nguyền không xóa bình khỏi túi.

### 6. Định Mệnh Chia Đôi

Boss đưa ra hai dấu ấn có hậu quả được mô tả rõ, chẳng hạn mất một phần HP tối đa trong trận hoặc khiến boss nhận thêm kháng. Người chơi phải chọn một dấu trước khi giao chiến tiếp.

Dấu không được chọn trở thành điểm yếu của boss trong một lượt. Cả hai lựa chọn đều có cái giá hữu hạn và không gây kết liễu tức thời.

### 7. Dấu Mộ

Boss đánh dấu một trong ba thứ: HP hiện tại, MP hiện tại hoặc payout. Sau hai lượt, nó tìm cách rút một phần của thứ đã đánh dấu.

Người chơi có thể dùng kỹ năng để chuyển dấu sang boss, chủ động trả một khoản nhỏ đã được hiển thị, hoặc chịu hiệu ứng rút đã giới hạn. Không được trừ payout nếu payout không đủ; trong trường hợp đó dấu tự mất và boss nhận một lượng khiên nhỏ thay thế.

### 8. Vòng Lặp

Lặp lại cùng một loại hành động hai lượt liên tiếp sẽ tạo một điểm Lặp. Ở điểm thứ ba, boss khóa loại hành động đó trong lượt kế và tung đòn đã báo trước.

Thực hiện một loại hành động khác sẽ xóa một điểm Lặp. Khóa chỉ kéo dài một lượt và không được khóa toàn bộ lựa chọn hợp lệ của người chơi.

### 9. Địa Tầng Nứt

Đấu trường có ba vùng. Mỗi lượt boss báo vùng nào sẽ nứt ở lượt kế tiếp; đứng trong vùng đó khi nứt sẽ nhận sát thương vừa phải.

Người chơi có thể chuyển vùng, dùng một lượt để neo vị trí và giảm sát thương, hoặc đẩy boss vào vùng nứt bằng một kỹ năng phù hợp. Vị trí và vùng nguy hiểm phải được thể hiện rõ trong giao diện.

### 10. Búp Bê Rơm

Boss triệu hồi một hình nhân và liên kết nó với người chơi. Nếu hình nhân còn nguyên sau hai lượt, nó phát nổ gây sát thương bằng một phần sát thương đã tích lũy, tối đa 15% Max HP.

Người chơi có thể phá hình nhân bằng kỹ năng, đánh boss để chuyển một phần sát thương sang hình nhân, hoặc phòng thủ để giảm vụ nổ. Hình nhân không thể gây sát thương vượt quá giới hạn đã báo.

### 11. Cửa Đổi Chỗ

Hai cổng xuất hiện trên đấu trường. Một cổng làm đòn đánh của người chơi chuyển hướng sang mục tiêu phụ; cổng kia làm đòn của boss đổi hướng.

Người chơi có thể xoay cổng bằng đòn thường, khóa một cổng bằng kỹ năng, hoặc tận dụng cổng để phản lại một đòn của boss. Hướng chuyển đòn phải được hiển thị trước khi xác nhận hành động.

### 12. Tiếng Chuông

Mỗi hành động gây sát thương làm thanh Chuông tăng một nấc. Khi đạt ba nấc, lượt kế tiếp có một đòn diện rộng được báo trước.

Người chơi có thể dùng một lượt không gây sát thương để làm thanh giảm một nấc, hoặc dùng kỹ năng để chuyển một nấc sang boss khiến boss mất kháng tạm thời. Đòn diện rộng không được bỏ qua phòng thủ hợp lệ.

### 13. Kẻ Thu Nợ

Boss theo dõi số payout người chơi đã chi trong trận. Khi tổng chi đạt ngưỡng được hiển thị, nó đưa ra yêu cầu trả một khoản nhỏ hoặc nhận một đòn tấn công đã báo trước.

Người chơi được chọn trả hoặc từ chối; khoản trả không thể vượt payout hiện có. Dùng kỹ năng có thể chuyển khoản nợ thành khiên của boss, đổi lại làm khiên yếu hơn. Không có giao dịch âm hoặc cho phép mua khi payout bằng không.

### 14. Ba Mặt Nạ

Boss luân phiên ba mặt nạ: Giáp tăng DEF, Kháng tăng RES, và Tái Tạo hồi máu. Mặt nạ đang hoạt động được đánh dấu rõ.

Người chơi có thể phá mặt nạ bằng loại sát thương phù hợp hoặc bỏ lượt gây sát thương để chờ boss tự đổi mặt nạ. Phase Gate yêu cầu phá mặt nạ Tái Tạo trước khi mở giai đoạn kết liễu.

### 15. Kẻ Đánh Cắp Ký Ức

Boss ghi lại một chỉ số hoặc hiệu ứng có lợi vừa được kích hoạt, rồi tạo bản sao yếu hơn ở lượt sau.

Người chơi có thể dùng kỹ năng để xóa ký ức, chấp nhận bản sao yếu, hoặc dụ boss ghi nhớ một hiệu ứng ít quan trọng. Bản sao không được nhân đôi toàn bộ vật phẩm hay nội tại của nhân vật.

### 16. Đổi Giá

Trước lượt của người chơi, boss chọn một hành động và công bố chi phí tạm thời mới, chẳng hạn kỹ năng đó tốn thêm 1 MP hoặc đòn thường gây ít sát thương hơn.

Chi phí được khóa trước khi người chơi chọn. Người chơi có thể trả chi phí mới, chọn hành động khác, hoặc dùng kỹ năng phá dấu Đổi Giá. Boss không được thay đổi chi phí sau khi hành động đã được xác nhận.

### 17. Linh Hồn Chia Đôi

Boss tách thành hai thân thể với thanh máu riêng. Mỗi đòn của người chơi gây sát thương lên một thân; thân còn lại tích lũy một phần sát thương đó thành khiên.

Người chơi có thể đổi mục tiêu để cân bằng hai thanh, dùng kỹ năng hợp nhất chúng trong một lượt, hoặc phá khiên trước khi tập trung sát thương. Khi một thân thể về 0 HP, nó không chết ngay mà để lại một lượt cho người chơi xử lý thân còn lại.

### 18. Hòm Giả

Boss tạo ba hòm, chỉ một hòm là thật. Trước khi chọn, người chơi có thể kiểm tra một hòm, mở ngay một hòm, hoặc dùng 2 MP để phá cả ba.

Hòm giả gây sát thương tối đa 8% Max HP và không lấy vật phẩm thật. Hòm thật làm boss mất khiên hoặc lộ điểm yếu. Kết quả và rủi ro được công bố trước khi xác nhận lựa chọn.

### 19. Vết Nứt Ký Ức

Sau ba đến năm lượt, boss tái hiện một lựa chọn quan trọng người chơi đã thực hiện, nhưng đảo ngược một phần lợi ích: hồi máu có thể biến thành khiên cho boss, hoặc đòn gây sát thương có thể để lại một vết nứt phản công.

Người chơi được báo trước lựa chọn sắp bị tái hiện. Họ có thể lặp lại để nhận phần thưởng nhỏ, chọn hành động khác để làm ký ức yếu đi, hoặc dùng MP để phá vết nứt.

### 20. Tích Tụ Bất Ổn

Mỗi sát thương người chơi gây lên boss làm thanh Bất Ổn tăng theo tỷ lệ Max HP của boss. Ở mốc 70, boss cảnh báo; ở 100, nó giải phóng một đòn lớn ở lượt kế tiếp. Nếu không nhận sát thương, thanh giảm 10 mỗi lượt.

Phòng thủ làm thanh giảm thêm 25. Một kỹ năng tốn 2 MP có thể chuyển một phần Bất Ổn thành sát thương lên boss. Đòn lớn có giới hạn sát thương và được báo trước. Không dùng lời nguyền này cho boss vốn đã có cơ chế nhiệt lượng tương tự Infernal Machine.

## Cách đưa vào hệ thống boss

Nên chọn lời nguyền theo chủ đề boss và chỉ áp dụng một lời nguyền cho mỗi trận. Tránh ghép nhiều lời nguyền cùng đánh vào một tài nguyên như MP hoặc payout. Các hiệu ứng liên quan đến tiền, bình máu và MP phải kiểm tra số dư trước khi trừ; nếu không đủ thì chuyển sang phương án phụ đã nêu trong lời nguyền.

Đợt thử nghiệm đầu có thể dùng Nợ Máu, Gương Nợ, Tiếng Vọng, Địa Tầng Nứt, Tiếng Chuông, Ba Mặt Nạ và Tích Tụ Bất Ổn. Sau khi kiểm tra giao diện và cân bằng sát thương, mới đưa các lời nguyền còn lại vào vòng chọn boss.
