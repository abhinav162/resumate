
import React, { useState } from 'react';
import Input from './common/Input';
import Button from './common/Button';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetApiKey: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSetApiKey }) => {
  const [key, setKey] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSetApiKey(key.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Set Gemini API Key</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <p className="text-gray-400 mb-4 text-sm">
          To use this application, you need to provide your own Google Gemini API key. Your key is stored only in your browser's local storage and is not sent to our servers.
        </p>
        <form onSubmit={handleSubmit}>
          <Input 
            label="API Key"
            id="api-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            required
          />
          <div className="mt-6 flex justify-end">
            <Button type="submit">Save Key</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiKeyModal;
