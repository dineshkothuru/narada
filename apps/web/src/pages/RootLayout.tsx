import { Outlet } from "react-router";
import { DialogHost } from "@/components/Dialogs";

// Port of web/app/layout.tsx: fonts and metadata are handled in index.html /
// main.tsx (Vite has no next/font or next/head equivalent), so this only
// keeps the flex shell and the single DialogHost mount every screen shares.
export default function RootLayout() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Outlet />
      <DialogHost />
    </div>
  );
}
