import { Outlet } from "react-router-dom";

export const AuthLayout = () => (
  <div className="min-h-screen bg-paper-bg flex items-center justify-center p-4">
    <Outlet />
  </div>
);
