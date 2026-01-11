import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Maximize2, Share2, Loader2 } from "lucide-react";
import { Button } from "../components/ui/Button";

interface EditorLayoutProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  onExport?: () => Promise<void>;
  isExporting?: boolean;
}

export function EditorLayout({
  children,
  title = "Untitled Resume",
  actions,
  onExport,
  isExporting = false,
}: EditorLayoutProps) {
  return (
    <div className="h-screen w-screen bg-void-950 flex flex-col overflow-hidden font-sans text-mist-100">
      {/* 1. Global Header (Thin: 48px) */}
      <header className="h-[48px] border-b border-white/10 bg-void-950 flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            to="/api/resumes"
            className="text-mist-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-sm">Resumate</span>
            <span className="text-mist-500 text-xs">/</span>
            <input
              type="text"
              defaultValue={title}
              className="bg-transparent border-none p-0 text-sm focus:ring-0 text-mist-100 font-medium w-48 placeholder:text-mist-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <div className="h-4 w-px bg-white/10 mx-2" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-mist-400"
          >
            <Share2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-mist-400"
          >
            <Maximize2 size={14} />
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-8 text-xs gap-2 px-3"
            onClick={onExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={12} /> Export
              </>
            )}
          </Button>
        </div>
      </header>

      {/* 2. Main Workspace (Rest of height) */}
      <main className="flex-1 flex overflow-hidden relative">{children}</main>
    </div>
  );
}
