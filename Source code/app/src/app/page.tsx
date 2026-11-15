import { redirect } from "next/navigation";
import { getSession } from "@backend/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  if (!session) {
    redirect("/dang-nhap");
  }
  if (session.role === "ChuQuan") {
    redirect("/chu-quan");
  }
  redirect("/nhan-vien");
}
