import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import { FileText, Sparkles } from 'lucide-react';
import { CreditCounter } from '../components/ui/CreditCounter';

const navItems = [
  { to: '/dashboard', label: 'My Resumes', icon: FileText },
  { to: '/tailor', label: 'Tailor', icon: Sparkles },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useUser();

  return (
    <div className="flex min-h-screen bg-paper-bg">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-paper-border bg-paper-surface flex flex-col">
        <div className="p-4 border-b border-paper-border">
          <span className="font-heading font-bold text-lg text-ink-primary tracking-tight">
            resu<span className="text-indigo-600">mate</span>
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-ink-secondary hover:bg-paper-bg hover:text-ink-primary'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-paper-border space-y-3">
          <CreditCounter />
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-paper-bg transition-colors">
            <UserButton
              appearance={{
                variables: {
                  colorBackground: '#ffffff',
                  colorText: '#0f0f0f',
                  colorPrimary: '#4f46e5',
                  colorTextSecondary: '#555555',
                  colorInputBackground: '#fafaf8',
                  colorInputText: '#0f0f0f',
                },
                elements: {
                  avatarBox: 'w-8 h-8 rounded-lg border border-paper-border',
                },
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-primary truncate">
                {user?.fullName || user?.firstName || 'User'}
              </p>
              <p className="text-xs text-ink-muted truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
