export type UCStatus = "da-lam" | "chua-lam";

export interface MenuItem {
  title: string;
  href: string;
  uc: string;
  status: UCStatus;
}

export interface MenuGroup {
  id: string;
  title: string;
  href?: string; // Cho mục đơn như Màn hình chính
  uc?: string;
  status?: UCStatus;
  items?: MenuItem[];
  defaultHref?: string; // Đường dẫn mặc định khi vào nhóm cha (mục con đầu tiên)
}

/**
 * Menu vai trò Chủ quán – Nguồn sự thật duy nhất cho sidebar & điều hướng
 */
export const chuQuanMenu: MenuGroup[] = [
  {
    id: "main",
    title: "Màn hình chính",
    href: "/chu-quan",
    uc: "UC_1",
    status: "da-lam",
  },
  {
    id: "nv",
    title: "Quản lý thông tin nhân viên",
    defaultHref: "/chu-quan/nhan-vien/them",
    items: [
      { title: "Thêm thông tin", href: "/chu-quan/nhan-vien/them", uc: "UC_5.1", status: "da-lam" },
      { title: "Sửa thông tin", href: "/chu-quan/nhan-vien/sua", uc: "UC_5.2", status: "da-lam" },
      { title: "Xem thông tin", href: "/chu-quan/nhan-vien/xem", uc: "UC_5.4", status: "da-lam" },
      { title: "Xoá thông tin", href: "/chu-quan/nhan-vien/xoa", uc: "UC_5.3", status: "da-lam" },
    ],
  },
  {
    id: "lich",
    title: "Quản lý lịch làm",
    defaultHref: "/chu-quan/lich-lam/xep-lich",
    items: [
      { title: "Xếp lịch làm", href: "/chu-quan/lich-lam/xep-lich", uc: "UC_6.1", status: "da-lam" },
      { title: "Xếp ca làm", href: "/chu-quan/lich-lam/xep-ca", uc: "UC_6.2", status: "da-lam" },
      { title: "Xử lý đổi ca", href: "/chu-quan/lich-lam/doi-ca", uc: "UC_6.3", status: "da-lam" },
    ],
  },
  {
    id: "chamcong",
    title: "Quản lý chấm công",
    defaultHref: "/chu-quan/cham-cong/bo-sung",
    items: [
      { title: "Bổ sung chấm công", href: "/chu-quan/cham-cong/bo-sung", uc: "UC_7.1", status: "da-lam" },
      { title: "Xem báo cáo chấm công", href: "/chu-quan/cham-cong/bao-cao", uc: "UC_7.2", status: "da-lam" },
    ],
  },
  {
    id: "luong",
    title: "Quản lý lương",
    defaultHref: "/chu-quan/luong/muc-luong",
    items: [
      { title: "Cập nhật mức lương", href: "/chu-quan/luong/muc-luong", uc: "UC_8.1", status: "da-lam" },
      { title: "Tính lương", href: "/chu-quan/luong/tinh-luong", uc: "UC_8.2", status: "da-lam" },
      { title: "Chỉnh sửa sai sót bảng lương", href: "/chu-quan/luong/chinh-sua", uc: "UC_8.3", status: "da-lam" },
      { title: "Nhập hệ số lương", href: "/chu-quan/luong/he-so", uc: "UC_8.4", status: "da-lam" },
      { title: "Nhập tiền thưởng", href: "/chu-quan/luong/tien-thuong", uc: "UC_8.5", status: "da-lam" },
      { title: "Chốt bảng lương", href: "/chu-quan/luong/chot-luong", uc: "UC_8.6", status: "da-lam" },
    ],
  },
];

/**
 * Menu vai trò Nhân viên – Nguồn sự thật duy nhất cho sidebar & điều hướng
 */
export const nhanVienMenu: MenuGroup[] = [
  {
    id: "main",
    title: "Màn hình chính",
    href: "/nhan-vien",
    uc: "UC_1",
    status: "da-lam",
  },
  {
    id: "calam",
    title: "Quản lý ca làm cá nhân",
    defaultHref: "/nhan-vien/ca-lam/lich-ranh",
    items: [
      { title: "Đăng ký lịch rảnh", href: "/nhan-vien/ca-lam/lich-ranh", uc: "UC_2.1", status: "da-lam" },
      { title: "Yêu cầu đổi ca", href: "/nhan-vien/ca-lam/doi-ca", uc: "UC_2.2", status: "da-lam" },
      { title: "Thay ca", href: "/nhan-vien/ca-lam/thay-ca", uc: "UC_2.3", status: "da-lam" },
    ],
  },
  {
    id: "chamcong_nv",
    title: "Chấm công",
    defaultHref: "/nhan-vien/cham-cong/check-in",
    items: [
      { title: "Check-in", href: "/nhan-vien/cham-cong/check-in", uc: "UC_3.1", status: "da-lam" },
      { title: "Check-out", href: "/nhan-vien/cham-cong/check-out", uc: "UC_3.2", status: "da-lam" },
      { title: "Yêu cầu bổ sung chấm công", href: "/nhan-vien/cham-cong/bo-sung", uc: "UC_3.3", status: "da-lam" },
    ],
  },
  {
    id: "luong_nv",
    title: "Kiểm tra bảng lương",
    defaultHref: "/nhan-vien/luong/xem",
    items: [
      { title: "Xem bảng lương", href: "/nhan-vien/luong/xem", uc: "UC_4.1", status: "da-lam" },
      { title: "Phản hồi sai sót lương", href: "/nhan-vien/luong/phan-hoi", uc: "UC_4.2", status: "da-lam" },
    ],
  },
];

/**
 * Lấy danh sách tất cả các route trong menu (bao gồm cả màn hình chính và mục con)
 */
export function getAllMenuRoutes(): { href: string; title: string; uc: string; status: UCStatus; role: "ChuQuan" | "NhanVien" }[] {
  const list: { href: string; title: string; uc: string; status: UCStatus; role: "ChuQuan" | "NhanVien" }[] = [];

  for (const group of chuQuanMenu) {
    if (group.href) {
      list.push({ href: group.href, title: group.title, uc: group.uc || "", status: group.status || "chua-lam", role: "ChuQuan" });
    }
    if (group.items) {
      for (const item of group.items) {
        list.push({ href: item.href, title: item.title, uc: item.uc, status: item.status, role: "ChuQuan" });
      }
    }
  }

  for (const group of nhanVienMenu) {
    if (group.href) {
      list.push({ href: group.href, title: group.title, uc: group.uc || "", status: group.status || "chua-lam", role: "NhanVien" });
    }
    if (group.items) {
      for (const item of group.items) {
        list.push({ href: item.href, title: item.title, uc: item.uc, status: item.status, role: "NhanVien" });
      }
    }
  }

  return list;
}

/**
 * Tìm mục menu theo route
 */
export function findMenuItemByRoute(pathname: string): (MenuItem | MenuGroup) | undefined {
  for (const group of [...chuQuanMenu, ...nhanVienMenu]) {
    if (group.href === pathname) return group;
    if (group.items) {
      const found = group.items.find((i) => i.href === pathname);
      if (found) return found;
    }
  }
  return undefined;
}
