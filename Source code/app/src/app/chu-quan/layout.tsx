import React from "react";
import { AppShell } from "@frontend/components/layout/AppShell";

export default function ChuQuanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
