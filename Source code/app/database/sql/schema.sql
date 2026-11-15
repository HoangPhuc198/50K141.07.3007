/* ============================================================
   THANH HÀ COFFEE - Hệ thống quản lý ca làm & tính lương
   schema.sql : 14 bảng (PostgreSQL 14+)
   Nguồn: tài liệu thiết kế CSDL vật lý của bài. KHÔNG tự thêm bảng/cột.
   Tên bảng/cột đặt trong dấu nháy kép để GIỮ NGUYÊN chữ hoa/thường như tài liệu
   (ví dụ "NhanVien"."Manv"). Chạy bằng: npm run db:reset
   Cả file chạy trong MỘT giao dịch: lỗi ở đâu thì hoàn tác hết.
   ============================================================ */
BEGIN;

/* ---- Xóa bảng cũ theo thứ tự con -> cha (để chạy lại được) ---- */
DROP TABLE IF EXISTS "PhanHoiLuong" CASCADE;
DROP TABLE IF EXISTS "ChiTietBangLuong" CASCADE;
DROP TABLE IF EXISTS "BangLuong" CASCADE;
DROP TABLE IF EXISTS "KyLuong" CASCADE;
DROP TABLE IF EXISTS "HeSoLuong" CASCADE;
DROP TABLE IF EXISTS "DonXinDoiCa" CASCADE;
DROP TABLE IF EXISTS "YeuCauBoSungCC" CASCADE;
DROP TABLE IF EXISTS "ChamCong" CASCADE;
DROP TABLE IF EXISTS "NhanVien_LichLam" CASCADE;
DROP TABLE IF EXISTS "LichRanh" CASCADE;
DROP TABLE IF EXISTS "LichLam" CASCADE;
DROP TABLE IF EXISTS "CaLam" CASCADE;
DROP TABLE IF EXISTS "NhanVien" CASCADE;
DROP TABLE IF EXISTS "ChuQuan" CASCADE;

/* 1. ChuQuan */
CREATE TABLE "ChuQuan" (
    "Machuquan"   CHAR(8)      NOT NULL,
    "Tendangnhap" VARCHAR(50)  NOT NULL,
    "Matkhau"     VARCHAR(255) NOT NULL,
    CONSTRAINT PK_ChuQuan PRIMARY KEY ("Machuquan"),
    CONSTRAINT CK_ChuQuan_Ma CHECK (LENGTH("Machuquan") = 8),
    CONSTRAINT UQ_ChuQuan_Tendangnhap UNIQUE ("Tendangnhap"),
    CONSTRAINT CK_ChuQuan_Tendangnhap CHECK ("Tendangnhap" !~ '^NV[0-9]')
);

/* 2. NhanVien (Tendangnhap chính là Manv) */
CREATE TABLE "NhanVien" (
    "Manv"            CHAR(8)       NOT NULL,
    "Tendangnhap"     CHAR(8)       NOT NULL,
    "Matkhau"         VARCHAR(255)  NOT NULL,
    "Hoten"           VARCHAR(50)  NOT NULL,
    "Sdt"             CHAR(10)      NOT NULL,
    "Diachi"          VARCHAR(200) NOT NULL,
    "Truonghoc"       VARCHAR(100) NULL,
    "Vitrilamviec"    VARCHAR(50)  NOT NULL,
    "Hinhthuclam"     VARCHAR(30)  NOT NULL,
    "Ngayvaolam"      DATE          NOT NULL,
    "Kinhnghiem"      VARCHAR(200) NOT NULL,
    "Trangthai"       VARCHAR(30)  NOT NULL DEFAULT 'Thử việc',
    "Mucluongtheogio" INT           NOT NULL,
    CONSTRAINT PK_NhanVien PRIMARY KEY ("Manv"),
    CONSTRAINT CK_NhanVien_Ma CHECK (LENGTH("Manv") = 8),
    CONSTRAINT UQ_NhanVien_Tendangnhap UNIQUE ("Tendangnhap"),
    CONSTRAINT CK_NhanVien_Tendangnhap CHECK ("Tendangnhap" = "Manv"),
    CONSTRAINT UQ_NhanVien_Sdt UNIQUE ("Sdt"),
    CONSTRAINT CK_NhanVien_Sdt CHECK ("Sdt" ~ '^0[0-9]{9}$'),
    CONSTRAINT CK_NhanVien_Vitri CHECK ("Vitrilamviec" IN ('Phục vụ', 'Pha chế')),
    CONSTRAINT CK_NhanVien_Hinhthuc CHECK ("Hinhthuclam" IN ('Part-time', 'Full-time')),
    CONSTRAINT CK_NhanVien_Trangthai CHECK ("Trangthai" IN ('Thử việc', 'Chính thức')),
    CONSTRAINT CK_NhanVien_Luong CHECK ("Mucluongtheogio" > 0)
);

/* 3. CaLam */
CREATE TABLE "CaLam" (
    "Maca"        CHAR(8)      NOT NULL,
    "Loaica"      VARCHAR(30) NOT NULL,
    "Giobatdau"   TIME         NOT NULL,
    "Gioketthuc"  TIME         NOT NULL,
    "Sonvquydinh" INT          NOT NULL,
    CONSTRAINT PK_CaLam PRIMARY KEY ("Maca"),
    CONSTRAINT CK_CaLam_Ma CHECK (LENGTH("Maca") = 8),
    CONSTRAINT UQ_CaLam_Loaica UNIQUE ("Loaica"),
    CONSTRAINT CK_CaLam_Gio CHECK ("Gioketthuc" > "Giobatdau"),
    CONSTRAINT CK_CaLam_So CHECK ("Sonvquydinh" > 0)
);

/* 4. LichLam (một ca trong một ngày cụ thể) */
CREATE TABLE "LichLam" (
    "Malich"  CHAR(8) NOT NULL,
    "Ngaylam" DATE    NOT NULL,
    "Maca"    CHAR(8) NOT NULL,
    CONSTRAINT PK_LichLam PRIMARY KEY ("Malich"),
    CONSTRAINT CK_LichLam_Ma CHECK (LENGTH("Malich") = 8),
    CONSTRAINT FK_LichLam_CaLam FOREIGN KEY ("Maca") REFERENCES "CaLam"("Maca"),
    CONSTRAINT UQ_LichLam_NgayCa UNIQUE ("Ngaylam", "Maca")
);

/* 5. LichRanh */
CREATE TABLE "LichRanh" (
    "Malichranh" CHAR(8) NOT NULL,
    "Manv"       CHAR(8) NOT NULL,
    "Ngayranh"   DATE    NOT NULL,
    "Caranh"     CHAR(8) NOT NULL,
    CONSTRAINT PK_LichRanh PRIMARY KEY ("Malichranh"),
    CONSTRAINT CK_LichRanh_Ma CHECK (LENGTH("Malichranh") = 8),
    CONSTRAINT FK_LichRanh_NhanVien FOREIGN KEY ("Manv") REFERENCES "NhanVien"("Manv"),
    CONSTRAINT FK_LichRanh_CaLam FOREIGN KEY ("Caranh") REFERENCES "CaLam"("Maca"),
    CONSTRAINT UQ_LichRanh UNIQUE ("Manv", "Ngayranh", "Caranh")
);

/* 6. NhanVien_LichLam (nhân viên được xếp vào lịch làm) */
CREATE TABLE "NhanVien_LichLam" (
    "Manv"   CHAR(8) NOT NULL,
    "Malich" CHAR(8) NOT NULL,
    CONSTRAINT PK_NhanVien_LichLam PRIMARY KEY ("Manv", "Malich"),
    CONSTRAINT FK_NVLL_NhanVien FOREIGN KEY ("Manv") REFERENCES "NhanVien"("Manv"),
    CONSTRAINT FK_NVLL_LichLam FOREIGN KEY ("Malich") REFERENCES "LichLam"("Malich")
);

/* 7. ChamCong */
CREATE TABLE "ChamCong" (
    "Machamcong"       CHAR(8)  NOT NULL,
    "Manv"             CHAR(8)  NOT NULL,
    "Malich"           CHAR(8)  NOT NULL,
    "Thoigiancheckin"  TIMESTAMP(3) NULL,
    "Thoigiancheckout" TIMESTAMP(3) NULL,
    CONSTRAINT PK_ChamCong PRIMARY KEY ("Machamcong"),
    CONSTRAINT CK_ChamCong_Ma CHECK (LENGTH("Machamcong") = 8),
    CONSTRAINT FK_ChamCong_NhanVien FOREIGN KEY ("Manv") REFERENCES "NhanVien"("Manv"),
    CONSTRAINT FK_ChamCong_LichLam FOREIGN KEY ("Malich") REFERENCES "LichLam"("Malich"),
    CONSTRAINT UQ_ChamCong_NvLich UNIQUE ("Manv", "Malich"),
    CONSTRAINT CK_ChamCong_CoGio CHECK ("Thoigiancheckin" IS NOT NULL OR "Thoigiancheckout" IS NOT NULL),
    CONSTRAINT CK_ChamCong_Thutu CHECK ("Thoigiancheckin" IS NULL OR "Thoigiancheckout" IS NULL OR "Thoigiancheckout" > "Thoigiancheckin")
);

/* 8. KyLuong */
CREATE TABLE "KyLuong" (
    "Makyluong" CHAR(8)      NOT NULL,
    "Thang"     SMALLINT      NOT NULL,
    "Nam"       SMALLINT     NOT NULL,
    "Trangthai" VARCHAR(30) NOT NULL DEFAULT 'Chưa tính',
    "Ngaychot"  DATE         NULL,
    CONSTRAINT PK_KyLuong PRIMARY KEY ("Makyluong"),
    CONSTRAINT CK_KyLuong_Ma CHECK (LENGTH("Makyluong") = 8),
    CONSTRAINT CK_KyLuong_Thang CHECK ("Thang" BETWEEN 1 AND 12),
    CONSTRAINT UQ_KyLuong_ThangNam UNIQUE ("Thang", "Nam"),
    CONSTRAINT CK_KyLuong_Trangthai CHECK ("Trangthai" IN ('Chưa tính', 'Dự kiến', 'Đã chốt')),
    CONSTRAINT CK_KyLuong_Ngaychot CHECK (
        ("Trangthai" = 'Đã chốt' AND "Ngaychot" IS NOT NULL) OR
        ("Trangthai" <> 'Đã chốt' AND "Ngaychot" IS NULL))
);

/* 9. BangLuong */
CREATE TABLE "BangLuong" (
    "Mabangluong"  CHAR(8)       NOT NULL,
    "Tienthuong"   INT           NOT NULL DEFAULT 0,
    "Lydothuong"   VARCHAR(200) NULL,
    "Lydochinhsua" VARCHAR(200) NULL,
    "Manv"         CHAR(8)       NOT NULL,
    "Makyluong"    CHAR(8)       NOT NULL,
    CONSTRAINT PK_BangLuong PRIMARY KEY ("Mabangluong"),
    CONSTRAINT CK_BangLuong_Ma CHECK (LENGTH("Mabangluong") = 8),
    CONSTRAINT CK_BangLuong_Thuong CHECK ("Tienthuong" >= 0),
    CONSTRAINT FK_BangLuong_NhanVien FOREIGN KEY ("Manv") REFERENCES "NhanVien"("Manv"),
    CONSTRAINT FK_BangLuong_KyLuong FOREIGN KEY ("Makyluong") REFERENCES "KyLuong"("Makyluong"),
    CONSTRAINT UQ_BangLuong_NvKy UNIQUE ("Manv", "Makyluong"),
    CONSTRAINT CK_BangLuong_Lydo CHECK ("Tienthuong" = 0 OR "Lydothuong" IS NOT NULL)
);

/* 10. PhanHoiLuong */
CREATE TABLE "PhanHoiLuong" (
    "Maphanhoi"   CHAR(8)       NOT NULL,
    "Noidung"     VARCHAR(500) NOT NULL,
    "Ngaygui"     DATE          NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
    "Ngayxuly"    DATE          NULL,
    "Trangthai"   VARCHAR(30)  NOT NULL DEFAULT 'Chưa xử lý',
    "Mabangluong" CHAR(8)       NOT NULL,
    CONSTRAINT PK_PhanHoiLuong PRIMARY KEY ("Maphanhoi"),
    CONSTRAINT CK_PhanHoi_Ma CHECK (LENGTH("Maphanhoi") = 8),
    CONSTRAINT CK_PhanHoi_Trangthai CHECK ("Trangthai" IN ('Chưa xử lý', 'Đã xử lý')),
    CONSTRAINT FK_PhanHoi_BangLuong FOREIGN KEY ("Mabangluong") REFERENCES "BangLuong"("Mabangluong"),
    CONSTRAINT CK_PhanHoi_Ngay CHECK ("Ngayxuly" IS NULL OR "Ngayxuly" >= "Ngaygui")
);

/* 11. HeSoLuong */
CREATE TABLE "HeSoLuong" (
    "Maheso"      CHAR(8)      NOT NULL,
    "Ngaybatdau"  DATE         NOT NULL,
    "Ngayketthuc" DATE         NOT NULL,
    "Heso"        DECIMAL(5,2) NOT NULL,
    CONSTRAINT PK_HeSoLuong PRIMARY KEY ("Maheso"),
    CONSTRAINT CK_HeSo_Ma CHECK (LENGTH("Maheso") = 8),
    CONSTRAINT CK_HeSo_Heso CHECK ("Heso" >= 1),
    CONSTRAINT CK_HeSo_Ngay CHECK ("Ngayketthuc" >= "Ngaybatdau")
);

/* 12. ChiTietBangLuong */
CREATE TABLE "ChiTietBangLuong" (
    "MaCTBL"      CHAR(8)      NOT NULL,
    "Ngaylam"     DATE         NOT NULL,
    "Giolam"      DECIMAL(5,2) NOT NULL,
    "Mucluong"    INT          NOT NULL,
    "Mabangluong" CHAR(8)      NOT NULL,
    "Maheso"      CHAR(8)      NULL,
    CONSTRAINT PK_ChiTietBangLuong PRIMARY KEY ("MaCTBL"),
    CONSTRAINT CK_CTBL_Ma CHECK (LENGTH("MaCTBL") = 8),
    CONSTRAINT CK_CTBL_Giolam CHECK ("Giolam" > 0),
    CONSTRAINT CK_CTBL_Mucluong CHECK ("Mucluong" > 0),
    CONSTRAINT FK_CTBL_BangLuong FOREIGN KEY ("Mabangluong") REFERENCES "BangLuong"("Mabangluong"),
    CONSTRAINT FK_CTBL_HeSo FOREIGN KEY ("Maheso") REFERENCES "HeSoLuong"("Maheso"),
    CONSTRAINT UQ_CTBL_BangNgay UNIQUE ("Mabangluong", "Ngaylam")
);

/* 13. YeuCauBoSungCC (Giovaobosung/Giorabosung chỉ lưu GIỜ; ngày lấy từ LichLam.Ngaylam qua Malich) */
CREATE TABLE "YeuCauBoSungCC" (
    "Mayeucau"     CHAR(8)       NOT NULL,
    "Giovaobosung" TIME          NULL,
    "Giorabosung"  TIME          NOT NULL,
    "Lydo"         VARCHAR(200) NOT NULL,
    "Trangthai"    VARCHAR(30)  NOT NULL DEFAULT 'Chưa xử lý',
    "Manv"         CHAR(8)       NOT NULL,
    "Malich"       CHAR(8)       NOT NULL,
    CONSTRAINT PK_YeuCauBoSungCC PRIMARY KEY ("Mayeucau"),
    CONSTRAINT CK_YeuCau_Ma CHECK (LENGTH("Mayeucau") = 8),
    CONSTRAINT CK_YeuCau_Trangthai CHECK ("Trangthai" IN ('Chưa xử lý', 'Đã xử lý')),
    CONSTRAINT FK_YeuCau_NhanVien FOREIGN KEY ("Manv") REFERENCES "NhanVien"("Manv"),
    CONSTRAINT FK_YeuCau_LichLam FOREIGN KEY ("Malich") REFERENCES "LichLam"("Malich"),
    CONSTRAINT CK_YeuCau_Gio CHECK ("Giovaobosung" IS NULL OR "Giorabosung" > "Giovaobosung")
);

/* 14. DonXinDoiCa (Khongconguoidoica là thuộc tính dẫn xuất = Manvnhanthay IS NULL, KHÔNG lưu) */
CREATE TABLE "DonXinDoiCa" (
    "Madon"         CHAR(8)      NOT NULL,
    "Trangthaixuly" VARCHAR(30) NOT NULL DEFAULT 'Chưa xử lý',
    "Manv"          CHAR(8)      NOT NULL,
    "Malich"        CHAR(8)      NOT NULL,
    "Manvnhanthay"  CHAR(8)      NULL,
    CONSTRAINT PK_DonXinDoiCa PRIMARY KEY ("Madon"),
    CONSTRAINT CK_Don_Ma CHECK (LENGTH("Madon") = 8),
    CONSTRAINT CK_Don_Trangthai CHECK ("Trangthaixuly" IN ('Chưa xử lý', 'Đã xử lý')),
    CONSTRAINT FK_Don_NhanVien FOREIGN KEY ("Manv") REFERENCES "NhanVien"("Manv"),
    CONSTRAINT FK_Don_LichLam FOREIGN KEY ("Malich") REFERENCES "LichLam"("Malich"),
    CONSTRAINT FK_Don_NVNhanThay FOREIGN KEY ("Manvnhanthay") REFERENCES "NhanVien"("Manv"),
    CONSTRAINT CK_Don_KhongTuThay CHECK ("Manvnhanthay" IS NULL OR "Manvnhanthay" <> "Manv")
);

/* ---- Chỉ mục phục vụ truy vấn thường dùng (không đổi cấu trúc bảng) ---- */
CREATE INDEX IX_LichLam_Ngaylam       ON "LichLam"("Ngaylam");
CREATE INDEX IX_NVLL_Malich           ON "NhanVien_LichLam"("Malich");
CREATE INDEX IX_ChamCong_Malich       ON "ChamCong"("Malich");
CREATE INDEX IX_LichRanh_Ngayranh     ON "LichRanh"("Ngayranh");
CREATE INDEX IX_BangLuong_Makyluong   ON "BangLuong"("Makyluong");
CREATE INDEX IX_CTBL_Mabangluong      ON "ChiTietBangLuong"("Mabangluong");
CREATE INDEX IX_YeuCau_Trangthai      ON "YeuCauBoSungCC"("Trangthai");
CREATE INDEX IX_Don_Trangthai         ON "DonXinDoiCa"("Trangthaixuly");

COMMIT;
