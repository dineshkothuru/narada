import { Route, Routes } from "react-router";
import RootLayout from "@/pages/RootLayout";
import Home from "@/pages/Home";
import AdminLoginPage from "@/pages/admin/Login";
import KitchenPage from "@/pages/Kitchen";
import FloorPage from "@/pages/Floor";
import ComingSoon from "@/components/ComingSoon";
import RequireRole from "@/components/RequireRole";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="t/:code" element={<ComingSoon name="Table menu" />} />
        <Route path="bill/:session" element={<ComingSoon name="Bill" />} />

        <Route path="admin/login" element={<AdminLoginPage />} />

        <Route
          path="admin"
          element={
            <RequireRole roles={["admin"]}>
              <ComingSoon name="Admin" />
            </RequireRole>
          }
        />
        <Route
          path="admin/orders"
          element={
            <RequireRole roles={["admin"]}>
              <ComingSoon name="Orders" />
            </RequireRole>
          }
        />
        <Route
          path="admin/qr"
          element={
            <RequireRole roles={["admin"]}>
              <ComingSoon name="QR codes" />
            </RequireRole>
          }
        />
        <Route
          path="admin/tables"
          element={
            <RequireRole roles={["admin"]}>
              <ComingSoon name="Tables" />
            </RequireRole>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireRole roles={["admin"]}>
              <ComingSoon name="Users" />
            </RequireRole>
          }
        />

        <Route
          path="kitchen"
          element={
            <RequireRole roles={["admin", "kitchen"]}>
              <KitchenPage />
            </RequireRole>
          }
        />
        <Route
          path="waiter"
          element={
            <RequireRole roles={["admin", "waiter"]}>
              <ComingSoon name="Waiter" />
            </RequireRole>
          }
        />
        <Route
          path="floor"
          element={
            <RequireRole roles={["admin", "waiter", "reception", "cashier"]}>
              <FloorPage />
            </RequireRole>
          }
        />
        <Route
          path="counter"
          element={
            <RequireRole roles={["admin", "cashier"]}>
              <ComingSoon name="Counter" />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
  );
}
