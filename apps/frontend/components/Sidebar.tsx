import React from 'react';
import { UserButton } from "@clerk/clerk-react";
import type { View } from '../types';

interface SidebarProps {
    currentView: View;
    setCurrentView: (view: View) => void;
    onApiKeyClick: () => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onApiKeyClick, isOpen, setIsOpen }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'profile', label: 'Profile Manager', icon: '👤' },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static
      `}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-6 border-b border-gray-800">
                        <span className="text-2xl mr-2">📄</span>
                        <span className="text-xl font-bold text-indigo-400 tracking-tight">Resumate</span>
                    </div>

                    {/* Nav Items */}
                    <nav className="flex-1 px-4 py-6 space-y-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setCurrentView(item.id as View);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === item.id
                                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* Bottom Actions */}
                    <div className="p-4 border-t border-gray-800 space-y-4">
                        <button
                            onClick={onApiKeyClick}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors border border-gray-700"
                        >
                            <span>🔑</span> API Key
                        </button>

                        <div className="flex items-center gap-3 px-2">
                            <UserButton
                                appearance={{
                                    elements: {
                                        rootBox: "w-full",
                                        userButtonBox: "flex-row-reverse w-full justify-between",
                                        userButtonOuterIdentifier: "text-gray-300 text-sm font-medium",
                                    }
                                }}
                                showName
                            />
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
