import { AppLayout } from "./AppLayout";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useClerk, UserButton } from "@clerk/clerk-react";
import { Button } from "../components/ui/Button";

export const RootLayout = () => {
  const { user } = useClerk();
  const location = useLocation();
  const isEditorPage = location.pathname === "/testEditors";

  return (
    <AppLayout>
      {/* Navigation Dock - Hidden on Editor Pages */}
      {!isEditorPage && (
        <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-full bg-void-900/60 border border-white/10 backdrop-blur-xl shadow-lg shadow-black/20">
          <Link
            to="/"
            className="px-4 py-2 rounded-full text-sm font-medium text-mist-100 hover:bg-white/5 transition-colors font-serif"
          >
            Resumate
          </Link>

          {user && (
            <>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-full text-sm text-mist-400 hover:text-mist-100 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/tailor"
                className="px-4 py-2 rounded-full text-sm text-mist-400 hover:text-mist-100 transition-colors"
              >
                Tailor
              </Link>
            </>
          )}

          <div className="w-px h-4 bg-white/10 mx-1" />

          <div className="pl-2 pr-2">
            {user ? (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 rounded-full border border-white/10",
                  },
                }}
              />
            ) : (
              <Link to="/sign-in">
                <Button size="sm" className="h-8 text-xs px-4">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </nav>
      )}

      <main className={`min-h-screen ${isEditorPage ? "" : "pt-24"}`}>
        <Outlet />
      </main>
    </AppLayout>
  );
};
