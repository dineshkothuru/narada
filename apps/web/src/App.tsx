import { Route, Routes } from "react-router";
import RootLayout from "@/pages/RootLayout";
import Home from "@/pages/Home";
import AdminLoginPage from "@/pages/admin/Login";
import KitchenPage from "@/pages/Kitchen";
import FloorPage from "@/pages/Floor";
import WaiterPage from "@/pages/Waiter";
import CounterPage from "@/pages/Counter";
import AdminDashboardPage from "@/pages/admin/Dashboard";
import AdminMenuPage from "@/pages/admin/Menu";
import AdminOrdersPage from "@/pages/admin/Orders";
import AdminQrPage from "@/pages/admin/Qr";
import AdminTablesPage from "@/pages/admin/Tables";
import AdminUsersPage from "@/pages/admin/Users";
import TablePage from "@/pages/Table";
import BillPage from "@/pages/Bill";
import RequireRole from "@/components/RequireRole";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="t/:code" element={<TablePage />} />
        <Route path="bill/:session" element={<BillPage />} />

        <Route path="admin/login" element={<AdminLoginPage />} />

        <Route
          path="admin"
          element={
            <RequireRole roles={["admin"]}>
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/menu"
          element={
            <RequireRole roles={["admin"]}>
              <AdminMenuPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/orders"
          element={
            <RequireRole roles={["admin"]}>
              <AdminOrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/qr"
          element={
            <RequireRole roles={["admin"]}>
              <AdminQrPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/tables"
          element={
            <RequireRole roles={["admin"]}>
              <AdminTablesPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireRole roles={["admin"]}>
              <AdminUsersPage />
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
              <WaiterPage />
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
              <CounterPage />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
  );
}
