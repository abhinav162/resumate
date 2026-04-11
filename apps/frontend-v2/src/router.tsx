import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
} from "@clerk/clerk-react";
import { RootLayout } from "./layouts/RootLayout";
import { AppShellLayout } from "./layouts/AppShellLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/UploadPage";
import TailorWorkspace from "./pages/TailorWorkspace";
import CreditsPage from "./pages/CreditsPage";
import { AuroraWorkbenchEditor } from "./components/features/editor/AuroraWorkbenchEditor";
import LandingPage from "./pages/LandingPage";
import { dark } from "@clerk/themes";

// Environment check — prefer runtime window.ENV injection (Docker), fall back to build-time
declare global { interface Window { ENV?: Record<string, string> } }
const PUBLISHABLE_KEY =
  window.ENV?.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const router = createBrowserRouter([
  // Bare layout: public pages + full-screen editor
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      {
        path: "/upload",
        element: (
          <>
            <SignedIn><UploadPage /></SignedIn>
            <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
          </>
        ),
      },
      {
        path: "/editor",
        element: <SignedIn><AuroraWorkbenchEditor /></SignedIn>,
      },
      {
        path: "/editor/:id",
        element: <SignedIn><AuroraWorkbenchEditor /></SignedIn>,
      },
    ],
  },
  // App shell (sidebar): dashboard, tailor, credits
  {
    element: <AppShellLayout />,
    children: [
      {
        path: "/dashboard",
        element: (
          <>
            <SignedIn><Dashboard /></SignedIn>
            <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
          </>
        ),
      },
      {
        path: "/tailor",
        element: <SignedIn><TailorWorkspace /></SignedIn>,
      },
      {
        path: "/credits",
        element: (
          <>
            <SignedIn><CreditsPage /></SignedIn>
            <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
          </>
        ),
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/sign-in/*",
        element: (
          <SignIn
            appearance={{
              baseTheme: dark,
              variables: {
                colorBackground: "transparent",
                colorText: "#F4F4F5",
                colorPrimary: "#14B8A6",
                colorTextSecondary: "#A1A1AA",
                colorInputBackground: "#18181B",
                colorInputText: "#F4F4F5",
              },
              elements: {
                rootBox: "w-full flex justify-center",
                card: "bg-transparent shadow-none w-full max-w-full p-0",
                headerTitle: "text-mist-100 font-serif text-center",
                headerSubtitle: "text-mist-400 text-center",
                socialButtonsBlockButton:
                  "bg-void-950/50 border border-white/10 text-mist-100 hover:bg-white/5 transition-colors",
                dividerLine: "bg-white/10",
                dividerText:
                  "text-mist-400 font-mono text-xs uppercase tracking-wider",
                formFieldLabel: "text-mist-400 font-medium",
                formFieldInput:
                  "bg-void-950/50 border-white/10 text-mist-100 focus:border-aurora-purple rounded-xl transition-all",
                footerActionText: "text-mist-400",
                footerActionLink:
                  "text-aurora-teal hover:text-aurora-teal/80 font-medium",
              },
            }}
          />
        ),
      },
      {
        path: "/sign-up/*",
        element: (
          <SignUp
            appearance={{
              baseTheme: dark,
              variables: {
                colorBackground: "transparent",
                colorText: "#F4F4F5",
                colorPrimary: "#14B8A6",
                colorTextSecondary: "#A1A1AA",
                colorInputBackground: "#18181B",
                colorInputText: "#F4F4F5",
              },
              elements: {
                rootBox: "w-full flex justify-center",
                card: "bg-transparent shadow-none w-full max-w-full p-0",
                headerTitle: "text-mist-100 font-serif text-center",
                headerSubtitle: "text-mist-400 text-center",
                socialButtonsBlockButton:
                  "bg-void-950/50 border border-white/10 text-mist-100 hover:bg-white/5 transition-colors",
                dividerLine: "bg-white/10",
                dividerText:
                  "text-mist-400 font-mono text-xs uppercase tracking-wider",
                formFieldLabel: "text-mist-400 font-medium",
                formFieldInput:
                  "bg-void-950/50 border-white/10 text-mist-100 focus:border-aurora-purple rounded-xl transition-all",
                footerActionText: "text-mist-400",
                footerActionLink:
                  "text-aurora-teal hover:text-aurora-teal/80 font-medium",
              },
            }}
          />
        ),
      },
    ],
  },
]);

import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { setAuthHeaders } from "./lib/api";
import { CreditProvider } from "./contexts/CreditContext";

export default function AppRouter() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <AuthInitializer>
        <RouterProvider router={router} />
      </AuthInitializer>
    </ClerkProvider>
  );
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();

  useEffect(() => {
    const syncAuth = async () => {
      try {
        const token = await getToken();
        setAuthHeaders(token, userId);
      } catch (err) {
        console.error("Failed to sync auth token", err);
      }
    };
    syncAuth();
  }, [getToken, userId]);

  return <CreditProvider>{children}</CreditProvider>;
}
