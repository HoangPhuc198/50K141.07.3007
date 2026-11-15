/* ============================================================
   seed-sach.sql : dữ liệu SẠCH cho bản deploy thật.
   Chỉ gồm 1 chủ quán và 3 ca cố định. Chủ quán tự thêm nhân viên trên hệ thống.
   Mật khẩu để 'PENDING'; chạy set-passwords.mjs với DEFAULT_PASSWORD MẠNH, rồi đổi/giữ kín.
   ============================================================ */
BEGIN;

INSERT INTO "ChuQuan" ("Machuquan", "Tendangnhap", "Matkhau")
VALUES ('CQ000001', 'chuquan', 'PENDING');

INSERT INTO "CaLam" ("Maca", "Loaica", "Giobatdau", "Gioketthuc", "Sonvquydinh") VALUES
('CA000001', 'Sáng',  '06:00', '11:30', 3),
('CA000002', 'Chiều', '11:30', '17:00', 2),
('CA000003', 'Tối',   '17:00', '22:00', 2);

COMMIT;
