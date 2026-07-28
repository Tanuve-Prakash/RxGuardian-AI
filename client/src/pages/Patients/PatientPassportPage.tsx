import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Plus,
  Search,
  User,
  AlertTriangle,
  Pill,
  History,
  Phone,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  Info,
  Calendar,
  X
} from 'lucide-react';
import { PatientPassport, AnalysisRecord, CurrentMedication } from '../../types';
import {
  listPatientsApi,
  getPatientByIdApi,
  getPatientByTokenApi,
  createPatientApi,
  updatePatientApi,
  deletePatientApi
} from '../../services/patients';
import { Link } from 'react-router-dom';

export const PatientPassportPage: React.FC = () => {
  const [patients, setPatients] = useState<PatientPassport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected patient for detail / QR passport view modal
  const [selectedPatient, setSelectedPatient] = useState<PatientPassport | null>(null);
  const [linkedAnalyses, setLinkedAnalyses] = useState<AnalysisRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Quick QR Token Scan / Lookup state
  const [scanTokenInput, setScanTokenInput] = useState('');
  const [scanningToken, setScanningToken] = useState(false);

  // Modal forms state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientPassport | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    allergies: '',
    previous_reactions: '',
    is_pregnant: false,
    renal_impairment: false,
    hepatic_impairment: false,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medsInput: '' // comma separated or line separated
  });

  const loadPatients = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPatientsApi(query);
      setPatients(res.patients || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load patient passports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients(searchQuery);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPatients(searchQuery);
  };

  const handleTokenScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanTokenInput.trim()) return;
    setScanningToken(true);
    setError(null);
    try {
      const res = await getPatientByTokenApi(scanTokenInput.trim());
      setSelectedPatient(res.patient);
      setScanTokenInput('');
      setSuccessMsg(`Loaded passport for ${res.patient.full_name}`);
      // Load linked analyses if any
      fetchPatientDetail(res.patient.id);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No RxGuardian Passport found for this QR token.');
    } finally {
      setScanningToken(false);
    }
  };

  const fetchPatientDetail = async (patientId: string) => {
    setLoadingDetail(true);
    try {
      const res = await getPatientByIdApi(patientId);
      setSelectedPatient(res.patient);
      setLinkedAnalyses(res.past_analyses || []);
    } catch (err) {
      console.error('Error fetching detail', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPatient(null);
    setFormData({
      full_name: '',
      date_of_birth: '',
      gender: '',
      allergies: '',
      previous_reactions: '',
      is_pregnant: false,
      renal_impairment: false,
      hepatic_impairment: false,
      emergency_contact_name: '',
      emergency_contact_phone: '',
      medsInput: ''
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (p: PatientPassport) => {
    setEditingPatient(p);
    setFormData({
      full_name: p.full_name,
      date_of_birth: p.date_of_birth || '',
      gender: p.gender || '',
      allergies: p.allergies || '',
      previous_reactions: p.previous_reactions || '',
      is_pregnant: p.is_pregnant,
      renal_impairment: p.renal_impairment,
      hepatic_impairment: p.hepatic_impairment,
      emergency_contact_name: p.emergency_contact_name || '',
      emergency_contact_phone: p.emergency_contact_phone || '',
      medsInput: (p.current_medications || []).map(m => m.name).join(', ')
    });
    setIsCreateModalOpen(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      setError('Patient full name is required.');
      return;
    }

    const medsList: CurrentMedication[] = formData.medsInput
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(name => ({ name }));

    const payload = {
      full_name: formData.full_name,
      date_of_birth: formData.date_of_birth || null,
      gender: formData.gender || null,
      allergies: formData.allergies || null,
      previous_reactions: formData.previous_reactions || null,
      is_pregnant: formData.is_pregnant,
      renal_impairment: formData.renal_impairment,
      hepatic_impairment: formData.hepatic_impairment,
      emergency_contact_name: formData.emergency_contact_name || null,
      emergency_contact_phone: formData.emergency_contact_phone || null,
      current_medications: medsList
    };

    try {
      if (editingPatient) {
        const res = await updatePatientApi(editingPatient.id, payload);
        setSuccessMsg(res.message);
        if (selectedPatient?.id === editingPatient.id) {
          fetchPatientDetail(editingPatient.id);
        }
      } else {
        const res = await createPatientApi(payload);
        setSuccessMsg(res.message);
        setSelectedPatient(res.patient);
        fetchPatientDetail(res.patient.id);
      }
      setIsCreateModalOpen(false);
      loadPatients();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save patient passport.');
    }
  };

  const handleDeletePatient = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the passport for ${name}?`)) return;
    try {
      await deletePatientApi(id);
      setSuccessMsg(`Deleted patient passport for ${name}`);
      if (selectedPatient?.id === id) {
        setSelectedPatient(null);
      }
      loadPatients();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete patient passport.');
    }
  };

  const copyTokenToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handlePrintQR = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-[#E2E8E8] rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-[#0F6E6E]/10 text-[#0F6E6E]">
              <QrCode className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#1F2937]">Patient Digital Medication Passports</h1>
          </div>
          <p className="text-xs text-[#6B7280]">
            Cumulative clinical profiles linked via secure, tokenized RxGuardian QR passports. Scans automatically pre-fill patient context during analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#0F6E6E] text-white rounded-lg text-xs font-bold hover:bg-[#0F6E6E]/90 transition-colors flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Issue New Passport
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-3 bg-[#B23A3A]/10 border border-[#B23A3A]/30 text-[#B23A3A] rounded-lg text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold underline text-[11px]">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-[#0F6E6E]/10 border border-[#0F6E6E]/30 text-[#0F6E6E] rounded-lg text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold underline text-[11px]">Dismiss</button>
        </div>
      )}

      {/* QR Scan / Quick Token Lookup Bar */}
      <div className="bg-[#0F6E6E]/5 border border-[#0F6E6E]/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0F6E6E] text-white flex items-center justify-center shrink-0 shadow-xs">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1F2937]">Scan or Enter RxGuardian Passport Token</h2>
            <p className="text-[11px] text-[#6B7280]">
              Paste an opaque QR token (e.g. <code className="bg-white px-1.5 py-0.5 rounded border border-[#E2E8E8] text-[#0F6E6E]">rxp_...</code>) to instantly inspect cumulative passport.
            </p>
          </div>
        </div>

        <form onSubmit={handleTokenScanSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="e.g. rxp_7a9f82c..."
            value={scanTokenInput}
            onChange={(e) => setScanTokenInput(e.target.value)}
            className="px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg bg-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30 font-mono"
          />
          <button
            type="submit"
            disabled={scanningToken || !scanTokenInput.trim()}
            className="px-4 py-2 bg-[#0F6E6E] text-white rounded-lg text-xs font-bold hover:bg-[#0F6E6E]/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {scanningToken ? 'Searching...' : 'Lookup QR'}
          </button>
        </form>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search patients by name or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#E2E8E8] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
          />
        </form>
        <div className="text-xs text-[#6B7280] self-end sm:self-center">
          Total Registered Passports: <strong className="text-[#1F2937]">{patients.length}</strong>
        </div>
      </div>

      {/* Patient List Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#6B7280]">
          Loading patient passports database...
        </div>
      ) : patients.length === 0 ? (
        <div className="py-12 bg-white border border-[#E2E8E8] rounded-xl text-center space-y-3">
          <User className="w-10 h-10 text-[#9CA3AF] mx-auto" />
          <h3 className="text-sm font-bold text-[#1F2937]">No Patient Passports Found</h3>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">
            Issue a digital medication passport to store cumulative allergy profile, organ impairment flags, and prescription history.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#0F6E6E] text-white rounded-lg text-xs font-bold hover:bg-[#0F6E6E]/90 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Issue First Passport
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => {
            const isSelected = selectedPatient?.id === patient.id;
            return (
              <div
                key={patient.id}
                className={`bg-white border rounded-xl p-4 transition-all space-y-3 flex flex-col justify-between ${
                  isSelected ? 'border-[#0F6E6E] ring-2 ring-[#0F6E6E]/20 shadow-md' : 'border-[#E2E8E8] hover:border-[#CBD5E1] shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#0F6E6E]/10 text-[#0F6E6E] font-bold text-sm flex items-center justify-center shrink-0">
                        {patient.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#1F2937] leading-snug">{patient.full_name}</h3>
                        <p className="text-[11px] text-[#6B7280]">
                          {patient.date_of_birth ? `DOB: ${patient.date_of_birth}` : 'DOB: Not specified'}{' '}
                          {patient.gender ? `• ${patient.gender}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => fetchPatientDetail(patient.id)}
                      className="p-1.5 rounded-lg bg-[#0F6E6E]/10 text-[#0F6E6E] hover:bg-[#0F6E6E]/20 transition-colors"
                      title="View QR Passport"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Risks Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {patient.allergies && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-[#D97706]" /> Allergies: {patient.allergies}
                      </span>
                    )}
                    {patient.is_pregnant && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8]">
                        Pregnancy
                      </span>
                    )}
                    {patient.renal_impairment && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                        Renal
                      </span>
                    )}
                    {patient.hepatic_impairment && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEDD5] text-[#C2410C] border border-[#FED7AA]">
                        Hepatic
                      </span>
                    )}
                  </div>

                  {/* Active Meds Summary */}
                  <div className="mt-3 text-xs text-[#4B5563]">
                    <div className="flex items-center gap-1 font-semibold text-[#1F2937] mb-1">
                      <Pill className="w-3.5 h-3.5 text-[#0F6E6E]" />
                      <span>Active Medications ({patient.current_medications?.length || 0})</span>
                    </div>
                    {patient.current_medications && patient.current_medications.length > 0 ? (
                      <p className="text-[11px] text-[#6B7280] line-clamp-1">
                        {patient.current_medications.map(m => m.name).join(', ')}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#9CA3AF] italic">No active medications logged</p>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-[#F3F4F6] flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-[#6B7280] truncate max-w-[120px]">
                    {patient.qr_token}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(patient)}
                      className="p-1.5 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded transition-colors"
                      title="Edit Passport"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePatient(patient.id, patient.full_name)}
                      className="p-1.5 text-[#6B7280] hover:text-[#B23A3A] hover:bg-[#B23A3A]/10 rounded transition-colors"
                      title="Delete Passport"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => fetchPatientDetail(patient.id)}
                      className="px-2.5 py-1 bg-[#0F6E6E] text-white text-[11px] font-bold rounded hover:bg-[#0F6E6E]/90 transition-colors flex items-center gap-1"
                    >
                      View Passport
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PATIENT PASSPORT DETAIL / QR MODAL */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E2E8E8]">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E2E8E8] flex items-center justify-between bg-[#F7F9FA] sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0F6E6E] text-white flex items-center justify-center font-bold text-base shadow-xs">
                  {selectedPatient.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1F2937]">{selectedPatient.full_name}</h2>
                  <p className="text-xs text-[#6B7280]">
                    RxGuardian Digital Passport ID: <code className="font-mono text-[#0F6E6E] font-bold">{selectedPatient.id}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-2 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#E2E8E8] rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* QR Code Section */}
              <div className="bg-[#0F6E6E]/5 border border-[#0F6E6E]/20 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-xl border border-[#0F6E6E]/20 shadow-sm shrink-0 text-center space-y-2">
                  {selectedPatient.qr_code_data_url ? (
                    <img
                      src={selectedPatient.qr_code_data_url}
                      alt="RxGuardian Passport QR"
                      className="w-48 h-48 mx-auto"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-[#F3F4F6] flex items-center justify-center text-xs text-[#9CA3AF]">
                      QR Rendering...
                    </div>
                  )}
                  <span className="block text-[10px] font-mono font-bold text-[#0F6E6E] tracking-wider">
                    {selectedPatient.qr_token}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#0F6E6E]" />
                    <h3 className="font-bold text-sm text-[#1F2937]">Secure Tokenized QR Passport</h3>
                  </div>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    This QR code encodes an opaque token (<code className="font-mono text-[#0F6E6E]">{selectedPatient.qr_token}</code>). Scanning it at prescription intake securely looks up patient context server-side. 
                    <strong> No raw PHI or medical data is directly stored inside the QR code image payload.</strong>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      onClick={() => copyTokenToClipboard(selectedPatient.qr_token)}
                      className="px-3 py-1.5 bg-white border border-[#CBD5E1] text-[#1F2937] rounded-lg text-xs font-bold hover:bg-[#F8FAFC] transition-colors flex items-center gap-1.5"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-[#0F6E6E]" /> : <Copy className="w-3.5 h-3.5 text-[#6B7280]" />}
                      {copiedToken ? 'Token Copied!' : 'Copy QR Token'}
                    </button>

                    <button
                      onClick={handlePrintQR}
                      className="px-3 py-1.5 bg-white border border-[#CBD5E1] text-[#1F2937] rounded-lg text-xs font-bold hover:bg-[#F8FAFC] transition-colors flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#6B7280]" /> Print Passport Badge
                    </button>
                  </div>
                </div>
              </div>

              {/* Demographics & Clinical Profile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F7F9FA] border border-[#E2E8E8] rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#0F6E6E]" /> Patient Context & Demographics
                  </h4>
                  <div className="text-xs space-y-1 text-[#4B5563]">
                    <p><strong>Full Name:</strong> {selectedPatient.full_name}</p>
                    <p><strong>Date of Birth:</strong> {selectedPatient.date_of_birth || 'Unspecified'}</p>
                    <p><strong>Gender:</strong> {selectedPatient.gender || 'Unspecified'}</p>
                    <p><strong>Emergency Contact:</strong> {selectedPatient.emergency_contact_name || 'N/A'} {selectedPatient.emergency_contact_phone ? `(${selectedPatient.emergency_contact_phone})` : ''}</p>
                  </div>
                </div>

                <div className="bg-[#F7F9FA] border border-[#E2E8E8] rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#D97706]" /> Allergies & Safety Warnings
                  </h4>
                  <div className="text-xs space-y-1.5">
                    <div className="p-2 bg-white rounded border border-[#E2E8E8]">
                      <span className="font-bold text-[#1F2937] block">Known Drug Allergies:</span>
                      <span className="text-[#B23A3A] font-medium">{selectedPatient.allergies || 'None reported'}</span>
                    </div>
                    {selectedPatient.previous_reactions && (
                      <div className="p-2 bg-white rounded border border-[#E2E8E8]">
                        <span className="font-bold text-[#1F2937] block">Previous Reactions:</span>
                        <span className="text-[#6B7280]">{selectedPatient.previous_reactions}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedPatient.is_pregnant && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FCE7F3] text-[#9D174D]">Pregnant</span>
                      )}
                      {selectedPatient.renal_impairment && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E0F2FE] text-[#0369A1]">Renal Impairment</span>
                      )}
                      {selectedPatient.hepatic_impairment && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEDD5] text-[#C2410C]">Hepatic Impairment</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Medications */}
              <div className="bg-white border border-[#E2E8E8] rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-[#0F6E6E]" /> Active Medications ({selectedPatient.current_medications?.length || 0})
                </h4>
                {selectedPatient.current_medications && selectedPatient.current_medications.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedPatient.current_medications.map((m, idx) => (
                      <div key={idx} className="p-2.5 bg-[#F7F9FA] border border-[#E2E8E8] rounded-lg text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#1F2937] block">{m.name}</span>
                          {m.started_at && <span className="text-[10px] text-[#6B7280]">Started: {m.started_at}</span>}
                        </div>
                        {m.rxcui && (
                          <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-[#CBD5E1] text-[#0F6E6E]">
                            RxCUI: {m.rxcui}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#9CA3AF] italic">No active medications registered in this passport yet.</p>
                )}
              </div>

              {/* Cumulative Linked Prescriptions History */}
              <div className="bg-white border border-[#E2E8E8] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#0F6E6E]" /> Cumulative RxGuardian Prescriptions ({linkedAnalyses.length})
                  </h4>
                  <Link
                    to={`/new-analysis`}
                    className="text-xs font-bold text-[#0F6E6E] hover:underline flex items-center gap-1"
                  >
                    + New Analysis for this Patient
                  </Link>
                </div>

                {loadingDetail ? (
                  <div className="py-4 text-center text-xs text-[#6B7280]">Loading linked prescriptions...</div>
                ) : linkedAnalyses.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] italic">
                    No prescription analyses linked yet. When an intake analysis is performed with this patient context, it will automatically link to this cumulative passport.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedAnalyses.map((analysis) => (
                      <div key={analysis.id} className="p-3 bg-[#F7F9FA] border border-[#E2E8E8] rounded-lg flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1F2937]">Analysis #{analysis.id.slice(0, 8)}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              analysis.band === 'Safe' ? 'bg-[#0F6E6E]/10 text-[#0F6E6E]' :
                              analysis.band === 'Needs Review' ? 'bg-[#FEF3C7] text-[#92400E]' :
                              'bg-[#B23A3A]/10 text-[#B23A3A]'
                            }`}>
                              RxScore: {analysis.rxscore} ({analysis.band})
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6B7280] mt-0.5">
                            Date: {new Date(analysis.created_at).toLocaleString()} • {analysis.medicines?.length || 0} Medicines Analyzed
                          </p>
                        </div>

                        <Link
                          to={`/history`}
                          className="px-3 py-1 bg-white border border-[#CBD5E1] text-[#0F6E6E] rounded text-xs font-bold hover:bg-[#0F6E6E]/5 transition-colors shrink-0 flex items-center gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E2E8E8] bg-[#F7F9FA] flex items-center justify-between">
              <button
                onClick={() => handleOpenEditModal(selectedPatient)}
                className="px-4 py-2 border border-[#CBD5E1] text-[#1F2937] rounded-lg text-xs font-bold hover:bg-white transition-colors"
              >
                Edit Passport Details
              </button>
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-5 py-2 bg-[#0F6E6E] text-white rounded-lg text-xs font-bold hover:bg-[#0F6E6E]/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PATIENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#E2E8E8] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8E8] pb-3">
              <h3 className="font-bold text-base text-[#1F2937]">
                {editingPatient ? 'Edit Patient Passport' : 'Issue New Patient Digital Passport'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-[#6B7280] hover:text-[#1F2937]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#4B5563] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#4B5563] mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30 bg-white"
                  >
                    <option value="">Select Gender...</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#4B5563] mb-1">Known Drug Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa drugs"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#4B5563] mb-1">Current Active Medications (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
                  value={formData.medsInput}
                  onChange={(e) => setFormData({ ...formData, medsInput: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#4B5563] mb-1">Previous Adverse Drug Reactions</label>
                <input
                  type="text"
                  placeholder="e.g. Severe rash with Amoxicillin in 2022"
                  value={formData.previous_reactions}
                  onChange={(e) => setFormData({ ...formData, previous_reactions: e.target.value })}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
                />
              </div>

              {/* Risk Flags Checkboxes */}
              <div className="p-3 bg-[#F7F9FA] rounded-lg border border-[#E2E8E8] space-y-2">
                <span className="font-bold text-[#1F2937] block">Clinical Risk Indicators:</span>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_pregnant}
                      onChange={(e) => setFormData({ ...formData, is_pregnant: e.target.checked })}
                      className="rounded text-[#0F6E6E] focus:ring-[#0F6E6E]"
                    />
                    <span>Pregnant</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.renal_impairment}
                      onChange={(e) => setFormData({ ...formData, renal_impairment: e.target.checked })}
                      className="rounded text-[#0F6E6E] focus:ring-[#0F6E6E]"
                    />
                    <span>Renal Impairment</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hepatic_impairment}
                      onChange={(e) => setFormData({ ...formData, hepatic_impairment: e.target.checked })}
                      className="rounded text-[#0F6E6E] focus:ring-[#0F6E6E]"
                    />
                    <span>Hepatic Impairment</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#4B5563] mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Jenkins"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#4B5563] mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 (555) 019-2831"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8E8] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-[#CBD5E1] text-[#1F2937] rounded-lg font-bold hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F6E6E] text-white rounded-lg font-bold hover:bg-[#0F6E6E]/90"
                >
                  {editingPatient ? 'Update Passport' : 'Generate & Issue Passport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
