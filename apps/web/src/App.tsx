import { Route, Routes } from "react-router";
import RootLayout from "@/pages/RootLayout";
import Home from "@/pages/Home";
import OutletLoginPage from "@/pages/admin/Login";
import StaffSignupPage from "@/pages/admin/Signup";
import KitchenPage from "@/pages/Kitchen";
import FloorPage from "@/pages/Floor";
import WaiterPage from "@/pages/Waiter";
import CounterPage from "@/pages/Counter";
import AdminDashboardPage from "@/pages/admin/Dashboard";
import AdminMenuPage from "@/pages/admin/Menu";
import AdminOrdersPage from "@/pages/admin/Orders";
import AdminReportPage from "@/pages/admin/Report";
import AdminQrPage from "@/pages/admin/Qr";
import AdminTablesPage from "@/pages/admin/Tables";
import AdminUsersPage from "@/pages/admin/Users";
import TablePage from "@/pages/Table";
import BillPage from "@/pages/Bill";
import RequireRole from "@/components/RequireRole";
import CustomerLoginPage from "@/pages/CustomerLogin";
import CustomerSignupPage from "@/pages/CustomerSignup";
import KitchenKotPage from "@/pages/KitchenKot";
import WaiterTablePage from "@/pages/WaiterTable";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<CustomerLoginPage />} />
        <Route path="signup" element={<CustomerSignupPage />} />
        <Route path="t/:code" element={<TablePage legacy />} />
        <Route path="outlet/:slug" element={<TablePage />} />
        <Route path="outlet/:slug/table/:tableCode" element={<TablePage />} />
        <Route path="bill/:session" element={<BillPage />} />
        <Route
          path="kitchen/kot/:order"
          element={
            <RequireRole roles={["admin", "kitchen"]}>
              <KitchenKotPage />
            </RequireRole>
          }
        />
        <Route
          path="waiter/table/:code"
          element={
            <RequireRole roles={["admin", "waiter"]}>
              <WaiterTablePage />
            </RequireRole>
          }
        />

        <Route path="outlet/:slug/login" element={<OutletLoginPage />} />

        <Route
          path="admin/signup"
          element={
            <RequireRole roles={["admin"]}>
              <StaffSignupPage role="admin" />
            </RequireRole>
          }
        />
        <Route
          path="kitchen/signup"
          element={
            <RequireRole roles={["admin"]}>
              <StaffSignupPage role="kitchen" />
            </RequireRole>
          }
        />
        <Route
          path="waiter/signup"
          element={
            <RequireRole roles={["admin"]}>
              <StaffSignupPage role="waiter" />
            </RequireRole>
          }
        />
        <Route
          path="floor/signup"
          element={
            <RequireRole roles={["admin"]}>
              <StaffSignupPage role="reception" />
            </RequireRole>
          }
        />
        <Route
          path="counter/signup"
          element={
            <RequireRole roles={["admin"]}>
              <StaffSignupPage role="cashier" />
            </RequireRole>
          }
        />

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
          path="admin/report"
          element={
            <RequireRole roles={["admin"]}>
              <AdminReportPage />
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
