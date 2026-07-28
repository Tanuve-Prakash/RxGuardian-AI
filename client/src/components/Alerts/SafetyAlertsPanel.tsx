import React from 'react';
import { SafetyAlert, RxScore, GeminiPrescriptionReview } from '../../types';
import { ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2, Info, FileText, Sparkles, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface SafetyAlertsPanelProps {
  alerts: SafetyAlert[];
  rxscore: RxScore | null;
  assessmentSummary?: {
    drug_interactions_assessed: boolean;
    patient_context_assessed: boolean;
    missing_context_notes: string[];
  };
  geminiReview?: GeminiPrescriptionReview | null;
}

export const SafetyAlertsPanel: React.FC<SafetyAlertsPanelProps> = ({
  alerts,
  rxscore,
  assessmentSummary,
  geminiReview
}) => {
  if (!rxscore) {
    return (
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs">
        <h2 className="text-base font-semibold text-[#1F2937] mb-2">3. Safety Assessment & RxScore</h2>
        <p className="text-xs text-[#6B7280]">Review prescription items in the table above and click "Run Safety Checks" to evaluate clinical risks.</p>
      </div>
    );
  }

  const bandStyles = {
    'Safe': { bg: 'bg-[#1E8A5F]/10', border: 'border-[#1E8A5F]/30', text: 'text-[#1E8A5F]', icon: ShieldCheck },
    'Needs Review': { bg: 'bg-[#C08A1E]/10', border: 'border-[#C08A1E]/30', text: 'text-[#C08A1E]', icon: AlertTriangle },
    'High Risk': { bg: 'bg-[#B23A3A]/10', border: 'border-[#B23A3A]/30', text: 'text-[#B23A3A]', icon: ShieldAlert }
  };

  const style = bandStyles[rxscore.band] || bandStyles['Needs Review'];
  const BandIcon = style.icon;

  const severityBadges = {
    high: 'bg-[#B23A3A]/10 text-[#B23A3A] border-[#B23A3A]/20',
    medium: 'bg-[#C08A1E]/10 text-[#C08A1E] border-[#C08A1E]/20',
    low: 'bg-[#0F6E6E]/10 text-[#0F6E6E] border-[#0F6E6E]/20'
  };

  const geminiRiskStyles = {
    Low: 'bg-[#1E8A5F]/10 text-[#1E8A5F] border-[#1E8A5F]/30',
    Moderate: 'bg-[#C08A1E]/10 text-[#C08A1E] border-[#C08A1E]/30',
    High: 'bg-[#B23A3A]/10 text-[#B23A3A] border-[#B23A3A]/30',
    Critical: 'bg-[#B23A3A]/20 text-[#B23A3A] border-[#B23A3A]/50'
  };

  return (
    <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 space-y-5 shadow-xs">
      
      {/* Header & RxScore Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8E8]">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">3. Safety Assessment & RxScore</h2>
          <p className="text-xs text-[#6B7280]">
            Automated clinical checks across drug interactions, duplications, LASA names, and patient history
          </p>
        </div>

        {/* RxScore Badge */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border}`}>
          <BandIcon className={`w-8 h-8 ${style.text}`} />
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${style.text}`}>{rxscore.score}</span>
              <span className="text-xs font-semibold text-[#6B7280]">/ 100</span>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
              Band: {rxscore.band}
            </span>
          </div>
        </div>
      </div>

      {/* Gemini AI Clinical Prescription Review Section */}
      {geminiReview && (
        <div className="bg-linear-to-br from-[#0F6E6E]/5 to-[#3B5BA5]/5 border border-[#0F6E6E]/20 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#0F6E6E] text-white rounded-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">Gemini AI Clinical Prescription Review</h3>
                <p className="text-[11px] text-[#6B7280]">Evaluated using Google Gemini 3.6 Flash</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${geminiRiskStyles[geminiReview.risk_level] || geminiRiskStyles.Moderate}`}>
              Gemini Risk Level: {geminiReview.risk_level}
            </span>
          </div>

          {/* Clinical Summary */}
          <div className="bg-white/80 backdrop-blur-xs rounded-lg p-3 border border-[#E2E8E8] text-xs leading-relaxed text-[#1F2937]">
            <p className="font-semibold text-[#0F6E6E] mb-1">Clinical Synthesis:</p>
            <p>{geminiReview.clinical_summary}</p>
          </div>

          {/* Medication Evaluations */}
          {geminiReview.medication_evaluations?.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Per-Drug Dosage & Safety Assessment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {geminiReview.medication_evaluations.map((evalItem, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-2.5 border border-[#E2E8E8] text-xs">
                    <span className="font-bold text-[#1F2937] block mb-0.5">{evalItem.medicine_name}</span>
                    <p className="text-[11px] text-[#0F6E6E] mb-1 font-medium">Dosage: {evalItem.dosage_appropriateness}</p>
                    <p className="text-[11px] text-[#6B7280]">{evalItem.warnings_or_cautions}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pharmacist Recommendations */}
          {geminiReview.pharmacist_recommendations?.length > 0 && (
            <div className="bg-white rounded-lg p-3 border border-[#E2E8E8] text-xs space-y-1">
              <span className="font-bold text-[#3B5BA5] block mb-1">Pharmacist Action Recommendations:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[#4B5563]">
                {geminiReview.pharmacist_recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* RxScore Deductions Breakdown */}
      {rxscore.deductions.length > 0 && (
        <div className="bg-[#F7F9FA] border border-[#E2E8E8] rounded-md p-3 text-xs">
          <h4 className="font-bold text-[#1F2937] mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#0F6E6E]" /> RxScore Calculation Deductions
          </h4>
          <ul className="space-y-1 text-[#6B7280]">
            {rxscore.deductions.map((ded, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <span>• {ded.reason}</span>
                <span className="font-semibold text-[#B23A3A]">-{ded.points} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Patient Assessment Notes */}
      {assessmentSummary?.missing_context_notes && assessmentSummary.missing_context_notes.length > 0 && (
        <div className="bg-white border border-[#E2E8E8] rounded-md p-3 text-xs text-[#6B7280] flex items-start gap-2">
          <Info className="w-4 h-4 text-[#3B5BA5] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#1F2937]">Context Notes: </span>
            {assessmentSummary.missing_context_notes.join(' ')}
          </div>
        </div>
      )}

      {/* Safety Alerts List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
          Identified Clinical Alerts ({alerts.length})
        </h3>

        {alerts.length === 0 ? (
          <div className="bg-[#1E8A5F]/5 border border-[#1E8A5F]/20 rounded-md p-4 text-center text-xs text-[#1E8A5F] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">No severe interactions or safety conflicts flagged for these medicines.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-white border border-[#E2E8E8] rounded-md p-3.5 hover:border-[#0F6E6E]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-xs text-[#1F2937] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#C08A1E] shrink-0" />
                    {alert.title}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${severityBadges[alert.severity]}`}>
                    {alert.severity} Severity
                  </span>
                </div>

                <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{alert.description}</p>

                {alert.affected_medicines && alert.affected_medicines.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-medium text-[#6B7280]">Involved drugs:</span>
                    {alert.affected_medicines.map((med, idx) => (
                      <span key={idx} className="bg-[#F7F9FA] border border-[#E2E8E8] text-[#1F2937] text-[10px] px-1.5 py-0.5 rounded">
                        {med}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
