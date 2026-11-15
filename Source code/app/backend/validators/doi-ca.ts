import { z } from "zod";

export const createDoiCaSchema = z
  .object({
    Malich: z.string().length(8, "Mã lịch làm phải đúng 8 ký tự"),
    Manvnhanthay: z
      .string()
      .length(8, "Mã nhân viên nhận thay phải đúng 8 ký tự")
      .nullable()
      .optional(),
    khongCoNguoiThay: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Hai lựa chọn loại trừ nhau:
      // Nếu khongCoNguoiThay = true thì Manvnhanthay không được có giá trị hợp lệ.
      // Nếu có Manvnhanthay thì khongCoNguoiThay không được là true.
      if (data.khongCoNguoiThay) {
        return !data.Manvnhanthay;
      }
      return Boolean(data.Manvnhanthay);
    },
    {
      message:
        "Vui lòng chọn nhân viên làm thay hoặc tích chọn 'Không có người thay thế'",
      path: ["Manvnhanthay"],
    }
  );

export type CreateDoiCaInput = z.infer<typeof createDoiCaSchema>;

export const xuLyDoiCaSchema = z.object({
  Madon: z.string().trim().length(8, "Mã đơn đổi ca phải đúng 8 ký tự"),
  Manvnhanthay: z
    .string({
      required_error: "Vui lòng chọn người thay ca.",
      invalid_type_error: "Vui lòng chọn người thay ca.",
    })
    .trim()
    .length(8, "Mã nhân viên nhận thay phải đúng 8 ký tự"),
});

export type XuLyDoiCaInput = z.infer<typeof xuLyDoiCaSchema>;
