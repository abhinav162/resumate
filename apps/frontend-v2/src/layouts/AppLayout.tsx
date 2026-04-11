import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { CreditCounter } from '../components/ui/CreditCounter';

const navItems = [
  { to: '/dashboard', label: 'My Resumes', icon: '📄' },
  { to: '/tailor', label: 'Tailor', icon: '✨' },
];

export function AppLayout({ children }: { children: ReactNode }) {
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
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-paper-border">
          <CreditCounter />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
