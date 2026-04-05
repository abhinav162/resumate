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
    <div className="h-screen w-screen bg-paper-bg flex flex-col overflow-hidden font-sans text-ink-primary">
      {/* 1. Global Header (Thin: 48px) */}
      <header className="h-[48px] border-b border-paper-border bg-paper-surface flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="h-4 w-px bg-paper-border" />
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-sm">Resumate</span>
            <span className="text-ink-secondary text-xs">/</span>
            <input
              type="text"
              defaultValue={title}
              className="bg-transparent border-none p-0 text-sm focus:ring-0 text-ink-primary font-medium w-48 placeholder:text-ink-secondary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <div className="h-4 w-px bg-paper-border mx-2" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-ink-secondary"
          >
            <Share2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-ink-secondary"
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
