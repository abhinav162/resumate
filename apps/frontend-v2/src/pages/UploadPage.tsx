import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { UploadDropzone } from '../components/features/upload/UploadDropzone';
import { useUploadPdf } from '../hooks/useResumes';

export default function UploadPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // Upload invalidates the resumes cache so the dashboard shows the new resume.
  const upload = useUploadPdf();

  async function handleFile(file: File) {
    setError(null);
    try {
      const { resumeId } = await upload.mutateAsync(file);
      navigate(`/editor/${resumeId}`);
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-paper-border bg-paper-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="text-ink-secondary hover:text-ink-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <span className="font-heading font-bold text-lg tracking-tight">
            resu<span className="text-indigo-600">mate</span>
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-1">
            <h1 className="font-heading text-3xl font-bold text-ink-primary tracking-tight">
              Upload your resume
            </h1>
            <p className="text-ink-secondary text-sm">
              AI will score it and show you exactly how to improve it — in seconds.
            </p>
          </div>

          <UploadDropzone onFile={handleFile} loading={upload.isPending} />

          {error && (
            <p className="text-sm text-danger-text bg-danger-bg border border-danger-border rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <p className="text-center text-xs text-ink-muted">
            Uses 1 credit to score · 5 credits included free on signup
          </p>
        </div>
      </div>
    </div>
  );
}
