import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Lock, Mail, Building2, ArrowRight, AlertCircle } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signup(email, password, clinicName);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Signup failed. Email may already be registered.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg border border-[#E2E8E8] p-8 shadow-xs">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-[#0F6E6E] flex items-center justify-center text-white mb-3 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#1F2937]">Register Clinic Account</h1>
          <p className="text-xs text-[#6B7280] mt-1">
            RxGuardian AI Practitioner Portal Registration
          </p>
        </div>

        {error && (
          <div className="bg-[#B23A3A]/5 border border-[#B23A3A]/20 rounded-md p-3 mb-4 text-xs text-[#B23A3A] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#6B7280] font-semibold mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pharmacist@clinic.org"
                className="w-full pl-9 pr-3 py-2 border border-[#E2E8E8] rounded-md focus:border-[#0F6E6E] focus:outline-none bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#6B7280] font-semibold mb-1">Clinic / Hospital Name</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="St. Jude Pharmacy & Health"
                className="w-full pl-9 pr-3 py-2 border border-[#E2E8E8] rounded-md focus:border-[#0F6E6E] focus:outline-none bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#6B7280] font-semibold mb-1">Password (min 6 characters)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 border border-[#E2E8E8] rounded-md focus:border-[#0F6E6E] focus:outline-none bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-md bg-[#0F6E6E] text-white font-semibold text-xs hover:bg-[#0F6E6E]/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Registering...' : 'Create Account'}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E2E8E8] text-center text-xs text-[#6B7280]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#0F6E6E] font-semibold hover:underline">
            Sign in
          </Link>
        </div>

      </div>
    </div>
  );
};
