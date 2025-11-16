import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AuthCallback: React.FC = () => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token from URL query params
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const errorParam = params.get('error');

        if (errorParam) {
          setError(getErrorMessage(errorParam));
          // Redirect to login after showing error
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
          return;
        }

        if (!token) {
          setError('No authentication token received');
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
          return;
        }

        // Login with the token
        await login(token);

        // Redirect to dashboard
        window.location.href = '/';
      } catch (err) {
        console.error('Authentication callback error:', err);
        setError('Authentication failed. Please try again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      }
    };

    handleCallback();
  }, [login]);

  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      auth_failed: 'Google authentication failed. Please try again.',
      token_generation_failed: 'Failed to generate authentication token.',
      access_denied: 'Access was denied. Please grant the required permissions.',
    };
    return errorMessages[errorCode] || 'An unknown error occurred during authentication.';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="glass-strong rounded-2xl p-8 modern-shadow-lg text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Authentication Error
            </h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <p className="text-sm text-gray-500">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="glass-strong rounded-2xl p-8 modern-shadow-lg text-center">
          {/* Loading Spinner */}
          <div className="flex justify-center mb-6">
            <div className="spinner w-16 h-16"></div>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-4">
            Completing Sign In
          </h2>
          <p className="text-gray-400">
            Please wait while we set up your account...
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
