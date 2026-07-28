import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, PlusCircle, History, Info, LayoutDashboard, LogOut, Building2, QrCode } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'New Analysis', path: '/new-analysis', icon: PlusCircle },
    { label: 'Patient Passports', path: '/patients', icon: QrCode },
    { label: 'History', path: '/history', icon: History },
    { label: 'About', path: '/about', icon: Info },
  ];

  return (
    <header className="bg-white border-b border-[#E2E8E8] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand logo */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-md bg-[#0F6E6E] flex items-center justify-center text-white shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-[#1F2937] tracking-tight leading-none group-hover:text-[#0F6E6E] transition-colors">
              RxGuardian<span className="text-[#0F6E6E] ml-0.5">AI</span>
            </span>
            <span className="text-[10px] text-[#6B7280] font-medium tracking-wide leading-tight">
              Clinical Safety Engine
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0F6E6E]/10 text-[#0F6E6E]'
                    : 'text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F7F9FA]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#F7F9FA] border border-[#E2E8E8] text-xs text-[#1F2937]">
            <Building2 className="w-3.5 h-3.5 text-[#0F6E6E]" />
            <span className="font-medium truncate max-w-[140px]">{user.clinic_name || 'Clinic'}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#6B7280] hover:text-[#B23A3A] hover:bg-[#B23A3A]/5 transition-colors"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
};
