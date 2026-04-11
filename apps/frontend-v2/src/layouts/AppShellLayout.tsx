import { Outlet } from "react-router-dom";
import { AppLayout } from "./AppLayout";

// Authenticated app pages (dashboard, tailor, credits, editor) get the sidebar layout
export const AppShellLayout = () => (
  <AppLayout>
    <Outlet />
  </AppLayout>
);
