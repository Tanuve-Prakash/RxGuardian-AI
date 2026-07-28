import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please check your credentials.');
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
          <h1 className="text-xl font-bold text-[#1F2937]">RxGuardian AI Portal</h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Clinical Prescription Verification & Risk Engine
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
            <label className="block text-[#6B7280] font-semibold mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 border border-[#E2E8E8] rounded-md focus:border-[#0F6E6E] focus:outline-none bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-md bg-[#0F6E6E] text-white font-semibold text-xs hover:bg-[#0F6E6E]/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to Portal'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                setEmail('pharmacist@clinic.org');
                setPassword('password123');
                setIsSubmitting(true);
                setError(null);
                try {
                  await login('pharmacist@clinic.org', 'password123');
                  navigate('/dashboard');
                } catch (err) {
                  setError((err as Error).message || 'Demo login failed.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="w-full py-2 rounded-md border border-[#0F6E6E]/30 bg-[#0F6E6E]/5 text-[#0F6E6E] font-semibold text-xs hover:bg-[#0F6E6E]/10 transition-colors flex items-center justify-center gap-1.5"
            >
              Quick Demo Practitioner Sign-In
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E2E8E8] text-center text-xs text-[#6B7280]">
          New practitioner?{' '}
          <Link to="/signup" className="text-[#0F6E6E] font-semibold hover:underline">
            Register clinic account
          </Link>
        </div>

      </div>
    </div>
  );
};
