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
import TailoredResumesPage from "./pages/TailoredResumesPage";
import CreditsPage from "./pages/CreditsPage";
import { AuroraWorkbenchEditor } from "./components/features/editor/AuroraWorkbenchEditor";
import LandingPage from "./pages/LandingPage";

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
        element: <SignedIn><AuroraWorkbenchEditor mode="base" /></SignedIn>,
      },
      {
        path: "/editor/tailored/:id",
        element: <SignedIn><AuroraWorkbenchEditor mode="tailored" /></SignedIn>,
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
        path: "/tailored",
        element: (
          <>
            <SignedIn><TailoredResumesPage /></SignedIn>
            <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
          </>
        ),
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
              variables: {
                colorBackground: "#ffffff",
                colorText: "#0f0f0f",
                colorPrimary: "#4f46e5",
                colorTextSecondary: "#555555",
                colorInputBackground: "#fafaf8",
                colorInputText: "#0f0f0f",
                colorNeutral: "#0f0f0f",
                borderRadius: "8px",
                fontFamily: '"DM Sans", sans-serif',
              },
              elements: {
                rootBox: "w-full flex justify-center",
                card: "shadow-elevated border border-paper-border w-full max-w-md",
                headerTitle: "font-heading text-ink-primary",
                headerSubtitle: "text-ink-secondary",
                socialButtonsBlockButton:
                  "border border-paper-border text-ink-primary bg-paper-bg hover:bg-paper-surface transition-colors",
                socialButtonsBlockButtonText: "text-ink-primary font-medium",
                dividerLine: "bg-paper-border",
                dividerText: "text-ink-muted text-xs uppercase tracking-wider",
                formFieldLabel: "text-ink-secondary font-medium",
                formFieldInput:
                  "bg-paper-bg border-paper-border text-ink-primary focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                footerActionText: "text-ink-muted",
                footerActionLink:
                  "text-indigo-600 hover:text-indigo-700 font-medium",
                formButtonPrimary:
                  "bg-indigo-600 hover:bg-indigo-700 text-white",
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
              variables: {
                colorBackground: "#ffffff",
                colorText: "#0f0f0f",
                colorPrimary: "#4f46e5",
                colorTextSecondary: "#555555",
                colorInputBackground: "#fafaf8",
                colorInputText: "#0f0f0f",
                colorNeutral: "#0f0f0f",
                borderRadius: "8px",
                fontFamily: '"DM Sans", sans-serif',
              },
              elements: {
                rootBox: "w-full flex justify-center",
                card: "shadow-elevated border border-paper-border w-full max-w-md",
                headerTitle: "font-heading text-ink-primary",
                headerSubtitle: "text-ink-secondary",
                socialButtonsBlockButton:
                  "border border-paper-border text-ink-primary bg-paper-bg hover:bg-paper-surface transition-colors",
                socialButtonsBlockButtonText: "text-ink-primary font-medium",
                dividerLine: "bg-paper-border",
                dividerText: "text-ink-muted text-xs uppercase tracking-wider",
                formFieldLabel: "text-ink-secondary font-medium",
                formFieldInput:
                  "bg-paper-bg border-paper-border text-ink-primary focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                footerActionText: "text-ink-muted",
                footerActionLink:
                  "text-indigo-600 hover:text-indigo-700 font-medium",
                formButtonPrimary:
                  "bg-indigo-600 hover:bg-indigo-700 text-white",
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
