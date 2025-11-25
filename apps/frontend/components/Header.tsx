
import React from 'react';
import { UserButton } from "@clerk/clerk-react";
import type { View } from '../types';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onApiKeyClick: () => void;
}

const NavItem: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
      ? 'bg-gray-700 text-white'
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
  >
    {label}
  </button>
);

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView, onApiKeyClick }) => {
  return (
    <header className="bg-gray-800 shadow-md">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-indigo-400">Resumate</h1>
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                <NavItem label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
                <NavItem label="Profile Manager" isActive={currentView === 'profile'} onClick={() => setCurrentView('profile')} />
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={onApiKeyClick}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              API Key
            </button>
            <UserButton />
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
