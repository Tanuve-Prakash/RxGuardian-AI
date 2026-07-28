import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  badgeText?: string;
  badgeColor?: 'safe' | 'warning' | 'danger' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  badgeText,
  badgeColor = 'neutral'
}) => {
  const badgeStyles = {
    safe: 'bg-[#1E8A5F]/10 text-[#1E8A5F]',
    warning: 'bg-[#C08A1E]/10 text-[#C08A1E]',
    danger: 'bg-[#B23A3A]/10 text-[#B23A3A]',
    neutral: 'bg-[#F7F9FA] text-[#6B7280]'
  };

  return (
    <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 flex flex-col justify-between shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-[#1F2937] mt-1">{value}</h3>
        </div>
        <div className="w-10 h-10 rounded-md bg-[#F7F9FA] border border-[#E2E8E8] flex items-center justify-center text-[#0F6E6E]">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-[#6B7280]">{description}</span>
        {badgeText && (
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${badgeStyles[badgeColor]}`}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
