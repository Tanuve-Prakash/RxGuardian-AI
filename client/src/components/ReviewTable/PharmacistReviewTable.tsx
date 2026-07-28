import React, { useState, useEffect } from 'react';
import { MedicineCandidate, RxNormCandidateSuggestion, EscalationRole } from '../../types';

const getEscalationRoleLabel = (role?: EscalationRole | null): string => {
  switch (role) {
    case 'senior_pharmacist': return 'Senior Pharmacist';
    case 'hospital_pharmacist': return 'Hospital Pharmacist';
    case 'specialist': return 'Medical Specialist';
    case 'doctor': return 'Consulting Doctor';
    default: return 'Senior Pharmacist';
  }
};
import {
  Trash2,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  Search,
  Info,
  PhoneCall,
  Users,
  Bot,
  Lock,
  CheckCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Package,
  RefreshCw,
  Sliders,
  ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { explainUncertaintyApi } from '../../services/analysis';
import { useAuth } from '../../context/AuthContext';
import {
  fetchInventoryApi,
  updateInventoryApi,
  checkStockApi,
  StockCheckResult,
  InventoryItem
} from '../../services/inventory';


interface PharmacistReviewTableProps {
  medicines: MedicineCandidate[];
  onUpdateMedicines: (updated: MedicineCandidate[]) => void;
  patientContext?: any;
}

export const PharmacistReviewTable: React.FC<PharmacistReviewTableProps> = ({
  medicines,
  onUpdateMedicines,
  patientContext
}) => {
  const { user } = useAuth();
  const currentPharmacistName = user?.email ? user.email.split('@')[0] : 'Pharmacist';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Active route tab for each unresolved row ('doctor' | 'pharmacist' | 'ai')
  const [activeRouteTab, setActiveRouteTab] = useState<Record<string, 'doctor' | 'pharmacist' | 'ai'>>({});

  // AI analysis state per row
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, any>>({});

  // Doctor contact form state per row
  const [doctorForms, setDoctorForms] = useState<Record<string, {
    doctorName: string;
    doctorPhone: string;
    selectedName: string;
    confirmedStrength: string;
    confirmedDosage: string;
    notes: string;
  }>>({});

  // Peer review form state per row
  const [peerForms, setPeerForms] = useState<Record<string, {
    reviewerName: string;
    selectedName: string;
    notes: string;
  }>>({});

  // Selected escalation role per row ('senior_pharmacist' | 'hospital_pharmacist' | 'specialist' | 'doctor')
  const [selectedRoles, setSelectedRoles] = useState<Record<string, EscalationRole>>({});

  // AI confirm form state per row
  const [aiForms, setAiForms] = useState<Record<string, {
    selectedName: string;
    notes: string;
  }>>({});

  // Peer review queue view modal / drawer toggle
  const [showPeerQueueModal, setShowPeerQueueModal] = useState<boolean>(false);

  // Manual drug search fields
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Manual new medicine input fields
  const [newMedName, setNewMedName] = useState<string>('');
  const [newRxcui, setNewRxcui] = useState<string | null>(null);
  const [newStrength, setNewStrength] = useState<string>('');
  const [newDosage, setNewDosage] = useState<string>('');
  const [newFrequency, setNewFrequency] = useState<string>('');
  const [newRoute, setNewRoute] = useState<string>('');
  const [newDuration, setNewDuration] = useState<string>('');

  const handleFieldChange = (id: string, field: keyof MedicineCandidate, value: any) => {
    const updated = medicines.map((med) => {
      if (med.id === id) {
        return {
          ...med,
          [field]: value === '' ? null : value
        };
      }
      return med;
    });
    onUpdateMedicines(updated);
  };

  const handleDeleteRow = (id: string) => {
    const updated = medicines.filter((m) => m.id !== id);
    onUpdateMedicines(updated);
  };

  // Helper to fetch RxCUI for a name
  const fetchRxcuiForTerm = async (term: string): Promise<string | null> => {
    try {
      const res = await api.get('https://rxnav.nlm.nih.gov/REST/approximateTerm.json', {
        params: { term, maxEntries: 1 }
      });
      const cand = res.data?.approximateGroup?.candidate?.[0];
      return cand?.rxcui ? String(cand.rxcui) : null;
    } catch (_) {
      return null;
    }
  };

  // 1. Doctor Confirmation Action
  const handleDoctorConfirm = async (med: MedicineCandidate) => {
    const form = doctorForms[med.id] || {
      doctorName: 'Dr. On File',
      doctorPhone: '555-0199',
      selectedName: med.best_guess_name || med.name,
      confirmedStrength: med.strength || '',
      confirmedDosage: med.dosage || '',
      notes: ''
    };

    const chosenName = form.selectedName.trim() || med.name;
    const rxcui = await fetchRxcuiForTerm(chosenName) || med.rxcui;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

    const updated = medicines.map((m) => {
      if (m.id === med.id) {
        return {
          ...m,
          name: chosenName,
          rxcui,
          strength: form.confirmedStrength.trim() || m.strength,
          dosage: form.confirmedDosage.trim() || m.dosage,
          verification_status: 'confirmed' as const,
          verification_method: 'doctor_contact' as const,
          verified_by: `${form.doctorName.trim() || 'Dr. On File'} (Logged by ${currentPharmacistName})`,
          verification_notes: form.notes.trim() || 'Phone verification completed with prescribing clinician.',
          verified_at: nowStr,
          is_confirmed: true,
          needs_review: false,
          confidence: 100
        };
      }
      return m;
    });
    onUpdateMedicines(updated);
  };

  // 2. Peer Review Queue Routing Action
  const handleRouteToPeerQueue = (med: MedicineCandidate) => {
    const targetRole = selectedRoles[med.id] || 'senior_pharmacist';
    const updated = medicines.map((m) => {
      if (m.id === med.id) {
        return {
          ...m,
          verification_status: 'in_progress' as const,
          verification_method: 'pharmacist_network' as const,
          escalation_role: targetRole
        };
      }
      return m;
    });
    onUpdateMedicines(updated);
  };

  // 2b. Peer Review Approval Action
  const handlePeerConfirm = async (med: MedicineCandidate) => {
    const form = peerForms[med.id] || {
      reviewerName: currentPharmacistName,
      selectedName: med.best_guess_name || med.name,
      notes: ''
    };

    const chosenName = form.selectedName.trim() || med.name;
    const rxcui = await fetchRxcuiForTerm(chosenName) || med.rxcui;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    const targetRole = med.escalation_role || selectedRoles[med.id] || 'senior_pharmacist';
    const roleLabel = getEscalationRoleLabel(targetRole);

    const updated = medicines.map((m) => {
      if (m.id === med.id) {
        return {
          ...m,
          name: chosenName,
          rxcui,
          verification_status: 'confirmed' as const,
          verification_method: 'pharmacist_network' as const,
          escalation_role: targetRole,
          verified_by: `${roleLabel} (${form.reviewerName.trim() || currentPharmacistName})`,
          verification_notes: form.notes.trim() || `Verified via internal queue for ${roleLabel} review.`,
          verified_at: nowStr,
          is_confirmed: true,
          needs_review: false,
          confidence: 100
        };
      }
      return m;
    });
    onUpdateMedicines(updated);
  };

  // 3. AI Assistant Trigger Action
  const handleRunAIAnalysis = async (med: MedicineCandidate) => {
    setAiLoading((prev) => ({ ...prev, [med.id]: true }));
    try {
      const res = await explainUncertaintyApi(
        med.raw_text || med.original_line,
        med.rxnorm_suggestions || [],
        patientContext,
        med.best_guess_name
      );
      if (res && res.explanation) {
        setAiAnalysis((prev) => ({ ...prev, [med.id]: res.explanation }));
        if (res.explanation.most_plausible_candidate) {
          setAiForms((prev) => ({
            ...prev,
            [med.id]: {
              selectedName: res.explanation.most_plausible_candidate!,
              notes: ''
            }
          }));
        }
      }
    } catch (err) {
      console.error('Failed to run AI uncertainty analysis:', err);
    } finally {
      setAiLoading((prev) => ({ ...prev, [med.id]: false }));
    }
  };

  // 3b. AI Assistant Pharmacist Confirmation Action
  const handleAIPharmacistConfirm = async (med: MedicineCandidate) => {
    const form = aiForms[med.id] || {
      selectedName: med.best_guess_name || med.name,
      notes: ''
    };

    const chosenName = form.selectedName.trim() || med.name;
    const rxcui = await fetchRxcuiForTerm(chosenName) || med.rxcui;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

    const analysisObj = aiAnalysis[med.id];
    const aiSummary = analysisObj?.explanation ? `AI Explanation: ${analysisObj.explanation}` : 'Reviewed with AI Clinical Assistant guidance.';

    const updated = medicines.map((m) => {
      if (m.id === med.id) {
        return {
          ...m,
          name: chosenName,
          rxcui,
          verification_status: 'confirmed' as const,
          verification_method: 'ai_assistant' as const,
          verified_by: `Pharmacist ${currentPharmacistName}`,
          verification_notes: `${aiSummary} | Pharmacist Note: ${form.notes.trim() || 'Confirmed after reviewing clinical explanation.'}`,
          verified_at: nowStr,
          is_confirmed: true,
          needs_review: false,
          confidence: 100
        };
      }
      return m;
    });
    onUpdateMedicines(updated);
  };

  // Dispense Action Handler
  const handleDispense = (medId: string) => {
    const updated = medicines.map((m) => {
      if (m.id === medId) {
        const canDispense = m.verification_status === 'confirmed' || m.verification_status === 'not_required' || m.confidence >= 95 || m.is_confirmed;
        if (!canDispense) return m;
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
        return {
          ...m,
          is_dispensed: true,
          dispensed_at: nowStr,
          dispensed_by: currentPharmacistName
        };
      }
      return m;
    });
    onUpdateMedicines(updated);
  };

  const handleRxNormSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.get('https://rxnav.nlm.nih.gov/REST/approximateTerm.json', {
        params: { term: query, maxEntries: 5 }
      });
      const candidates = response.data?.approximateGroup?.candidate || [];
      setSearchResults(candidates);
    } catch (_) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (candidate: any) => {
    setNewMedName(candidate.name);
    setNewRxcui(candidate.rxcui);
    setSearchResults([]);
  };

  const handleAddManualMedicine = () => {
    if (!newMedName.trim()) return;

    const newMed: MedicineCandidate = {
      id: `manual-${Date.now()}`,
      original_line: 'Pharmacist Manual Addition',
      name: newMedName.trim(),
      rxcui: newRxcui,
      strength: newStrength.trim() ? newStrength.trim() : null,
      dosage: newDosage.trim() ? newDosage.trim() : null,
      frequency: newFrequency.trim() ? newFrequency.trim() : null,
      route: newRoute.trim() ? newRoute.trim() : null,
      duration: newDuration.trim() ? newDuration.trim() : null,
      confidence: 100,
      needs_review: false,
      is_confirmed: true,
      verification_status: 'not_required',
      verification_method: null,
      verified_by: currentPharmacistName,
      verified_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
      alternatives: []
    };

    onUpdateMedicines([...medicines, newMed]);

    setNewMedName('');
    setNewRxcui(null);
    setNewStrength('');
    setNewDosage('');
    setNewFrequency('');
    setNewRoute('');
    setNewDuration('');
    setShowAddModal(false);
  };

  const inProgressPeerCount = medicines.filter((m) => m.verification_status === 'in_progress').length;

  return (
    <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8E8] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937] flex items-center gap-2">
            2. Pharmacist Review & Verification Table
            {inProgressPeerCount > 0 && (
              <span className="inline-flex items-center gap-1 bg-[#C08A1E]/10 text-[#C08A1E] text-xs px-2.5 py-0.5 rounded-full font-bold border border-[#C08A1E]/20">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                {inProgressPeerCount} in Peer Review Queue
              </span>
            )}
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Low-confidence medicines (&lt;95%) require explicit verification routing before dispensing is unlocked.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {inProgressPeerCount > 0 && (
            <button
              onClick={() => setShowPeerQueueModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#C08A1E]/30 bg-[#C08A1E]/5 text-[#92400E] text-xs font-semibold hover:bg-[#C08A1E]/10 transition-colors"
            >
              <Users className="w-3.5 h-3.5" /> Peer Review Queue ({inProgressPeerCount})
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#0F6E6E] text-white text-xs font-semibold hover:bg-[#0F6E6E]/90 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add Medicine
          </button>
        </div>
      </div>

      {medicines.length === 0 ? (
        <div className="border-2 border-dashed border-[#E2E8E8] rounded-lg p-10 text-center bg-[#F7F9FA]">
          <Info className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#1F2937]">Upload a prescription to begin</p>
          <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
            Extract text from an image above to populate verified medicine line items, or click "Add Medicine" to enter manually.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#E2E8E8] rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F7F9FA] border-b border-[#E2E8E8] text-[#6B7280] font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Medicine / RxNorm Name</th>
                <th className="py-3 px-3">Strength</th>
                <th className="py-3 px-3">Dosage / Form</th>
                <th className="py-3 px-3">Frequency</th>
                <th className="py-3 px-3">Route</th>
                <th className="py-3 px-3">Confidence</th>
                <th className="py-3 px-3">Verification Gate</th>
                <th className="py-3 px-3 text-right">Dispense & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8E8]">
              {medicines.map((med) => {
                const isUnresolved = (med.confidence < 95 && med.verification_status !== 'confirmed' && med.verification_status !== 'not_required' && !med.is_confirmed);
                const isEditing = editingId === med.id;
                const activeTab = activeRouteTab[med.id] || 'doctor';

                // ==========================================
                // UNRESOLVED LOW-CONFIDENCE ROW (GATE ACTIVE)
                // ==========================================
                if (isUnresolved) {
                  return (
                    <tr key={med.id} className="bg-[#FFFBEB] border-l-4 border-l-[#D97706] border-y border-r border-[#FCD34D]">
                      <td colSpan={8} className="p-4">
                        <div className="flex flex-col gap-3">

                          {/* Top Warning Banner & Dispense Gate Status */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FEF3C7] p-2.5 rounded-md border border-[#FCD34D]">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#D97706] text-white font-bold text-xs shadow-2xs">
                                <AlertTriangle className="w-4 h-4" /> Unresolved Line ({med.confidence}%)
                              </span>
                              <span className="text-xs text-[#78350F] font-bold flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-[#B23A3A]" />
                                DISPENSING BLOCKED — Select a verification route below
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {med.verification_status === 'in_progress' && (
                                <span className="bg-[#C08A1E] text-white font-bold px-2 py-0.5 rounded text-[10px]">
                                  In Peer Review Queue
                                </span>
                              )}
                              <button
                                onClick={() => handleDeleteRow(med.id)}
                                className="p-1 rounded text-[#92400E] hover:bg-[#FCD34D]/50 transition-colors"
                                title="Discard row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Raw OCR Read & Candidate Summary */}
                          <div className="bg-white p-3 rounded-md border border-[#FCD34D] flex flex-col gap-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block">Raw OCR / Prescription Read:</span>
                                <span className="text-sm font-bold text-[#1F2937] font-mono">"{med.raw_text || med.original_line}"</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded border border-[#FCD34D]">
                                  RxCUI: Unconfirmed
                                </span>
                              </div>
                            </div>

                            {/* Candidate Suggestion Chips */}
                            <div className="pt-2 border-t border-[#FEF3C7] flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider mr-1">Candidates:</span>
                              <span className="px-2 py-0.5 rounded bg-[#0F6E6E]/10 text-[#0F6E6E] font-bold border border-[#0F6E6E]/20">
                                Primary: {med.best_guess_name || med.name}
                              </span>
                              {med.rxnorm_suggestions?.slice(0, 3).map((sugg, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-[#F3F4F6] text-[#374151] font-semibold border border-[#E5E7EB]">
                                  RxNorm ({sugg.score}%): {sugg.name}
                                </span>
                              ))}
                              {med.alt_guess_1 && (
                                <span className="px-2 py-0.5 rounded bg-[#FFFBEB] text-[#92400E] font-medium border border-[#FCD34D]">
                                  Alt 1: {med.alt_guess_1}
                                </span>
                              )}
                              {med.alt_guess_2 && (
                                <span className="px-2 py-0.5 rounded bg-[#FFFBEB] text-[#92400E] font-medium border border-[#FCD34D]">
                                  Alt 2: {med.alt_guess_2}
                                </span>
                              )}
                            </div>

                            {/* Consensus Reasoning when passes disagree */}
                            {med.consensus_agreement === false && (
                              <div className="mt-1 bg-[#FEF2F2] border border-[#FCA5A5] p-2.5 rounded text-xs text-[#991B1B] flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-[11px] uppercase tracking-wider block text-[#B91C1C]">AI Consensus Disagreement:</span>
                                  <span>{med.consensus_reasoning || "Standard extraction and strict audit passes yielded conflicting interpretations for this line."}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* CHOOSE VERIFICATION ROUTE PANEL */}
                          <div className="bg-white rounded-md border border-[#E2E8E8] shadow-2xs overflow-hidden">
                            <div className="bg-[#F7F9FA] px-3.5 py-2 border-b border-[#E2E8E8] flex items-center justify-between">
                              <span className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-[#0F6E6E]" /> Choose Verification Route
                              </span>
                              <span className="text-[11px] text-[#6B7280]">
                                Complete one route to confirm identity and unlock dispensing
                              </span>
                            </div>

                            {/* Route Navigation Tabs */}
                            <div className="grid grid-cols-3 border-b border-[#E2E8E8] text-xs font-semibold">
                              <button
                                onClick={() => setActiveRouteTab((prev) => ({ ...prev, [med.id]: 'doctor' }))}
                                className={`py-2.5 px-3 flex items-center justify-center gap-2 border-r border-[#E2E8E8] transition-colors ${
                                  activeTab === 'doctor'
                                    ? 'bg-[#0F6E6E] text-white'
                                    : 'bg-white text-[#4B5563] hover:bg-[#F7F9FA]'
                                }`}
                              >
                                <PhoneCall className="w-3.5 h-3.5" /> 1. Prescribing Doctor
                              </button>

                              <button
                                onClick={() => setActiveRouteTab((prev) => ({ ...prev, [med.id]: 'pharmacist' }))}
                                className={`py-2.5 px-3 flex items-center justify-center gap-2 border-r border-[#E2E8E8] transition-colors ${
                                  activeTab === 'pharmacist'
                                    ? 'bg-[#0F6E6E] text-white'
                                    : 'bg-white text-[#4B5563] hover:bg-[#F7F9FA]'
                                }`}
                              >
                                <Users className="w-3.5 h-3.5" /> 2. Pharmacist Queue
                              </button>

                              <button
                                onClick={() => setActiveRouteTab((prev) => ({ ...prev, [med.id]: 'ai' }))}
                                className={`py-2.5 px-3 flex items-center justify-center gap-2 transition-colors ${
                                  activeTab === 'ai'
                                    ? 'bg-[#0F6E6E] text-white'
                                    : 'bg-white text-[#4B5563] hover:bg-[#F7F9FA]'
                                }`}
                              >
                                <Bot className="w-3.5 h-3.5" /> 3. AI Assistant
                              </button>
                            </div>

                            {/* ROUTE TAB CONTENT */}
                            <div className="p-4 bg-[#FAFAFA]">

                              {/* TAB 1: PRESCRIBING DOCTOR CONTACT */}
                              {activeTab === 'doctor' && (
                                <div className="space-y-3 text-xs">
                                  <div className="bg-[#E6F4EA] border border-[#1E8A5F]/20 text-[#1E8A5F] p-2.5 rounded text-[11px] font-medium flex items-center gap-2">
                                    <PhoneCall className="w-4 h-4 shrink-0" />
                                    <span>Log a direct phone confirmation with the prescribing doctor/clinic to resolve handwritten ambiguity.</span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[#4B5563] font-semibold mb-1">Prescribing Doctor Name</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. Dr. A. Mehta"
                                        defaultValue={doctorForms[med.id]?.doctorName || 'Dr. On File'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setDoctorForms((prev) => ({
                                            ...prev,
                                            [med.id]: { ...(prev[med.id] || { doctorName: 'Dr. On File', doctorPhone: '555-0199', selectedName: med.best_guess_name || med.name, confirmedStrength: med.strength || '', confirmedDosage: med.dosage || '', notes: '' }), doctorName: val }
                                          }));
                                        }}
                                        className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded bg-white"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[#4B5563] font-semibold mb-1">Select / Confirm Drug Name</label>
                                      <select
                                        defaultValue={med.best_guess_name || med.name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setDoctorForms((prev) => ({
                                            ...prev,
                                            [med.id]: { ...(prev[med.id] || { doctorName: 'Dr. On File', doctorPhone: '555-0199', selectedName: med.best_guess_name || med.name, confirmedStrength: med.strength || '', confirmedDosage: med.dosage || '', notes: '' }), selectedName: val }
                                          }));
                                        }}
                                        className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded bg-white font-semibold text-[#1F2937]"
                                      >
                                        <option value={med.best_guess_name || med.name}>Gemini Guess: {med.best_guess_name || med.name}</option>
                                        {med.rxnorm_suggestions?.map((s, idx) => (
                                          <option key={idx} value={s.name}>RxNorm ({s.score}%): {s.name}</option>
                                        ))}
                                        {med.alt_guess_1 && <option value={med.alt_guess_1}>Alt Guess 1: {med.alt_guess_1}</option>}
                                        {med.alt_guess_2 && <option value={med.alt_guess_2}>Alt Guess 2: {med.alt_guess_2}</option>}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[#4B5563] font-semibold mb-1">Confirmed Strength</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 262mg"
                                        defaultValue={med.strength || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setDoctorForms((prev) => ({
                                            ...prev,
                                            [med.id]: { ...(prev[med.id] || { doctorName: 'Dr. On File', doctorPhone: '555-0199', selectedName: med.best_guess_name || med.name, confirmedStrength: med.strength || '', confirmedDosage: med.dosage || '', notes: '' }), confirmedStrength: val }
                                          }));
                                        }}
                                        className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded bg-white"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[#4B5563] font-semibold mb-1">Confirmed Dosage Form</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 2 Chewable Tablets"
                                        defaultValue={med.dosage || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setDoctorForms((prev) => ({
                                            ...prev,
                                            [med.id]: { ...(prev[med.id] || { doctorName: 'Dr. On File', doctorPhone: '555-0199', selectedName: med.best_guess_name || med.name, confirmedStrength: med.strength || '', confirmedDosage: med.dosage || '', notes: '' }), confirmedDosage: val }
                                          }));
                                        }}
                                        className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded bg-white"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[#4B5563] font-semibold mb-1">Call Notes / Verification Reason</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Dr. Mehta confirmed Bismuth Subsalicylate 262mg tabs for acute GI distress."
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setDoctorForms((prev) => ({
                                          ...prev,
                                          [med.id]: { ...(prev[med.id] || { doctorName: 'Dr. On File', doctorPhone: '555-0199', selectedName: med.best_guess_name || med.name, confirmedStrength: med.strength || '', confirmedDosage: med.dosage || '', notes: '' }), notes: val }
                                        }));
                                      }}
                                      className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded bg-white"
                                    />
                                  </div>

                                  <div className="pt-2 flex justify-end">
                                    <button
                                      onClick={() => handleDoctorConfirm(med)}
                                      className="px-4 py-2 rounded bg-[#0F6E6E] text-white font-bold hover:bg-[#0F6E6E]/90 transition-colors flex items-center gap-1.5 shadow-xs"
                                    >
                                      <PhoneCall className="w-4 h-4" /> Log Doctor Confirmation & Confirm Drug
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* TAB 2: EXPERT PHARMACIST QUEUE */}
                              {activeTab === 'pharmacist' && (
                                <div className="space-y-3 text-xs">
                                  <div className="bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] p-2.5 rounded text-[11px] font-medium flex items-center gap-2">
                                    <Users className="w-4 h-4 shrink-0 text-[#D97706]" />
                                    <span>Routes line item to the internal RxGuardian Escalation Queue for secondary verification.</span>
                                  </div>

                                  {med.verification_status !== 'in_progress' ? (
                                    <div className="space-y-3 bg-white p-3.5 border border-[#E5E7EB] rounded">
                                      <div>
                                        <label className="block text-xs font-bold text-[#1F2937] mb-1">
                                          Select Escalation Target Role:
                                        </label>
                                        <p className="text-[11px] text-[#6B7280] mb-2">
                                          Routes to the next available team member with the selected qualification on this account.
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {[
                                            { role: 'senior_pharmacist' as const, label: 'Senior Pharmacist', icon: '🛡️' },
                                            { role: 'hospital_pharmacist' as const, label: 'Hospital Pharmacist', icon: '🏥' },
                                            { role: 'specialist' as const, label: 'Medical Specialist', icon: '⚕️' },
                                            { role: 'doctor' as const, label: 'Consulting Doctor', icon: '🩺' }
                                          ].map((item) => {
                                            const currentRole = selectedRoles[med.id] || 'senior_pharmacist';
                                            const isSelected = currentRole === item.role;
                                            return (
                                              <button
                                                key={item.role}
                                                type="button"
                                                onClick={() => setSelectedRoles((prev) => ({ ...prev, [med.id]: item.role }))}
                                                className={`p-2 rounded border text-left flex flex-col items-start gap-0.5 transition-all ${
                                                  isSelected
                                                    ? 'border-[#0F6E6E] bg-[#0F6E6E]/5 text-[#0F6E6E] font-bold shadow-xs'
                                                    : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:border-[#D1D5DB]'
                                                }`}
                                              >
                                                <span className="text-xs font-semibold">{item.icon} {item.label}</span>
                                                <span className="text-[10px] text-[#6B7280] font-normal">Internal Queue</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div className="pt-2 flex items-center justify-between border-t border-[#F3F4F6]">
                                        <span className="text-[11px] text-[#4B5563]">
                                          Selected Target: <strong className="text-[#0F6E6E]">{getEscalationRoleLabel(selectedRoles[med.id] || 'senior_pharmacist')}</strong>
                                        </span>
                                        <button
                                          onClick={() => handleRouteToPeerQueue(med)}
                                          className="px-4 py-2 rounded bg-[#D97706] text-white font-bold hover:bg-[#B45309] transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
                                        >
                                          <Users className="w-4 h-4" /> Route to {getEscalationRoleLabel(selectedRoles[med.id] || 'senior_pharmacist')} Queue
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-3 bg-white p-3 border border-[#C08A1E]/30 rounded">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FEF3C7] p-2 rounded border border-[#FCD34D]">
                                        <div className="flex items-center gap-2 text-[#92400E] font-bold">
                                          <Clock className="w-4 h-4 animate-spin text-[#D97706]" />
                                          <span>Item Currently in Escalation Queue</span>
                                        </div>
                                        <span className="text-xs font-bold text-[#0F6E6E] bg-white px-2 py-0.5 rounded border border-[#0F6E6E]/20">
                                          Target Role: {getEscalationRoleLabel(med.escalation_role)}
                                        </span>
                                      </div>

                                      <p className="text-[11px] text-[#4B5563]">
                                        Routes to the next available <strong>{getEscalationRoleLabel(med.escalation_role)}</strong> on this account. Select and confirm the verified drug name below to resolve.
                                      </p>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[#4B5563] font-semibold mb-1">Reviewing Staff Name</label>
                                          <input
                                            type="text"
                                            defaultValue={currentPharmacistName}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setPeerForms((prev) => ({
                                                ...prev,
                                                [med.id]: { ...(prev[med.id] || { reviewerName: currentPharmacistName, selectedName: med.best_guess_name || med.name, notes: '' }), reviewerName: val }
                                              }));
                                            }}
                                            className="w-full px-2 py-1 border border-[#D1D5DB] rounded bg-white"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[#4B5563] font-semibold mb-1">Select / Confirm Drug Name</label>
                                          <select
                                            defaultValue={med.best_guess_name || med.name}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setPeerForms((prev) => ({
                                                ...prev,
                                                [med.id]: { ...(prev[med.id] || { reviewerName: currentPharmacistName, selectedName: med.best_guess_name || med.name, notes: '' }), selectedName: val }
                                              }));
                                            }}
                                            className="w-full px-2 py-1 border border-[#D1D5DB] rounded bg-white font-semibold text-[#1F2937]"
                                          >
                                            <option value={med.best_guess_name || med.name}>{med.best_guess_name || med.name}</option>
                                            {med.rxnorm_suggestions?.map((s, idx) => (
                                              <option key={idx} value={s.name}>{s.name} ({s.score}%)</option>
                                            ))}
                                            {med.alt_guess_1 && <option value={med.alt_guess_1}>Alt 1: {med.alt_guess_1}</option>}
                                            {med.alt_guess_2 && <option value={med.alt_guess_2}>Alt 2: {med.alt_guess_2}</option>}
                                          </select>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[#4B5563] font-semibold mb-1">Escalation Review Notes</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. Cross-checked with clinic records & verified formulation."
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setPeerForms((prev) => ({
                                              ...prev,
                                              [med.id]: { ...(prev[med.id] || { reviewerName: currentPharmacistName, selectedName: med.best_guess_name || med.name, notes: '' }), notes: val }
                                            }));
                                          }}
                                          className="w-full px-2 py-1 border border-[#D1D5DB] rounded bg-white"
                                        />
                                      </div>

                                      <div className="pt-1 flex justify-end">
                                        <button
                                          onClick={() => handlePeerConfirm(med)}
                                          className="px-4 py-2 rounded bg-[#0F6E6E] text-white font-bold hover:bg-[#0F6E6E]/90 transition-colors flex items-center gap-1.5 shadow-xs"
                                        >
                                          <Check className="w-4 h-4" /> Confirm Drug as {getEscalationRoleLabel(med.escalation_role)}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* TAB 3: AI CLINICAL ASSISTANT */}
                              {activeTab === 'ai' && (
                                <div className="space-y-3 text-xs">
                                  <div className="bg-[#F0FDF4] border border-[#1E8A5F]/20 text-[#1E8A5F] p-2.5 rounded text-[11px] font-medium flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Bot className="w-4 h-4 shrink-0 text-[#0F6E6E]" />
                                      <span>Gemini AI Clinical Assistant evaluates handwriting/OCR ambiguity and explains clinical differences.</span>
                                    </div>
                                    <button
                                      onClick={() => handleRunAIAnalysis(med)}
                                      disabled={aiLoading[med.id]}
                                      className="px-3 py-1 rounded bg-[#0F6E6E] text-white font-bold text-[11px] hover:bg-[#0F6E6E]/90 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
                                    >
                                      <Sparkles className={`w-3.5 h-3.5 ${aiLoading[med.id] ? 'animate-spin' : ''}`} />
                                      {aiAnalysis[med.id] ? 'Re-run AI Analysis' : 'Run AI Analysis'}
                                    </button>
                                  </div>

                                  {/* AI Output Card */}
                                  {aiAnalysis[med.id] && (
                                    <div className="space-y-2 bg-white p-3 border border-[#0F6E6E]/30 rounded-md">
                                      
                                      <div className="bg-[#0F6E6E]/5 border-l-4 border-l-[#0F6E6E] p-2.5 rounded text-xs text-[#1F2937]">
                                        <span className="font-bold text-[#0F6E6E] block mb-1">Uncertainty Analysis:</span>
                                        {aiAnalysis[med.id].explanation}
                                      </div>

                                      {aiAnalysis[med.id].clinical_concerns?.length > 0 && (
                                        <div>
                                          <span className="font-bold text-[#1F2937] block text-[11px] mb-1">Clinical Cautions & Differences:</span>
                                          <ul className="list-disc pl-4 space-y-0.5 text-[#4B5563] text-[11px]">
                                            {aiAnalysis[med.id].clinical_concerns.map((c: string, idx: number) => (
                                              <li key={idx}>{c}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {aiAnalysis[med.id].most_plausible_candidate && (
                                        <div className="bg-[#F7F9FA] p-2 rounded border border-[#E2E8E8] text-[11px]">
                                          <span className="font-bold text-[#0F6E6E]">Top AI Plausible Match: </span>
                                          <span className="font-bold text-[#1F2937]">{aiAnalysis[med.id].most_plausible_candidate}</span>
                                          <p className="text-[#6B7280] mt-0.5">{aiAnalysis[med.id].plausibility_reasoning}</p>
                                        </div>
                                      )}

                                      {/* MANDATORY PROMINENT DISCLAIMER BANNER */}
                                      <div className="bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] p-2.5 rounded font-bold text-[11px] flex items-center gap-2">
                                        <Info className="w-4 h-4 shrink-0 text-[#D97706]" />
                                        <span>AI Assistant provides clinical analysis ONLY and cannot self-confirm. A human pharmacist must confirm below.</span>
                                      </div>

                                      {/* Pharmacist Confirmation Controls */}
                                      <div className="pt-2 border-t border-[#E2E8E8] space-y-2">
                                        <div>
                                          <label className="block text-[#4B5563] font-semibold mb-1">Pharmacist Confirmed Drug Name</label>
                                          <select
                                            defaultValue={aiAnalysis[med.id]?.most_plausible_candidate || med.best_guess_name || med.name}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setAiForms((prev) => ({
                                                ...prev,
                                                [med.id]: { ...(prev[med.id] || { selectedName: val, notes: '' }), selectedName: val }
                                              }));
                                            }}
                                            className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded bg-white font-bold text-[#1F2937]"
                                          >
                                            {aiAnalysis[med.id]?.most_plausible_candidate && (
                                              <option value={aiAnalysis[med.id].most_plausible_candidate}>
                                                AI Plausible: {aiAnalysis[med.id].most_plausible_candidate}
                                              </option>
                                            )}
                                            <option value={med.best_guess_name || med.name}>Gemini Guess: {med.best_guess_name || med.name}</option>
                                            {med.rxnorm_suggestions?.map((s, idx) => (
                                              <option key={idx} value={s.name}>RxNorm: {s.name} ({s.score}%)</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="block text-[#4B5563] font-semibold mb-1">Pharmacist Review Note</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Reviewed AI analysis and confirmed drug formulation."
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setAiForms((prev) => ({
                                                ...prev,
                                                [med.id]: { ...(prev[med.id] || { selectedName: aiAnalysis[med.id]?.most_plausible_candidate || med.name, notes: '' }), notes: val }
                                              }));
                                            }}
                                            className="w-full px-2 py-1 border border-[#D1D5DB] rounded bg-white"
                                          />
                                        </div>

                                        <div className="pt-1 flex justify-end">
                                          <button
                                            onClick={() => handleAIPharmacistConfirm(med)}
                                            className="px-4 py-2 rounded bg-[#0F6E6E] text-white font-bold hover:bg-[#0F6E6E]/90 transition-colors flex items-center gap-1.5 shadow-xs"
                                          >
                                            <Check className="w-4 h-4" /> Human Pharmacist Confirm & Unlock
                                          </button>
                                        </div>
                                      </div>

                                    </div>
                                  )}

                                </div>
                              )}

                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  );
                }

                // ==========================================
                // NORMAL / CONFIRMED / HIGH-CONFIDENCE ROW
                // ==========================================
                const isDispensed = !!med.is_dispensed;

                return (
                  <tr key={med.id} className="hover:bg-[#F7F9FA] transition-colors">

                    {/* Medicine Name & Audit Trail */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => handleFieldChange(med.id, 'name', e.target.value)}
                          className="w-full px-2 py-1 border border-[#E2E8E8] rounded text-xs bg-white"
                        />
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[#1F2937] text-xs flex items-center gap-1.5">
                            {med.name}
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-[#1E8A5F]/10 text-[#1E8A5F] font-bold px-1.5 py-0.5 rounded border border-[#1E8A5F]/20">
                              <Check className="w-3 h-3" /> Confirmed
                            </span>
                          </span>

                          <span className="text-[10px] text-[#6B7280]">
                            {med.rxcui ? `RxCUI: ${med.rxcui}` : 'RxCUI: Unmapped'}
                          </span>

                          {/* AUDIT TRAIL BADGE */}
                          {(med.verification_method === 'doctor_contact' || (med.verification_method as any) === 'doctor') && (
                            <div className="mt-1 text-[10px] font-medium text-[#0F6E6E] bg-[#0F6E6E]/5 px-2 py-0.5 rounded border border-[#0F6E6E]/20 flex items-center gap-1">
                              <PhoneCall className="w-3 h-3 text-[#0F6E6E]" />
                              <span>Confirmed via Prescribing Doctor — {med.verified_by} ({med.verified_at})</span>
                            </div>
                          )}

                          {med.verification_method === 'pharmacist_network' && (
                            <div className="mt-1 text-[10px] font-medium text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded border border-[#FCD34D] flex items-center gap-1">
                              <Users className="w-3 h-3 text-[#D97706]" />
                              <span>Confirmed via {getEscalationRoleLabel(med.escalation_role)} Escalation Queue — {med.verified_by} ({med.verified_at})</span>
                            </div>
                          )}

                          {med.verification_method === 'ai_assistant' && (
                            <div className="mt-1 text-[10px] font-medium text-[#1E8A5F] bg-[#E6F4EA] px-2 py-0.5 rounded border border-[#1E8A5F]/20 flex items-center gap-1">
                              <Bot className="w-3 h-3 text-[#1E8A5F]" />
                              <span>Confirmed via AI Assistant — {med.verified_by} ({med.verified_at})</span>
                            </div>
                          )}

                          {med.verification_status === 'not_required' && (
                            <div className="mt-1 text-[10px] font-medium text-[#1E8A5F] bg-[#1E8A5F]/5 px-2 py-0.5 rounded border border-[#1E8A5F]/20 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-[#1E8A5F]" />
                              <span>Auto-Verified — High Confidence ({med.confidence}%)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Strength */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={med.strength || ''}
                          onChange={(e) => handleFieldChange(med.id, 'strength', e.target.value)}
                          placeholder="e.g. 500mg"
                          className="w-24 px-2 py-1 border border-[#E2E8E8] rounded text-xs bg-white"
                        />
                      ) : (
                        <span className={med.strength ? 'text-[#1F2937] font-medium' : 'text-[#6B7280] italic'}>
                          {med.strength || 'Not detected'}
                        </span>
                      )}
                    </td>

                    {/* Dosage / Form */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={med.dosage || ''}
                          onChange={(e) => handleFieldChange(med.id, 'dosage', e.target.value)}
                          placeholder="e.g. 1 Tablet"
                          className="w-24 px-2 py-1 border border-[#E2E8E8] rounded text-xs bg-white"
                        />
                      ) : (
                        <span className={med.dosage ? 'text-[#1F2937]' : 'text-[#6B7280] italic'}>
                          {med.dosage || 'Not detected'}
                        </span>
                      )}
                    </td>

                    {/* Frequency */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={med.frequency || ''}
                          onChange={(e) => handleFieldChange(med.id, 'frequency', e.target.value)}
                          placeholder="e.g. Twice daily"
                          className="w-28 px-2 py-1 border border-[#E2E8E8] rounded text-xs bg-white"
                        />
                      ) : (
                        <span className={med.frequency ? 'text-[#1F2937]' : 'text-[#6B7280] italic'}>
                          {med.frequency || 'Not detected'}
                        </span>
                      )}
                    </td>

                    {/* Route */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={med.route || ''}
                          onChange={(e) => handleFieldChange(med.id, 'route', e.target.value)}
                          placeholder="e.g. Oral"
                          className="w-20 px-2 py-1 border border-[#E2E8E8] rounded text-xs bg-white"
                        />
                      ) : (
                        <span className={med.route ? 'text-[#1F2937]' : 'text-[#6B7280] italic'}>
                          {med.route || 'Not detected'}
                        </span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#1E8A5F]/10 text-[#1E8A5F]">
                        {med.confidence}%
                      </span>
                    </td>

                    {/* Verification Gate Status */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-[#1E8A5F]/10 text-[#1E8A5F]">
                        <CheckCircle className="w-3.5 h-3.5" /> Verified
                      </span>
                    </td>

                    {/* Dispense Action & Row Editing */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isDispensed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1E8A5F] bg-[#1E8A5F]/10 px-2.5 py-1 rounded border border-[#1E8A5F]/20">
                            <CheckCircle className="w-3.5 h-3.5 text-[#1E8A5F]" /> Dispensed ({med.dispensed_at})
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDispense(med.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#1E8A5F] hover:bg-[#1E8A5F]/90 text-white font-bold text-xs transition-colors shadow-2xs"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Dispense
                          </button>
                        )}

                        {isEditing ? (
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded text-[#1E8A5F] hover:bg-[#1E8A5F]/10 transition-colors"
                            title="Done editing"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingId(med.id)}
                            className="p-1 rounded text-[#6B7280] hover:text-[#0F6E6E] hover:bg-[#0F6E6E]/10 transition-colors"
                            title="Edit row"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteRow(med.id)}
                          className="p-1 rounded text-[#6B7280] hover:text-[#B23A3A] hover:bg-[#B23A3A]/10 transition-colors"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Peer Review Queue Modal */}
      {showPeerQueueModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E2E8E8] p-6 max-w-2xl w-full shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E8]">
              <div>
                <h3 className="text-base font-bold text-[#1F2937] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0F6E6E]" /> RxGuardian Peer Review Queue
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Items pending second-pharmacist secondary verification before dispensing.
                </p>
              </div>
              <button
                onClick={() => setShowPeerQueueModal(false)}
                className="px-3 py-1 rounded border border-[#E2E8E8] text-xs font-semibold text-[#6B7280] hover:bg-[#F7F9FA]"
              >
                Close
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              {medicines.filter((m) => m.verification_status === 'in_progress').length === 0 ? (
                <div className="py-8 text-center text-[#6B7280]">No items currently queued for peer review.</div>
              ) : (
                medicines
                  .filter((m) => m.verification_status === 'in_progress')
                  .map((med) => (
                    <div key={med.id} className="p-3 border border-[#E2E8E8] rounded bg-[#F7F9FA] space-y-2">
                      <div className="flex justify-between items-center font-bold text-[#1F2937]">
                        <span>Raw Read: "{med.raw_text || med.original_line}"</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#0F6E6E] bg-[#0F6E6E]/10 px-2 py-0.5 rounded border border-[#0F6E6E]/20">
                            Role: {getEscalationRoleLabel(med.escalation_role)}
                          </span>
                          <span className="text-[#C08A1E]">Confidence: {med.confidence}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-[#E2E8E8]">
                        <div>
                          <span className="text-[10px] text-[#6B7280] block font-semibold">Gemini Initial Guess</span>
                          <span className="font-bold text-[#1F2937]">{med.best_guess_name || med.name}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#6B7280] block font-semibold">RxNorm Suggestions</span>
                          <span className="font-medium text-[#1F2937]">
                            {med.rxnorm_suggestions?.[0]?.name ? `${med.rxnorm_suggestions[0].name} (${med.rxnorm_suggestions[0].score}%)` : 'None'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            handlePeerConfirm(med);
                            if (medicines.filter((m) => m.verification_status === 'in_progress').length <= 1) {
                              setShowPeerQueueModal(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded bg-[#0F6E6E] text-white font-bold text-xs hover:bg-[#0F6E6E]/90 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve & Confirm as Pharmacist
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for manual medicine addition */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E2E8E8] p-6 max-w-lg w-full shadow-lg">
            <h3 className="text-base font-bold text-[#1F2937] mb-3">Add Medicine Manually</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#6B7280] font-medium mb-1">Drug Name / Search RxNorm</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery || newMedName}
                    onChange={(e) => {
                      setNewMedName(e.target.value);
                      handleRxNormSearch(e.target.value);
                    }}
                    placeholder="Search RxNorm (e.g. Amoxicillin, Metformin)"
                    className="w-full px-3 py-2 border border-[#E2E8E8] rounded bg-[#F7F9FA] focus:bg-white text-xs font-medium"
                  />
                  {isSearching && (
                    <div className="absolute right-2.5 top-2.5 text-[#6B7280]">
                      <Search className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-1 border border-[#E2E8E8] rounded bg-white max-h-36 overflow-y-auto shadow-xs">
                    {searchResults.map((cand, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSearchResult(cand)}
                        className="px-3 py-1.5 hover:bg-[#F7F9FA] cursor-pointer text-xs flex justify-between items-center"
                      >
                        <span className="font-semibold text-[#1F2937]">{cand.name}</span>
                        <span className="text-[10px] text-[#6B7280]">RxCUI: {cand.rxcui}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#6B7280] font-medium mb-1">Strength (optional)</label>
                  <input
                    type="text"
                    value={newStrength}
                    onChange={(e) => setNewStrength(e.target.value)}
                    placeholder="e.g. 500mg"
                    className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] font-medium mb-1">Dosage Form (optional)</label>
                  <input
                    type="text"
                    value={newDosage}
                    onChange={(e) => setNewDosage(e.target.value)}
                    placeholder="e.g. 1 Tablet"
                    className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[#6B7280] font-medium mb-1">Frequency</label>
                  <input
                    type="text"
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    placeholder="e.g. Twice daily"
                    className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] font-medium mb-1">Route</label>
                  <input
                    type="text"
                    value={newRoute}
                    onChange={(e) => setNewRoute(e.target.value)}
                    placeholder="e.g. Oral"
                    className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#6B7280] font-medium mb-1">Duration</label>
                  <input
                    type="text"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="e.g. 7 days"
                    className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded text-xs"
                  />
                </div>
              </div>

            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded border border-[#E2E8E8] text-xs font-medium text-[#6B7280] hover:bg-[#F7F9FA]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManualMedicine}
                disabled={!newMedName.trim()}
                className="px-4 py-2 rounded bg-[#0F6E6E] text-white text-xs font-semibold hover:bg-[#0F6E6E]/90 disabled:opacity-50"
              >
                Add to Table
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
