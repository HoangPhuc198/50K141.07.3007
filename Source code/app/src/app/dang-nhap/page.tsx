import { Suspense } from "react";
import { LoginScreen } from "@frontend/screens/dang-nhap/LoginScreen";

export default function DangNhapPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFF9F0]" />}>
      <LoginScreen />
    </Suspense>
  );
}
