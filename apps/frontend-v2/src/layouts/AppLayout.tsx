import React from "react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-void-950 text-mist-400 font-sans selection:bg-aurora-teal selection:text-void-950 overflow-x-hidden relative">
      {/* Decorative Blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-aurora-purple/10 blur-[130px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-aurora-teal/10 blur-[130px] rounded-full pointer-events-none mix-blend-screen" />

      {/* Main Content */}
      <main className="relative z-10 w-full">{children}</main>
    </div>
  );
};
