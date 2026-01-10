import { AppLayout } from "./AppLayout";
import { Outlet } from "react-router-dom";

export const AuthLayout = () => {
  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Outlet />
      </div>
    </AppLayout>
  );
};
