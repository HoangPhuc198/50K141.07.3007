/* ============================================================
   seed.sql : dữ liệu mẫu để chạy thử (dựa trên phỏng vấn: 7 nhân viên, 3 ca)
   - Ngày của lịch làm tính theo giờ Việt Nam: từ 7 ngày trước đến 7 ngày sau ngày chạy script.
   - Mật khẩu để 'PENDING'. Chạy  npm run db:setpw  để mã hóa mật khẩu mặc định.
   - Chưa có BangLuong/ChiTietBangLuong: do chức năng tính lương của ứng dụng tạo ra.
   - Cả file chạy trong MỘT giao dịch.
   ============================================================ */
BEGIN;

/* ChuQuan */
INSERT INTO "ChuQuan" ("Machuquan", "Tendangnhap", "Matkhau")
VALUES ('CQ000001', 'chuquan', 'PENDING');

/* NhanVien: lương khởi điểm Phục vụ 17000, Pha chế 20000 (phỏng vấn lần 2) */
INSERT INTO "NhanVien" ("Manv","Tendangnhap","Matkhau","Hoten","Sdt","Diachi","Truonghoc","Vitrilamviec","Hinhthuclam","Ngayvaolam","Kinhnghiem","Trangthai","Mucluongtheogio") VALUES
('NV000001','NV000001','PENDING','Nguyễn Minh Anh','0905000001','12 Lê Duẩn, Hải Châu, Đà Nẵng','Đại học Kinh tế - ĐHĐN','Pha chế','Full-time','2023-03-01','3 năm pha chế','Chính thức',24000),
('NV000002','NV000002','PENDING','Trần Thu Hà','0905000002','45 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng','Đại học Kinh tế - ĐHĐN','Pha chế','Part-time','2024-02-10','2 năm pha chế','Chính thức',22000),
('NV000003','NV000003','PENDING','Lê Quốc Bảo','0905000003','8 Ông Ích Khiêm, Hải Châu, Đà Nẵng','Đại học Bách khoa - ĐHĐN','Phục vụ','Part-time','2024-09-01','1 năm phục vụ','Chính thức',19000),
('NV000004','NV000004','PENDING','Phạm Ngọc Lan','0905000004','101 Điện Biên Phủ, Thanh Khê, Đà Nẵng','Đại học Sư phạm - ĐHĐN','Phục vụ','Part-time','2025-01-15','1 năm phục vụ','Chính thức',18000),
('NV000005','NV000005','PENDING','Võ Thanh Tùng','0905000005','23 Hoàng Diệu, Hải Châu, Đà Nẵng','Đại học Duy Tân','Phục vụ','Part-time','2025-06-01','Chưa có','Chính thức',17500),
('NV000006','NV000006','PENDING','Đặng Bảo Châu','0905000006','67 Trần Cao Vân, Thanh Khê, Đà Nẵng','Đại học Kinh tế - ĐHĐN','Phục vụ','Part-time','2025-10-20','Chưa có','Chính thức',17000),
('NV000007','NV000007','PENDING','Hoàng Gia Huy','0905000007','5 Phan Châu Trinh, Hải Châu, Đà Nẵng','Đại học Bách khoa - ĐHĐN','Phục vụ','Part-time',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'Chưa có','Thử việc',17000);

/* CaLam: sáng 3 người, chiều 2 người, tối 2 người */
INSERT INTO "CaLam" ("Maca", "Loaica", "Giobatdau", "Gioketthuc", "Sonvquydinh") VALUES
('CA000001', 'Sáng',  '06:00', '11:30', 3),
('CA000002', 'Chiều', '11:30', '17:00', 2),
('CA000003', 'Tối',   '17:00', '22:00', 2);

/* LichLam: 15 ngày (từ 7 ngày trước đến 7 ngày sau), mỗi ngày 3 ca */
INSERT INTO "LichLam" ("Malich", "Ngaylam", "Maca")
SELECT 'LL' || lpad(row_number() OVER (ORDER BY x.ngay, c."Maca")::text, 6, '0'),
       x.ngay, c."Maca"
FROM (SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + (n - 7)) AS ngay FROM generate_series(0, 14) AS n) x
CROSS JOIN "CaLam" c;

/* NhanVien_LichLam: xếp xoay vòng 7 nhân viên theo số người quy định của từng ca */
WITH l AS (
    SELECT ll."Malich", c."Sonvquydinh" AS so,
           SUM(c."Sonvquydinh") OVER (ORDER BY ll."Ngaylam", ll."Maca" ROWS UNBOUNDED PRECEDING) - c."Sonvquydinh" AS vt
    FROM "LichLam" ll JOIN "CaLam" c ON c."Maca" = ll."Maca"
),
s AS (
    SELECT generate_series(0, 2) AS k
),
e AS (
    SELECT "Manv", row_number() OVER (ORDER BY "Manv") - 1 AS r FROM "NhanVien"
)
INSERT INTO "NhanVien_LichLam" ("Manv", "Malich")
SELECT e."Manv", l."Malich"
FROM l
JOIN s ON s.k < l.so
JOIN e ON e.r = (l.vt + s.k) % 7;

/* ChamCong: các ca đã qua, chấm đúng giờ bắt đầu - kết thúc */
INSERT INTO "ChamCong" ("Machamcong", "Manv", "Malich", "Thoigiancheckin", "Thoigiancheckout")
SELECT 'CC' || lpad(row_number() OVER (ORDER BY ll."Ngaylam", ll."Maca", nl."Manv")::text, 6, '0'),
       nl."Manv", nl."Malich",
       ll."Ngaylam" + c."Giobatdau",
       ll."Ngaylam" + c."Gioketthuc"
FROM "NhanVien_LichLam" nl
JOIN "LichLam" ll ON ll."Malich" = nl."Malich"
JOIN "CaLam" c ON c."Maca" = ll."Maca"
WHERE ll."Ngaylam" < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

/* Một trường hợp quên check-out và yêu cầu bổ sung chờ chủ quán xử lý */
UPDATE "ChamCong" SET "Thoigiancheckout" = NULL WHERE "Machamcong" = 'CC000001';

INSERT INTO "YeuCauBoSungCC" ("Mayeucau", "Giovaobosung", "Giorabosung", "Lydo", "Trangthai", "Manv", "Malich")
SELECT 'YC000001', NULL, c."Gioketthuc", 'Quên check-out do về gấp', 'Chưa xử lý', cc."Manv", cc."Malich"
FROM "ChamCong" cc
JOIN "LichLam" ll ON ll."Malich" = cc."Malich"
JOIN "CaLam" c ON c."Maca" = ll."Maca"
WHERE cc."Machamcong" = 'CC000001';

/* Đơn xin đổi ca chờ xử lý cho ca sắp tới:
   - DD000001: người nhận thay CÙNG vị trí làm việc, chưa có trong ca
   - DD000002: không có người thay thế (Manvnhanthay NULL) để test khóa nút Lưu */
INSERT INTO "DonXinDoiCa" ("Madon", "Trangthaixuly", "Manv", "Malich", "Manvnhanthay")
SELECT 'DD000001', 'Chưa xử lý', nl."Manv", nl."Malich",
       (SELECT n."Manv" FROM "NhanVien" n
        WHERE n."Manv" <> nl."Manv"
          AND n."Vitrilamviec" = sender."Vitrilamviec"
          AND NOT EXISTS (SELECT 1 FROM "NhanVien_LichLam" x WHERE x."Malich" = nl."Malich" AND x."Manv" = n."Manv")
        ORDER BY n."Manv" LIMIT 1)
FROM "NhanVien_LichLam" nl
JOIN "NhanVien" sender ON sender."Manv" = nl."Manv"
JOIN "LichLam" ll ON ll."Malich" = nl."Malich"
WHERE ll."Ngaylam" > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  AND EXISTS (
    SELECT 1 FROM "NhanVien" n
    WHERE n."Manv" <> nl."Manv"
      AND n."Vitrilamviec" = sender."Vitrilamviec"
      AND NOT EXISTS (SELECT 1 FROM "NhanVien_LichLam" x WHERE x."Malich" = nl."Malich" AND x."Manv" = n."Manv")
  )
ORDER BY ll."Ngaylam", ll."Maca", nl."Manv"
LIMIT 1;

INSERT INTO "DonXinDoiCa" ("Madon", "Trangthaixuly", "Manv", "Malich", "Manvnhanthay")
SELECT 'DD000002', 'Chưa xử lý', nl."Manv", nl."Malich", NULL
FROM "NhanVien_LichLam" nl
JOIN "LichLam" ll ON ll."Malich" = nl."Malich"
WHERE ll."Ngaylam" > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  AND NOT EXISTS (SELECT 1 FROM "DonXinDoiCa" d WHERE d."Malich" = nl."Malich" AND d."Manv" = nl."Manv")
ORDER BY ll."Ngaylam", ll."Maca", nl."Manv"
LIMIT 1;

/* LichRanh: vài dòng đăng ký rảnh cho các ngày tới */
INSERT INTO "LichRanh" ("Malichranh", "Manv", "Ngayranh", "Caranh") VALUES
('LR000001','NV000003', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 3, 'CA000001'),
('LR000002','NV000003', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 3, 'CA000002'),
('LR000003','NV000005', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 4, 'CA000003');

/* HeSoLuong: ngày lễ nhân đôi (ví dụ Quốc khánh 02/09/2026) */
INSERT INTO "HeSoLuong" ("Maheso", "Ngaybatdau", "Ngayketthuc", "Heso")
VALUES ('HS000001', '2026-09-02', '2026-09-02', 2.00);

/* KyLuong: tháng trước đã chốt (ngày 2 tháng này), tháng này chưa tính */
INSERT INTO "KyLuong" ("Makyluong", "Thang", "Nam", "Trangthai", "Ngaychot")
SELECT 'KL' || to_char(p.dau_thang - 1, 'YYYYMM'),
       extract(month FROM p.dau_thang - 1)::smallint, extract(year FROM p.dau_thang - 1)::smallint,
       'Đã chốt', p.dau_thang + 1
FROM (SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS dau_thang) p;

INSERT INTO "KyLuong" ("Makyluong", "Thang", "Nam", "Trangthai", "Ngaychot")
SELECT 'KL' || to_char(p.dau_thang, 'YYYYMM'),
       extract(month FROM p.dau_thang)::smallint, extract(year FROM p.dau_thang)::smallint,
       'Chưa tính', NULL
FROM (SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS dau_thang) p;

COMMIT;
