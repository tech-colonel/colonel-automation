import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const Sidebar = ({ items, isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setIsOpen(false)}
      />
      
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen bg-slate-900 text-slate-50 transition-transform lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'w-64'
        )}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Colonel</h1>
              <button
                onClick={() => setIsOpen(false)}
                className="lg:hidden text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>

          <nav className="flex-1 p-4 space-y-1" data-testid="sidebar-nav">
            {items.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsOpen(false);
                }}
                data-testid={item.testId}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  location.pathname === item.path
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

const DashboardLayout = ({ children, sidebarItems }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar items={sidebarItems} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-600 hover:text-slate-900"
            data-testid="menu-button"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;