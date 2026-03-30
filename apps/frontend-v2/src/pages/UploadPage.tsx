import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadDropzone } from '../components/features/upload/UploadDropzone';
import { resumesApi } from '../lib/api';

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const { resumeId } = await resumesApi.uploadPdf(file);
      navigate(`/editor/${resumeId}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-heading text-3xl font-bold text-ink-primary tracking-tight">
            Upload your resume
          </h1>
          <p className="text-ink-secondary text-sm">
            AI will score it and show you exactly how to improve it — in seconds.
          </p>
        </div>

        <UploadDropzone onFile={handleFile} loading={loading} />

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
  );
}
