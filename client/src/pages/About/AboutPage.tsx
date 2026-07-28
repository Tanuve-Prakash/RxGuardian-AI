import React from 'react';
import { ShieldAlert, Database, FileSearch, ShieldCheck, CheckCircle2, ArrowUpRight } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#0F6E6E] flex items-center justify-center text-white">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1F2937]">About RxGuardian AI</h1>
            <p className="text-xs text-[#6B7280]">Clinical Decision Support & Prescription Risk Scoring System</p>
          </div>
        </div>
        <p className="text-xs text-[#1F2937] leading-relaxed mt-3">
          RxGuardian AI is a specialized clinical support framework engineered for pharmacists and healthcare providers. It provides automated OCR text extraction from handwritten or printed prescriptions, normalizes line items against NIH RxNorm drug registries, enriches clinical warnings with OpenFDA label databases, and computes a objective clinical risk RxScore.
        </p>
      </div>

      {/* Core Methodology Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* RxNorm */}
        <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-[#0F6E6E]">
            <Database className="w-5 h-5" />
            <h2 className="font-bold text-sm text-[#1F2937]">RxNorm API Resolution</h2>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Every candidate line item extracted via EasyOCR undergoes fuzzy term matching against the National Library of Medicine’s (NLM) RxNorm dataset using <code className="bg-[#F7F9FA] px-1 py-0.5 rounded text-[11px]">approximateTerm.json</code>. Successful resolutions are mapped to unique Concept Unique Identifiers (RxCUI) and cached in SQLite.
          </p>
        </div>

        {/* OpenFDA */}
        <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-[#3B5BA5]">
            <FileSearch className="w-5 h-5" />
            <h2 className="font-bold text-sm text-[#1F2937]">OpenFDA Label Registries</h2>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Verified RxCUIs and drug names are dynamically checked against official FDA Structured Product Labels (<code className="bg-[#F7F9FA] px-1 py-0.5 rounded text-[11px]">api.fda.gov/drug/label.json</code>) to retrieve official boxed warnings, drug interaction contraindications, and organ impairment cautions.
          </p>
        </div>

      </div>

      {/* RxScore Band Definition */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0F6E6E]" /> RxScore Scoring bands
        </h2>
        <p className="text-xs text-[#6B7280]">
          The RxScore ranges from 0 to 100, starting from a baseline score of 100 and deducting points based on identified safety flags, illegibility penalties, and unverified parameters:
        </p>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded border border-[#1E8A5F]/20 bg-[#1E8A5F]/5 flex items-start gap-3">
            <span className="px-2.5 py-1 rounded bg-[#1E8A5F] text-white font-bold text-[11px] shrink-0">80 - 100</span>
            <div>
              <span className="font-bold text-[#1E8A5F] block">Band: Safe (Green)</span>
              <p className="text-[#6B7280] text-[11px] mt-0.5">High confidence OCR extraction, fully mapped RxCUIs, no severe drug-drug interactions or contraindications detected.</p>
            </div>
          </div>

          <div className="p-3 rounded border border-[#C08A1E]/20 bg-[#C08A1E]/5 flex items-start gap-3">
            <span className="px-2.5 py-1 rounded bg-[#C08A1E] text-white font-bold text-[11px] shrink-0">50 - 79</span>
            <div>
              <span className="font-bold text-[#C08A1E] block">Band: Needs Review (Yellow)</span>
              <p className="text-[#6B7280] text-[11px] mt-0.5">Includes missing dosage details, moderate OpenFDA cautions, borderline OCR confidence, or unmapped drug candidates requiring pharmacist review.</p>
            </div>
          </div>

          <div className="p-3 rounded border border-[#B23A3A]/20 bg-[#B23A3A]/5 flex items-start gap-3">
            <span className="px-2.5 py-1 rounded bg-[#B23A3A] text-white font-bold text-[11px] shrink-0">&lt; 50</span>
            <div>
              <span className="font-bold text-[#B23A3A] block">Band: High Risk (Red)</span>
              <p className="text-[#6B7280] text-[11px] mt-0.5">Severe drug-drug interactions identified, duplicate active therapies present, confusable (LASA) drug name pairs, or documented patient allergy conflict.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
