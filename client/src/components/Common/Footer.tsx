import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-[#E2E8E8] py-4 text-center text-xs text-[#6B7280]">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© {new Date().getFullYear()} RxGuardian AI — Clinical Decision Support & Safety Analysis Engine</p>
        <p className="text-[11px] text-[#6B7280]">
          Integrated with RxNorm & OpenFDA Label Registries
        </p>
      </div>
    </footer>
  );
};
