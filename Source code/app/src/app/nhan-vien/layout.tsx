import React from "react";
import { AppShell } from "@frontend/components/layout/AppShell";

export default function NhanVienLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
