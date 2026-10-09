'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, ClipboardList, User, LogOut, Terminal, ChevronRight, Menu, X
} from 'lucide-react';

const navItems = [
  { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/exams', label: 'Exams', icon: ClipboardList },
  { href: '/student/profile', label: 'Profile', icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loadFromStorage, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { loadFromStorage(); }, []);

  useEffect(() => {
    if (!isAuthenticated && !localStorage.getItem('token')) {
      router.push('/student/login');
    }
  }, [isAuthenticated, router]);

  if (pathname === '/student/login') return <>{children}</>;

  // Exam page - no sidebar layout
  if (pathname.startsWith('/student/exam/')) return <>{children}</>;

  const handleLogout = () => { logout(); router.push('/student/login'); };

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-dark-800/80 backdrop-blur-xl border-r border-dark-700/50 z-50 transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b border-dark-700/50">
            <Link href="/student/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">DSA Portal</p>
                <p className="text-xs text-dark-500">Student</p>
              </div>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-dark-400"><X className="w-5 h-5" /></button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'text-dark-400 hover:text-white hover:bg-dark-700/50'}`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-dark-700/50">
            <div className="px-4 py-3 rounded-xl bg-dark-700/30 mb-3">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-dark-500 truncate">{user?.regNo} · {user?.className}</p>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50 px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-dark-400 hover:text-white"><Menu className="w-5 h-5" /></button>
            <h1 className="text-lg font-semibold text-white capitalize">{pathname.split('/').pop()?.replace(/-/g, ' ')}</h1>
          </div>
        </header>
        <main className="flex-1 p-6 bg-mesh">{children}</main>
      </div>
    </div>
  );
}
