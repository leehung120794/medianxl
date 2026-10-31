# Sinh tồn V4 — Hệ thống 80 Boss

Tài liệu này mô tả cách 80 boss hoạt động trong Sinh tồn. Mỗi boss có một cơ chế riêng để người chơi phải quan sát và chọn cách xử lý, thay vì chỉ bấm đánh liên tục. Các con số là giá trị thiết kế ban đầu để kiểm thử cân bằng.

## Lịch xuất hiện

- Mỗi ván chọn ngẫu nhiên 19 boss khác nhau từ danh sách 80 boss, lần lượt đặt ở tầng 50, 100, …, 950. Một boss đã xuất hiện sẽ không lặp lại trong cùng ván.
- Tầng 333 luôn có Threefold Prophecy, tầng 666 luôn có Kabraxis, tầng 999 luôn có Deimoss. Ba trận đặc biệt này không nằm trong danh sách 80 boss.
- Thứ tự boss được tạo và lưu khi bắt đầu ván. `/sinhton tieptuc` tiếp tục đúng thứ tự đó, không xáo lại.
- Đây là các cơ chế mới lấy cảm hứng từ Median XL, không phải mô tả nguyên xi cơ chế trong game gốc.

## Luật chung khi đánh boss

Mỗi lượt, giao diện phải cho biết đòn sắp tới, loại sát thương, mục tiêu và cơ chế đang chờ xử lý. Người chơi có thể đánh thường, dùng kỹ năng, phòng thủ, dùng bình hoặc chọn hành động riêng của boss.

Boss thường bị chặn sát thương tại 70%, 40% và 10% HP. Đây là **cửa chặn**: người chơi phải hoàn thành điều kiện ghi ở boss đó rồi mới có thể tiếp tục gây sát thương. Sát thương vượt ngưỡng bị bỏ. Đòn chí mạng, nhiều hit, vật phẩm, nội tại và phản sát thương đều tuân theo giới hạn này. Mở cửa không gây thêm sát thương.

Một số boss không dùng các mốc cửa chặn mà có điều kiện kết liễu riêng. Điều kiện đó được nêu rõ trong mô tả boss. Mỗi tương tác chỉ được tính một lần; bấm lại không nhân đôi sát thương, xu hay tiến độ. Trạng thái cơ chế được lưu để tiếp tục ván.

## Danh sách boss

### Butcher

#### 1. The Butcher

Thanh **Cuồng Rìu** bắt đầu ở 0 và tối đa 3 điểm. Mỗi lần boss phản công, thanh tăng 1; nếu đòn đó chí mạng, tăng 2. Mỗi điểm làm tăng 10% tỷ lệ chí mạng và 10% sát thương chí mạng của boss. Khi thanh đạt 2 điểm trở lên, boss báo trước sẽ chém bên Trái hoặc bên Phải. Chọn đúng bên để né, hủy đòn chém và giảm thanh 2 điểm. Chọn sai sẽ trúng đòn, rồi thanh tăng thêm 1. Ở 3 điểm, sát thương chí mạng của boss tăng thêm 100%.

**Qua cửa chặn:** Chọn đúng hướng chém, sau đó bấm **Bẻ Rìu**. Trong lượt bẻ rìu, boss chỉ phản công bằng nửa sát thương thường và không thể chí mạng.

#### 2. Carrion Butcher

Đấu trường có ba vùng, mỗi vùng có 2 độ bền và chỉ bị phá bằng nút **Thiêu Đốt**. Phá vùng Độc khiến người chơi mất 3% Max HP mỗi lượt; phá vùng Hồi Máu hồi đầy HP cho boss; phá vùng Khuếch Đại khiến boss gây thêm 15% sát thương trong phần còn lại của trận. Thiêu Đốt tiêu tốn MP bằng độ bền còn lại của vùng.

**Qua cửa chặn:** Ở các mốc 70%, 30% và 10% HP, lần lượt phá vùng Độc, Khuếch Đại và Hồi Máu. Các mốc riêng của boss này thay cho bộ mốc chung.

#### 3. Gorecleaver

Người chơi bắt đầu với 2 tầng **Vết Thương**. Mỗi lần boss hành động, nhận thêm 1 tầng, tối đa 3. Mỗi tầng giảm 30% hiệu quả hồi máu từ bình; đủ 3 tầng thì bình không hồi máu. Nút **Khâu Vết Thương** tiêu hao HP bằng 5% Max HP để xóa 2 tầng.

**Qua cửa chặn:** Chỉ được vượt tối đa một cửa chặn trong một hành động, và khi bắt đầu hành động phải có dưới 2 tầng Vết Thương.

#### 4. Meat King

Boss bắt đầu với 3 tầng **Bữa Tiệc**. Mỗi tầng tăng 33% sát thương boss. Nút **Đập Bàn** xóa 1 tầng, giảm sát thương boss tương ứng 33% và khiến boss bỏ qua phản công trong lượt đó.

**Qua cửa chặn:** Tại mốc 70%, 30% và 10% HP, thanh Bữa Tiệc phải lần lượt còn 2, 1 và 0 tầng.

#### 5. The Red Maw

Trước trận, số bình máu của người chơi bị giảm còn một nửa. Với mỗi tối đa 5 bình bị mất, boss được tăng 10% Max HP. HP mới của boss được tính xong trước khi trận bắt đầu. Boss không có cửa chặn theo phần trăm HP.


































**Điều kiện kết liễu:** Đòn kết liễu chỉ thành công khi người chơi không còn bình máu. Nếu còn bình, boss sống sót sau đòn đó.

### Infernal Machine

#### 6. Infernal Machine

Thanh **Nhiệt** bắt đầu ở 0/100. Khi người chơi gây sát thương, Nhiệt tăng một lần trong lượt: tăng 50 nếu boss mất dưới 30% HP, 75 nếu mất từ 30% đến dưới 60%, và 100 nếu mất từ 60% trở lên. Hit phụ không làm tăng Nhiệt thêm. Đòn trượt hoặc bị chặn hoàn toàn không tăng Nhiệt.

Ở 70 Nhiệt, boss vào trạng thái **Quá Nhiệt** và phản lại toàn bộ sát thương thực nhận. Ở 100 Nhiệt, boss chuẩn bị **Tia Hủy Diệt**; nếu tiếp tục gây sát thương, tia bắn trúng chắc chắn và kết liễu người chơi. Khi boss không nhận sát thương, Nhiệt giảm 25. Nếu đang chuẩn bị tia mà người chơi ngừng đánh, Nhiệt hạ còn 75 và tia bị hủy.

**Điều kiện kết liễu:** Boss không có cửa chặn theo phần trăm HP. Chỉ đòn đánh bắt đầu khi Nhiệt bằng 0 mới có thể kết liễu.

#### 7. Furnace Engine

Thanh **Áp Suất** bắt đầu ở 20/100 và tăng 20 mỗi lượt. Mỗi lượt giao diện báo một trong ba trạng thái: **Nạp**, **Đốt Lò** hoặc **Xả**. Chọn đúng nút trạng thái sẽ giảm Áp Suất 35 điểm và giảm nửa sát thương phản công lượt đó. Chọn sai làm Áp Suất tăng thêm 20. Nếu thanh chạm 100, lò phát nổ và người chơi thua.

**Qua cửa chặn:** Áp Suất phải dưới 30 ở đầu lượt vượt cửa.

#### 8. Plasma Tyrant

Ba tụ điện tích điện riêng, mỗi tụ tối đa 3 điểm. Tụ sắp tăng điện được báo trước. **Nối Đất** xả một tụ; **Chuyển Dòng** chuyển 2 điểm sang boss, gây sát thương bằng 5% Max HP nhưng khiến boss gây thêm 20% sát thương ở lượt kế; **Hút Điện** hồi 1 MP và giảm điện của tụ 1 điểm. Tụ đầy bắn tia plasma gây 1,5 lần sát thương.

**Qua cửa chặn:** Xả một tụ đang có ít nhất 2 điểm điện.

#### 9. Ashen Automaton

Boss có hai thanh **Thích Nghi Vật Lý** và **Thích Nghi Phép**, mỗi thanh tối đa 60. Khi boss nhận sát thương cùng loại bằng 1% Max HP, thanh tương ứng tăng 10 điểm. Mỗi 10 điểm giúp boss tăng 1 điểm phần trăm kháng loại đó, tối đa 30%. **Cân Chỉnh Lõi** đổi giá trị hai thanh; đánh vào thanh thấp hơn làm thanh đó giảm 10.

**Qua cửa chặn:** Hai thanh chênh nhau dưới 20 điểm.

#### 10. The Searing Core

Có ba cửa thông gió nhưng chỉ một cửa đúng. **Quét Nhiệt** miễn phí một lần mỗi giai đoạn để lộ cửa đúng. Mở đúng làm Nhiệt giảm 30 và boss giảm 15 điểm kháng phép trong lượt đó; mở sai làm Nhiệt tăng 25. Nhiệt tự tăng 10 mỗi lượt; ở 70, lõi nổ gây 1,5 lần sát thương.

**Qua cửa chặn:** Mở đúng cửa thông gió.

### Assur

#### 11. Assur

Ba lò tích 1 điểm Lửa mỗi lượt, tối đa 2. Lò đầy sẽ chuẩn bị **Hỏa Phong**. Người chơi có thể **Dập Lửa** để dùng một điểm Nước (tối đa có 2), hoặc **Phá Lò** để làm hỏng lò nhưng phải nhận nửa đòn phản công. Dập đúng lò sẽ hủy Hỏa Phong và làm boss dễ bị đánh hơn. Nếu để Hỏa Phong xảy ra, người chơi nhận 1,8 lần sát thương phép.

**Qua cửa chặn:** Hủy Hỏa Phong đang được báo trước.

#### 12. Ash-Crowned Assur

Ba tượng có tác dụng khác nhau: **Than Hồng** tăng sát thương boss, **Tro** hồi máu cho boss, **Xương** khóa bình máu người chơi. Giao diện báo tượng đang hoạt động. Nút **Niêm Phong** khóa tượng đó trong 2 lượt; chọn nhầm làm thanh **Vương Quyền** tăng 1. Khi thanh đạt 3, boss gọi bão lửa gây 1,7 lần sát thương.

**Qua cửa chặn:** Niêm phong tượng Tro trước lượt boss hồi máu.

#### 13. Dreadflame Baron

Thanh **Sợ Hãi** tăng khi dùng kỹ năng trong lúc thanh trên 50. Đánh thường giảm 5 điểm. **Đối Diện Nỗi Sợ** tốn 1 MP và giảm 30 điểm; **Thu Mình** hồi 10% Max HP nhưng tăng Sợ Hãi 15 điểm. Ở 70 điểm, một dòng mô tả bị nhiễu, nhưng giao diện vẫn phải cho biết loại sát thương và mức nguy hiểm.

**Qua cửa chặn:** Sợ Hãi không quá 30.

#### 14. The Unburnt Judge

Mỗi giai đoạn đưa ra ba bằng chứng, trong đó một bằng chứng là thật. Manh mối liên quan đã được ghi trong nhật ký. Người chơi có thể **Chấp Nhận**, **Phản Bác** (tốn 1 MP), hoặc **Kiểm Tra** (mất lượt để mở thêm manh mối). Đoán đúng làm boss mất 10% Max HP và 20 điểm kháng phép; đoán sai tăng Tội Lỗi. Tội Lỗi đạt 3 sẽ kích hoạt đòn Phán Xét gây 1,5 lần sát thương.

**Qua cửa chặn:** Xử lý đúng hai bằng chứng liên tiếp.

#### 15. Cinder Sovereign

Ba phượng hoàng có đồng hồ nở từ 0 đến 2. Khi nở, phượng hoàng Đỏ gây sát thương, Vàng hồi cho boss 4% Max HP, Đen khóa bình máu một lượt. **Trói Phượng Hoàng** dừng đồng hồ một lượt. **Thu Tro** tạo khiên bằng 10% Max HP nhưng khiến đồng hồ tiến thêm.

**Qua cửa chặn:** Trói đúng phượng hoàng sắp nở.

### Master Control System

#### 16. Master Control System

Boss ghi lại sát thương người chơi gây ra trong hai hành động tấn công, rồi chuẩn bị phản lại 25% tổng đó. Người chơi chọn một tụ điện: **Tụ Xanh** tốn 1 MP để xóa đòn phản; **Tụ Đỏ** dội một nửa sát thương về boss và người chơi nhận nửa còn lại; **Nối Đất** xả an toàn nhưng mất lượt. Boss không thể bị kết liễu khi đòn phản vẫn còn.

**Qua cửa chặn:** Xả tụ điện đang tích phản sát thương.

#### 17. MCS-Alpha

Nếu người chơi dùng cùng một loại hành động hai lần liên tiếp, boss khóa loại hành động đó trong 2 lượt. Rơ-le tương ứng với đánh thường, kỹ năng hoặc phòng thủ sẽ sáng. **Tắt Rơ-le** mất lượt; **Ghi Đè** tốn 2 MP và mở ngay nhưng boss gây thêm 15% sát thương trong 2 lượt.

**Qua cửa chặn:** Tắt đúng rơ-le đang sáng.

#### 18. MCS-Beta

Mỗi kỹ năng gây sát thương tạo một bản sao, bản sao phát nổ sau 2 lượt với 30% sát thương của kỹ năng gốc. Người chơi có thể **Hấp Thụ** để hồi 1 MP, **Phản Chiếu** để dội sát thương về boss, hoặc **Phá Hủy** (mất lượt) để ngăn vụ nổ.

**Qua cửa chặn:** Xử lý bản sao trước khi nó phát nổ.

#### 19. MCS-Gamma

Bảng điện có 3×3 ô, gồm nguồn điện, đầu ra và các ô lỗi. Người chơi nối các ô liền nhau trong tối đa 3 bước. Nối đúng gây sát thương bằng 8% Max HP của boss; đi qua ô lỗi khiến người chơi nhận 1,2 lần sát thương. Kỹ năng có thể xóa một ô lỗi.

**Qua cửa chặn:** Nối nguồn điện tới đầu ra.

#### 20. The Null Director

Mỗi lượt boss ban một lệnh: khóa một hành động, lấy 1 MP hoặc ép người chơi chọn mục tiêu. **Tuân Lệnh** khiến boss giảm 10 điểm kháng phép ở lượt kế; **Kháng Lệnh** tốn 2 MP để hủy lệnh; **Phá Rơ-le** cần thành công 3 lần để làm boss choáng.

**Qua cửa chặn:** Hủy lệnh đang có hiệu lực.

### Necrobot

#### 21. Necrobot Alpha

Boss luân phiên giữa **Giáp** và **Khiên** mỗi 2 lượt. Giáp yếu trước sát thương vật lý, Khiên yếu trước sát thương phép. Đánh đúng loại làm lớp phòng vệ giảm 20 điểm; đánh sai vẫn gây sát thương nhưng không làm lớp đó yếu đi. **Đảo Cực** tốn 1 MP để đổi trạng thái ngay.

**Qua cửa chặn:** Phá lớp phòng vệ đang hiện bằng đúng loại sát thương.

#### 22. Necrobot Beta

Boss có ba bộ phận: Chân tăng né tránh, Lõi hồi 3% Max HP cho boss cuối lượt, Tay tăng sát thương boss 10%. Người chơi chọn bộ phận để đánh; mỗi khi gây sát thương bằng 10% Max HP của boss thì bộ phận mất một độ bền.

**Qua cửa chặn:** Phá Lõi. Hai bộ phận còn lại có thể xử lý tùy chiến thuật.

#### 23. Necrobot Gamma

Laser khóa một vị trí Trái, Giữa hoặc Phải và bắn ở lượt kế tiếp. Chọn vị trí để né; nếu chọn đúng, laser bắn trúng boss và gây sát thương bằng 6% Max HP của boss. Chọn sai khiến người chơi nhận 1,4 lần sát thương. Kỹ năng tốn 1 MP có thể làm nhiễu và hủy laser.

**Qua cửa chặn:** Dẫn tia laser bắn trúng boss.

#### 24. Necrobot Delta

Thanh **Phế Liệu** từ 0 đến 5 tăng 1 khi người chơi đánh trực tiếp. Mỗi điểm giúp boss có thêm 4% khiên. **Nghiền Mảnh** mất lượt để giảm 2 điểm; **Tái Chế** tiêu một vật phẩm hỗ trợ để hồi 1 MP hoặc nhận lại một lượt dùng bình. Ở 5 điểm, boss có khiên bằng 25% Max HP.

**Qua cửa chặn:** Giảm Phế Liệu còn tối đa 1.

#### 25. The Iron Revenant

Thanh **Quy Trình Tử Thần** tăng 1 sau mỗi 2 lượt, tối đa 4. Mỗi điểm tăng sát thương boss 10% và hồi cho boss 2% Max HP cuối lượt. **Cắt Bộ Ổn Định** đưa thanh về 2. **Phá Lõi** tốn kỹ năng và 2 MP, ngăn boss hồi máu nhưng tăng sát thương boss 20%.

**Qua cửa chặn:** Quy Trình Tử Thần dưới 2 và lõi không hồi máu trong lượt đó.

### Quov Tsin

#### 26. Quov Tsin

Ba trụ Lửa, Băng và Sét tích điện từ 0 đến 2. Trụ đầy sẽ bắn đòn cùng nguyên tố. **Phá Trụ** mất lượt và giảm 10 điểm kháng phép của boss; **Nối Đất** tốn 1 MP để xả điện; **Quá Tải** chuyển điện sang boss, gây sát thương bằng 5% Max HP nhưng người chơi nhận nửa đòn phản.

**Qua cửa chặn:** Xử lý trụ đang đầy điện.

#### 27. The Mythalist

Thanh **Thuế Phép** tăng 1 mỗi lần dùng kỹ năng, tối đa 3. Mỗi điểm khiến kỹ năng tiếp theo tốn thêm 1 MP. Đánh thường giảm Thuế Phép 1 điểm. Người chơi cũng có thể trả 2% tiền cược ban đầu cho mỗi điểm để xóa toàn bộ Thuế Phép.

**Qua cửa chặn:** Thuế Phép bằng 0. Nếu không đủ tiền, nút trả tiền bị khóa và không trừ xu.

#### 28. Triune Arcanist

Ba pháp sư dùng chung một thanh HP. Mỗi lượt, một pháp sư được báo trước đang niệm phép. **Ngắt Niệm** bằng kỹ năng tốn 1 MP để boss giảm 10 điểm kháng phép. **Đánh Cắp Tiêu Điểm** mất lượt nhưng chuyển hiệu ứng tăng của pháp sư sang người chơi. Nếu để ba lượt niệm liên tiếp, họ tung một đòn kết hợp mạnh.

**Qua cửa chặn:** Ngắt đúng pháp sư đang niệm.

#### 29. Storm-Sealed Vizjerei

Ba ấn có biểu tượng xoay theo quy luật được hiển thị. Người chơi chọn **Xoay**, **Đẩy** hoặc **Hút** để khớp biểu tượng và mở ấn. Mỗi ấn mở xả một tầng điện. Chọn sai tăng thanh Bão; ở 3 điểm, Bão gây 1,5 lần sát thương sét. Kỹ năng có thể khóa một biểu tượng trong 2 lượt.

**Qua cửa chặn:** Mở cả ba ấn.

#### 30. The Prism Tyrant

Lăng kính chuyển giữa Đỏ, Xanh và Vàng. Đỏ hấp thụ sát thương vật lý, Xanh hấp thụ sát thương phép, Vàng phản lại 20% sát thương. Dùng **Bộ Lọc** đúng màu làm boss giảm 10 điểm kháng phép; chọn sai tăng thanh Tích Điện. Thanh đạt 3 sẽ bắn tia gây 1,5 lần sát thương.

**Qua cửa chặn:** Phá lăng kính Vàng hoặc chuyển điện tích về boss.

### Lucion

#### 31. Lucion

Vảy của Lucion giảm 99% sát thương. Cứ mỗi 3 lượt, Malic mở vảy trong một khoảng ngắn. Khi đó người chơi có thể **Điều Khiển Trí Não** để mở vảy trong 2 hành động, **Phá Vảy** (tốn 2 MP) để phá một lớp, hoặc đánh thường. Đánh thường khi vảy đóng khiến boss hồi 5% Max HP. Bỏ lỡ cửa sổ Malic khiến boss hồi 50% Max HP.

**Qua cửa chặn:** Mở vảy bằng Malic rồi phá một lớp vảy.

#### 32. The Malic Herald

Dấu Malic luân phiên giữa boss và người chơi. **Chuyển Dấu** tốn 1 MP để đặt dấu lên boss; **Niêm Phong** mất lượt để giữ nguyên vị trí dấu; **Khai Thác** tăng sát thương người chơi 20% nhưng cũng khiến sát thương nhận vào tăng 25%.

**Qua cửa chặn:** Dấu Malic phải nằm trên boss khi người chơi dùng kỹ năng.

#### 33. Scale-Bound Lucion

Boss có ba lớp vảy: **Gương** phản sát thương, **Kết Giới** tăng kháng, **Yến Tiệc** hồi máu. Phá Gương bằng đánh thường, Kết Giới bằng kỹ năng, Yến Tiệc bằng nút **Cắt Vảy** (mất lượt). Phá sai cách khiến người chơi nhận nửa sát thương phản.

**Qua cửa chặn:** Phá hai lớp vảy theo thứ tự người chơi chọn.

#### 34. The Soul Devourer

Ba bình linh hồn chứa HP, MP hoặc bình máu; cứ 3 lượt boss hút một bình. **Phá Bình** làm người chơi mất 3% Max HP; **Nhận Linh Hồn** hồi tài nguyên; **Đổi Bình** tráo nội dung hai bình. Nếu boss hút bình HP, nó hồi 8% Max HP.

**Qua cửa chặn:** Phá hoặc đổi vị trí bình HP trước lượt boss hút.

#### 35. The Gilded Serpent

Độc tăng 1 mỗi lượt, tối đa 5. Ở 3 điểm, hiệu quả hồi máu giảm 10%; ở 5 điểm, người chơi nhận đòn độc gây 1,4 lần sát thương. Người chơi có thể trả 3% tiền cược ban đầu để dùng thuốc giải, tự pha thuốc bằng 2 MP và một lượt, hoặc chuyển độc sang boss để gây 10% Max HP sát thương và giảm 10 điểm kháng phép.

**Qua cửa chặn:** Độc còn tối đa 1 điểm.

### Bul-Kathos

#### 36. Bul-Kathos

Thanh **Lời Thề Chiến Trận** tăng khi người chơi lặp cùng một hành động, tối đa 3. Ở 3 điểm, boss dùng đòn Tổ Tiên gây 1,5 lần sát thương. Mỗi 3 lượt, người chơi có thể đổi thế giữa Nhanh, Nặng và Phòng Thủ. Chọn thế đúng với dấu hiệu boss báo trước giảm Lời Thề 2 điểm; chọn sai làm thanh tăng.

**Qua cửa chặn:** Lời Thề bằng 0 và người chơi đang ở thế Nặng.

#### 37. The Ancestor-King

Ba linh hồn đại diện cho Nhanh Nhẹn, Phép Thuật và Sinh Lực. Linh hồn đang sáng tăng sức mạnh tương ứng cho boss. Người chơi chọn đối đầu bằng DEX, ENE hoặc VIT. Thắng sẽ tắt hiệu ứng tăng của linh hồn trong 3 lượt; hòa làm mất 5% Max HP; thua không tắt hiệu ứng.

**Qua cửa chặn:** Thắng linh hồn đang sáng.

#### 38. Warlord of Blood

Thanh **Cờ Máu** tăng 1 mỗi khi người chơi dùng bình, hoặc tăng 2 nếu bình hồi HP; tối đa 4. Ở 4 điểm, boss hồi 8% Max HP mỗi lượt. **Đốt Cờ** mất 10% tiền hiện có thể rút; **Cắt Dây** tốn kỹ năng và 1 MP; **Cướp Cờ** tăng sát thương người chơi nhưng khiến đòn phản công gây 1,3 lần sát thương.

**Qua cửa chặn:** Đưa Cờ Máu về 0.

#### 39. The Twinblade Patriarch

Hai thanh kiếm, Vật Lý và Phép, tích điện riêng đến 3. Người chơi chọn khóa một kiếm. Kiếm bị khóa gây ít hơn 20% sát thương, còn loại sát thương kia tăng 20%. Kiếm đầy điện sẽ tung combo cùng loại.

**Qua cửa chặn:** Khóa thanh kiếm đang có ít nhất 2 điểm điện.

#### 40. The Oathbreaker

Boss đưa ra hai điều khoản, ví dụ không lặp kỹ năng hoặc phải giữ MP trên 1. Người chơi chọn **Thề**, **Từ Chối** hoặc **Viết Lại** (tốn 2 MP). Giữ lời trong 2 lượt làm boss giảm 20 điểm kháng phép. Phá lời khiến boss phản công gây 1,3 lần sát thương. Từ chối không có thưởng hay hình phạt.

**Qua cửa chặn:** Hoàn thành một điều khoản hoặc từ chối hai điều khoản.

### Giyua

#### 41. Spirit of Giyua

Ba tổ linh hồn lần lượt hồi máu, tăng sát thương hoặc tạo lửa. Mỗi tổ có 2 độ bền. Đánh thường phá 1; kỹ năng phá 2 nhưng tăng Lửa Hoang 10 điểm. Tổ Hồi Máu hồi cho boss 4% Max HP mỗi lượt; tổ Sát Thương tăng sát thương boss 10%; tổ Lửa nổ sau 2 lượt.

**Qua cửa chặn:** Phá hoặc phong ấn tổ sắp kích hoạt.

#### 42. The Nestmother

Ba trứng nở sau 2 lượt thành minion Hồi Máu, Hộ Vệ hoặc Đột Kích. **Đập Trứng** bằng đánh thường; **Đánh Cắp** mất 5% HP hiện tại để nhận hiệu ứng tăng từ minion; **Để Nở** cho phép chọn minion sau khi nở. Minion Hồi Máu hồi 3% HP cho boss, Hộ Vệ tạo khiên 10%, Đột Kích tăng phản công 15%.

**Qua cửa chặn:** Không còn trứng Hồi Máu, hoặc người chơi đã có minion đồng minh.

#### 43. Wildfire Eidolon

Lửa lan giữa ba vùng đấu trường. Người chơi có thể dùng một lượt bình để dập lửa, bấm **Dẫn Lửa** để đổi hướng, hoặc châm lửa vào boss gây sát thương bằng 5% Max HP nhưng làm lửa tăng 2 điểm. Nếu lửa phủ cả ba vùng, nó gây đòn mạnh bằng 1,5 lần sát thương.

**Qua cửa chặn:** Dẫn lửa vào boss hoặc dập hết lửa.

#### 44. The Unformed Guardian

Boss đổi giữa ba dạng: Đá tăng DEF 30%, Sương tăng kháng phép 30%, Nanh tăng sát thương 25%. Gây loại sát thương đối nghịch sẽ ép boss đổi dạng. **Trói Dạng** tốn 2 MP để giữ dạng hiện tại trong 2 lượt.

**Qua cửa chặn:** Ép boss đổi dạng hai lần.

#### 45. Giyua Unbound

Boss có ba Mảnh Lửa Hoang. **Thu Hồi** một mảnh giảm sát thương boss 10%; **Ném Mảnh** vào boss gây 6% Max HP sát thương nhưng tăng Nhiệt 20; **Phá Mảnh** ngăn Nova nhưng bỏ phần thưởng phụ. Nếu còn mảnh, Nova xuất hiện mỗi 3 lượt.

**Qua cửa chặn:** Phá hai mảnh. Mảnh cuối có thể giữ lại.

### Riftwalker

#### 46. Ascendant Riftwalker

Hai cổng xuất hiện: cổng thật cho phép đánh trúng boss và giảm nửa sát thương phản công; cổng ảo không gây sát thương cho boss rồi tự đóng. Khi boss biến mất, chỉ cổng thật có thể đánh trúng.

**Qua cửa chặn:** Đóng cổng ảo rồi tấn công boss qua cổng thật.

#### 47. The Shambler King

Bàn cờ 3×3 báo ô boss sẽ đáp xuống và các ô chấn động cạnh bên. Đứng cạnh ô đáp nhận nửa sát thương; đứng xa nhận đủ sát thương; đứng đúng ô đáp có thể phản đòn nhưng nhận 1,2 lần sát thương. Bàn cờ xoay mỗi 2 lượt.

**Qua cửa chặn:** Đứng đúng vị trí để dụ boss vào bẫy.

#### 48. Riftstorm Herald

Thanh **Điểm Tích Rift** tăng 1 mỗi lượt, tối đa 4. **Neo Bão** giảm 2 điểm và giảm sức mạnh đòn sắp tới; **Khai Thác** hồi 1 MP nhưng giữ nguyên điểm; **Chuyển Hướng** khi có ít nhất 2 điểm gây 5% Max HP sát thương lên boss. Ở 4 điểm, bão gây 1,6 lần sát thương.

**Qua cửa chặn:** Chuyển hướng được một cơn bão.

#### 49. The Gate-Leaper

Boss đặt hai cổng lên boss, người chơi hoặc khoảng không. Đòn tấn công đi qua hai cổng theo thứ tự. **Đặt Cổng**, **Xoay Cổng** hoặc **Đóng Cổng** đều tốn một lượt. Đặt sai khiến người chơi nhận 1,2 lần sát thương.

**Qua cửa chặn:** Sắp cổng để đòn tấn công của boss quay ngược lại trúng chính boss.

#### 50. The Unmoored One

Boss đánh cắp hiệu ứng tăng mạnh nhất của người chơi trong 2 lượt. Người chơi có thể chọn hiệu ứng làm mồi, **Thanh Tẩy** tốn 2 MP để ngăn việc đánh cắp, hoặc **Phản Chiếu** để chuyển hiệu ứng sang boss với sức mạnh giảm 15%.

**Qua cửa chặn:** Lấy lại hiệu ứng hoặc làm suy yếu hiệu ứng boss đã đánh cắp.

### Gharbad

#### 51. Gharbad the Weak

Cứ mỗi 3 lượt, có 25% khả năng Gharbad đầu hàng thật hoặc giả; kết quả đã được khóa trước khi hiển thị. **Tra Xét** mất lượt để giải manh mối; **Nhận Đầu Hàng** hủy đòn nếu là thật nhưng nhận phục kích gây 1,8 lần sát thương nếu là giả; **Tấn Công** làm tăng Cuồng Nộ.

**Qua cửa chặn:** Xác minh được một lần đầu hàng.

#### 52. The False Penitent

Boss đưa ra ba lời thú tội, một lời là thật. **Tha Thứ** giảm sát thương boss 15% trong 2 lượt; **Kết Tội** đúng làm boss giảm 15 điểm kháng phép, sai tăng Tội Lỗi; **Xác Minh** tốn 1 MP để mở manh mối. Tội Lỗi đạt 3 khiến boss tung đòn gây 1,4 lần sát thương.

**Qua cửa chặn:** Chọn đúng một lời thú tội.

#### 53. The Coward-Saint

Boss chọn một trong ba đường trốn. **Truy Đuổi** gây 8% Max HP sát thương lên boss nhưng làm người chơi mất 5% Max HP; **Chặn Đường** dựa theo dấu chân, chọn sai sẽ bị đánh; **Nhặt Mồi** nhận thưởng nhỏ nhưng boss hồi 5% HP.

**Qua cửa chặn:** Chặn đúng đường trốn đã được báo dấu.

#### 54. The Beggar-King

Boss đòi một khoản tiền, HP hoặc MP cụ thể; giao diện phải cho biết chính xác số lượng trước khi người chơi quyết định. Trả đúng sẽ xóa một hiệu ứng tăng của boss; trả gấp đôi nhận thêm thưởng; từ chối làm thanh Nợ tăng. Nợ đạt 3 khiến boss mất lượt nhưng tung một đòn cuối.

**Qua cửa chặn:** Trả một lần hoặc dùng kỹ năng phá túi vàng. Không đủ xu thì không thể chọn trả.

#### 55. The Hollow Surrender

Ba dấu hiệu Cờ, Bóng và Dấu Chân; chỉ một dấu là thật. **Kiểm Tra** mất lượt để nhận manh mối; **Tịch Thu Cờ** đúng làm boss mất lượt, sai kích hoạt bẫy gây 1,2 lần sát thương; **Bỏ Qua** khiến boss chuẩn bị phục kích.

**Qua cửa chặn:** Tịch thu đúng lá cờ thật. Kết quả được lưu khi tiếp tục ván.

### Phoboss

#### 56. Phoboss

Thanh **Ác Mộng** từ 0 đến 5 tăng 1 mỗi khi boss hút 1 MP. Mỗi tầng tăng sát thương phép boss 10%; ở 5, boss dùng Blast gây 1,5 lần sát thương. Đánh thường phá một Ảo Ảnh; kỹ năng tốn 1 MP phá hai; dùng bình xóa một tầng và vẫn hồi bình thường.

**Qua cửa chặn:** Ác Mộng không quá 1.

#### 57. The Dream Eater

Ba quả cầu mơ chứa HP, MP hoặc sát thương. Boss hút quả cầu gần nhất mỗi lượt. **Tỉnh Thức** tốn 1 MP để xem nội dung; **Hấp Thụ** nhận lợi ích nhưng boss lấy quả khác; **Phá Hủy** mất lượt để xóa quả cầu. Nếu boss hút cầu HP, nó hồi 6% Max HP.

**Qua cửa chặn:** Phá quả cầu mà boss sắp hút.

#### 58. Nightmare Regent

Đồng hồ Ác Mộng bắt đầu ở 4 và giảm 1 mỗi lượt. Khi về 0, boss chuyển giai đoạn và đánh mạnh hơn 1,3 lần, nhưng không kết liễu ngay. **Phá Đồng Hồ** tốn 2 MP; **Đóng Băng** dùng một lượt bình; **Lấy Mảnh** nhận thưởng nhưng để đồng hồ tiếp tục chạy.

**Qua cửa chặn:** Giữ đồng hồ từ 2 trở lên.

#### 59. The Sleepless Judge

Thanh **Mệt Mỏi** từ 0 đến 4 tăng khi lặp hành động hoặc dùng cùng tài nguyên nhiều lần. **Nghỉ** mất lượt, giảm 2 Mệt Mỏi và hồi 1 MP; **Trả Nợ** tốn tiền rút được bằng 2% tiền cược ban đầu cho mỗi tầng; **Đổi Mục Tiêu** giảm 1 tầng. Ở 4 tầng, sát thương người chơi giảm 30% và sát thương boss tăng 20%.

**Qua cửa chặn:** Mệt Mỏi không quá 1.

#### 60. The Dread Somnarch

Người chơi chọn một trạng thái: **Tỉnh Táo** giảm sát thương nhận 20%, **Tỉnh Mộng** tăng sát thương gây ra 20%, **Ác Mộng** tăng sát thương gây ra 35% nhưng khóa vật phẩm tạm thời. Đổi trạng thái miễn phí mỗi 3 lượt; đổi ngoài thời điểm đó tốn 1 MP.

**Qua cửa chặn:** Có ít nhất một lượt ở Tỉnh Mộng, sau đó chuyển sang Tỉnh Táo.

### Anomaly

#### 61. Unstable Anomaly

Boss đổi dạng mỗi 2 lượt. **Vật Chất** tăng DEF 30%; **Năng Lượng** tăng kháng phép 30%; **Hư Không** giảm DEF và kháng phép 20% nhưng khiến boss nhận thêm 25% sát thương. **Ổn Định** tốn 1 MP; **Ép Chuyển Pha** dùng kỹ năng; **Cưỡi Hư Không** tăng sát thương người chơi 25% nhưng chấp nhận rủi ro.

**Qua cửa chặn:** Xử lý đúng dạng đang hiện.

#### 62. The Matter Maw

Boss chọn một chỉ số STR, DEX, VIT hoặc ENE để nuốt trong 2 lượt. STR giúp boss tăng DEF, DEX tăng né tránh, VIT tăng HP, ENE tăng kháng phép. **Giấu Chỉ Số** tốn 2 MP; **Phá Vỏ** bằng kỹ năng gây sát thương bằng 5% Max HP.

**Qua cửa chặn:** Đánh vào điểm yếu đối nghịch với chỉ số boss vừa nuốt.

#### 63. The Energy Wraith

Ba pin có mức tích điện từ 0 đến 3. **Ngắt Pin** giảm sát thương boss 15%; **Đảo Dòng** gây sát thương bằng 4% Max HP cho mỗi điểm điện; **Hút Pin** hồi 1 MP nhưng người chơi nhận nửa đòn phản. Pin đầy bắn tia điện gây 1,3 lần sát thương.

**Qua cửa chặn:** Đảo dòng một pin đang có ít nhất 2 điểm điện.

#### 64. Void-Torn Colossus

Khe nứt tăng 1 mỗi lượt, tối đa 5. **Khâu Khe** tốn 1 MP để giảm 2; **Mở Rộng** làm boss giảm 10 điểm kháng phép; **Đẩy Khe Vào Boss** khi khe có ít nhất 2 điểm gây 7% Max HP sát thương, nhưng người chơi nhận nửa đòn. Ở 5 điểm, khe hút 10% tiền rút được; nếu không đủ, người chơi mất 10% Max HP.

**Qua cửa chặn:** Đẩy khe vào boss rồi khâu khe lại.

#### 65. The Paradox Engine

Mỗi giai đoạn, boss đảo một luật trong 2 lượt: hồi máu biến thành sát thương, hiệu ứng có lợi biến thành bất lợi, hoặc bình máu làm thanh tích điện của boss tăng. **Khóa Luật** tốn 2 MP; **Chuyển Luật Sang Boss** dùng hành động phù hợp để khiến boss chịu luật; **Chấp Nhận** nhận hiệu ứng tăng kèm hậu quả. Tiền và giao dịch không bị đảo.

**Qua cửa chặn:** Chuyển một luật đang hoạt động sang boss.

### Zakarum

#### 66. Zakarum Avatar

Ba tượng **Khiên**, **Máu** và **Ánh Sáng** lần lượt giảm sát thương boss nhận 20%, hồi cho boss 3% Max HP mỗi lượt, hoặc phản lại 10% sát thương. Người chơi chọn tượng để đánh; lựa chọn đúng làm tượng mất 2 độ bền, sai mất 1.

**Qua cửa chặn:** Phá tượng đang hoạt động.

#### 67. The Grace-Bearer

Khiên Thần nằm trên boss, người chơi hoặc bàn thờ. Trên boss, nó giảm sát thương nhận 20%; trên người chơi, nó chặn một đòn đánh trúng; trên bàn thờ, có thể bị phá sau hai hành động gây sát thương. Người chơi cần chuyển khiên bằng nút tương tác.

**Qua cửa chặn:** Chuyển Khiên Thần đến bàn thờ rồi phá nó.

#### 68. The Golden Inquisitor

Boss ghi tội từ lịch sử trận đấu: dùng bình, lặp hành động hoặc dùng kỹ năng khi MP thấp. **Thú Tội** xóa tội nhưng tăng sát thương boss 10%; **Tranh Tụng** đúng làm boss giảm 15 điểm kháng phép; **Hối Lộ** tốn 3% tiền cược ban đầu để xóa 2 tội. Ba tội kích hoạt Phán Xét.

**Qua cửa chặn:** Xóa hết tội. Nếu không đủ tiền, không thể chọn Hối Lộ và không bị trừ xu.

#### 69. The Unbroken Saint

Người chơi chọn lời thề giữ HP, giữ MP hoặc không dùng bình trong 2 lượt. Giữ lời nhận 2 Phúc Lành; mỗi Phúc Lành có thể xóa khiên boss hoặc giảm sát thương nhận 15%. Phá lời mất Phúc Lành và tăng Cuồng Tín 1. Cuồng Tín đạt 3 làm boss choáng.

**Qua cửa chặn:** Phá khiên boss hoặc khiến Cuồng Tín đạt 3.

#### 70. The Sunken Hierophant

Thanh **Mực Nước** tăng 1 mỗi lượt, tối đa 4. **Xả Nước** giảm 2; **Dâng Nước** gây 5% Max HP sát thương lên boss nhưng tăng mực nước 1; **Mở Bàn Thờ** mất lượt và khóa mực nước trong một lượt. Ở mức 4, hồi máu từ bình giảm 25% và boss gây 1,3 lần sát thương.

**Qua cửa chặn:** Hạ mực nước còn 1 hoặc mở bàn thờ.

### Justicar

#### 71. The Justicar

Boss luân phiên ba bản án mỗi 2 lượt. **Thép** giảm sát thương đánh thường của người chơi 40%; **Sức Mạnh** giảm sát thương kỹ năng 40%; **Khoan Dung** tăng hồi bình 20% nhưng hồi boss 3% Max HP. **Kháng Án** tốn 1 MP để đổi luật; **Tuân Án** nhận hiệu ứng tăng; **Phá Ấn** dùng kỹ năng.

**Qua cửa chặn:** Hoàn thành hai bản án khác nhau hoặc phá ấn.

#### 72. Steel-Judgment Vicar

Ba ấn lần lượt cấm dùng bình, dùng kỹ năng hoặc lặp hành động. Ấn đang hoạt động được báo trước. Người chơi có thể **Gỡ Ấn**, **Chuyển Ấn Sang Boss** bằng kỹ năng tốn 1 MP, hoặc chấp nhận tuân lệnh.

**Qua cửa chặn:** Gỡ hoặc chuyển ấn đang sáng.

#### 73. The Edict Engine

Cứ 3 lượt, máy đặt ra một luật kéo dài 2 lượt, như giới hạn sát thương mỗi đòn, tăng điểm tích khi dùng bình hoặc phạt khi lặp hành động. Người chơi có thể tuân luật để nhận 15% sát thương, kháng luật bằng 2 MP, hoặc mất một lượt phá máy phát.

**Qua cửa chặn:** Phá máy phát hoặc hoàn thành hai hành động có lợi theo luật.

#### 74. The Sentence Keeper

Boss biến ba quyết định gần nhất của người chơi — gây sát thương, dùng bình, tiêu MP — thành một bản án. **Kháng Nghị** tốn tiền rút được bằng 2% cược ban đầu; **Chấp Nhận** chịu mức phạt được báo; **Đảo Án** dùng kỹ năng để chuyển phạt sang boss. Bản án thứ ba gây 1,4 lần sát thương.

**Qua cửa chặn:** Đảo thành công một bản án.

#### 75. The Final Arbiter

Người chơi chọn một trong hai cách xử lý. **Phá Khiên:** phá ba ấn bằng sát thương. **Sống Qua Phán Quyết:** xử lý ba dấu hiệu báo trước và giữ tài nguyên đủ dùng. Đổi cách tốn 2 MP. Hoàn thành sẽ mở ngưỡng và nhận hiệu ứng tăng riêng; thất bại khiến phải làm lại giai đoạn, nhưng boss không hồi HP.

**Qua cửa chặn:** Hoàn thành một trong hai cách.

### Uldyssian

#### 76. Uldyssian the Tainted

Boss ghi lại chỉ số cao nhất của người chơi. **Che Giấu** giảm chỉ số đó 10 điểm trong 2 lượt; **Nhử Bản Sao** khiến boss nhận hiệu ứng tăng trái ngược; **Để Sao Chép** cho boss 50% chỉ số trong 2 lượt. Phá cột vọng ảnh trả hiệu ứng tăng cho người chơi và làm boss giảm 20 điểm kháng phép.

**Qua cửa chặn:** Phá cột vọng ảnh hoặc khiến boss sao chép sai chỉ số.

#### 77. Edyrem Breaker

Ba loại Edyrem có tác dụng khác nhau: Hồi Máu hồi cho boss 3% Max HP, Hộ Vệ tạo khiên 10%, Đột Kích tăng phản sát thương 15%. Người chơi có thể **Chiêu Dụ** một Edyrem bằng 2% cược ban đầu để hồi 5% Max HP, **Chuyển Hóa** bằng kỹ năng thành đồng minh trong 2 lượt, hoặc **Loại Bỏ** bằng đánh thường.

**Qua cửa chặn:** Không còn Edyrem Hồi Máu hoặc đã có đồng minh.

#### 78. Worldstone Exile

Ba mảnh Worldstone lần lượt khóa loại sát thương, hồi máu hoặc thời gian hồi kỹ năng. Người chơi có thể **Khóa Mảnh** trong 2 lượt để làm boss yếu theo luật đó, **Phá Mảnh** bằng kỹ năng tốn 2 MP, **Hấp Thụ** để hồi 1 MP nhưng giữ hiệu ứng tăng của boss, hoặc **Chuyển Hướng** bằng cùng loại hành động.

**Qua cửa chặn:** Chuyển hướng mảnh đang sáng.

#### 79. The Nephalem Remnant

Boss xem chỉ số cao nhất rồi chọn đối sách: STR tăng giáp, DEX tạo đòn né, VIT hồi máu, ENE tạo khiên phép. Người chơi có thể **Phân Tán** chỉ số cao nhất 10 điểm tạm thời, **Đánh Lừa** bằng chỉ số cao thứ hai, hoặc để boss sao chép rồi đánh cột vọng ảnh.

**Qua cửa chặn:** Phá đúng đối sách boss đã chọn.

#### 80. The Memory Tyrant

Boss lưu ba lựa chọn gần nhất thành **Thẻ Ký Ức** rồi tái sử dụng hiệu ứng tương ứng. **Xóa Thẻ** tốn kỹ năng và 2 MP; **Hợp Nhất** cho người chơi hiệu ứng tăng nhưng boss cũng nhận; **Phát Lại** để boss dùng thẻ, sau đó người chơi chọn cách phản ứng. Thẻ được lưu nguyên trạng khi tiếp tục ván.

**Qua cửa chặn:** Xử lý hai thẻ bằng cách xóa, hợp nhất hoặc phản ứng với chúng.

## Tầng đặc biệt

### Tầng 333 — Threefold Prophecy

Người chơi chọn một ấn: **Chiến Trận**, **Bảo Hộ** hoặc **Arcane**. Lựa chọn áp dụng chỉ số theo luật hiện có và ảnh hưởng đến cơ chế của Kabraxis ở tầng 666. Trận này không rút boss từ danh sách 80.

### Tầng 666 — Kabraxis, Keeper of the Seals

Kabraxis có ba giai đoạn, mỗi giai đoạn có một thanh HP riêng bằng nhau. Mỗi thanh có cửa chặn ở 70%, 40% và 10%. Cơ chế phụ thuộc ấn đã chọn ở tầng 333:

- **Chiến Trận:** Dùng kỹ năng liên tiếp làm đòn phản công mạnh dần. Đổi sang loại hành động khác làm chuỗi yếu đi.
- **Bảo Hộ:** Đòn phản công luân phiên Vật Lý và Phép. Phòng thủ đúng loại sẽ ngăn hiệu ứng giảm kháng phép.
- **Arcane:** Đòn phản công hút MP; khi MP bằng 0, sát thương boss tăng. Ở giai đoạn hai, dùng kỹ năng khi còn MP làm boss giảm kháng phép.

Mỗi lượt phải hiển thị ấn, giai đoạn, loại sát thương và cách xử lý. Nếu không xử lý cơ chế, sức mạnh của ấn tăng một tầng sau mỗi 3 lượt, tối đa 3 tầng.

### Tầng 999 — Deimoss the Fleshweaver

Deimoss có ba thanh HP riêng, lần lượt chiếm 30%, 30% và 40% tổng HP. Sát thương dư không chuyển sang thanh kế tiếp. Khi chuyển giai đoạn, boss không phản công và không trao thưởng. Mỗi thanh có các cửa chặn 70%, 40% và 10%; tiến độ cửa chặn bắt đầu lại khi thanh mới xuất hiện.

- **Giai đoạn 1 — Abyssal Spires:** Deimoss giảm 25% sát thương nhận và đổi đòn phản công giữa Vật Lý/Phép mỗi 3 lượt. Dùng kỹ năng phá một trụ Abyssal để bỏ lớp giảm sát thương.
- **Giai đoạn 2 — Tiệc Máu:** Deimoss hồi 15% sát thương thực tế nó gây lên người chơi. Phòng thủ thành công ngăn hồi máu. Mỗi lần người chơi dùng bình, thanh Flesh tăng 1, tối đa 3; mỗi điểm tăng sát thương boss 10%.
- **Giai đoạn 3 — Sụp Đổ Chiều Không Gian:** Deimoss không hồi máu và không giảm sát thương, nhưng gây thêm 30% sát thương và có thêm 10 điểm phần trăm chí mạng. Đòn Sụp Đổ được báo trước; xử lý đúng sẽ giảm mạnh sát thương.

Chỉ khi thanh HP thứ ba về 0 mới kết thúc trận và trao thưởng.

## Lưu trạng thái và kiểm thử

- Lưu thứ tự 19 boss đã chọn, boss hiện tại, HP, giai đoạn, cửa chặn, bộ đếm, vật thể, dấu hiệu báo trước và lựa chọn đang chờ.
- Boss của ván cũ không tự đổi khi người chơi tiếp tục phiên.
- Bấm nút lặp không được cộng hai lần nhiệt, điểm tích, sát thương, xu hoặc tiến độ.
- Mọi khoản trả xu phải kiểm tra số dư trước khi trừ; thiếu xu thì hành động không xảy ra.
- Kiểm thử đủ bảy class với 1 HP, 0 MP, hết bình, debuff Rift và khi tiếp tục phiên. Kiểm tra riêng tầng 50, 500, 950, 666 và 999.
- Mọi sát thương chí mạng, nhiều hit, vật phẩm và nội tại đều chịu cùng quy tắc cửa chặn.

