import { useCallback, useState, DragEvent } from 'react';

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  loading?: boolean;
}

export function UploadDropzone({ onFile, loading }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
        dragging ? 'border-indigo-400 bg-indigo-50' : 'border-paper-border bg-paper-surface hover:border-indigo-300 hover:bg-paper-bg'
      }`}
      onClick={() => { if (!loading) document.getElementById('file-input')?.click(); }}
    >
      <input
        id="file-input"
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {loading ? (
        <div className="space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-ink-secondary">AI is reading your resume...</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-3xl">📄</p>
          <p className="font-heading font-semibold text-ink-primary">Drop your resume here</p>
          <p className="text-sm text-ink-muted">PDF only · Max 5MB · Click to browse</p>
        </div>
      )}
    </div>
  );
}
