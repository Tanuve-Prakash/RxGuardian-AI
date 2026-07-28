import React, { useState, useEffect } from 'react';
import { ImageUploader } from '../../components/OCR/ImageUploader';
import { PharmacistReviewTable } from '../../components/ReviewTable/PharmacistReviewTable';
import { SafetyAlertsPanel } from '../../components/Alerts/SafetyAlertsPanel';
import {
  extractPrescriptionApi,
  parsePrescriptionApi,
  verifyMedicinesApi,
  checkSafetyApi,
  saveAnalysisApi
} from '../../services/analysis';
import {
  getPatientByTokenApi,
  listPatientsApi,
  linkAnalysisToPatientApi
} from '../../services/patients';
import { MedicineCandidate, SafetyAlert, RxScore, PatientContext, GeminiPrescriptionReview, PatientPassport } from '../../types';
import { Save, Printer, RefreshCw, User, AlertCircle, CheckCircle2, QrCode, ShieldCheck, Search, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NewAnalysisPage: React.FC = () => {
  const navigate = useNavigate();

  // Patient Passport Linking state
  const [linkedPatient, setLinkedPatient] = useState<PatientPassport | null>(null);
  const [passportQrInput, setPassportQrInput] = useState<string>('');
  const [isResolvingQr, setIsResolvingQr] = useState<boolean>(false);
  const [registeredPatients, setRegisteredPatients] = useState<PatientPassport[]>([]);
  const [passportNotice, setPassportNotice] = useState<string | null>(null);

  // Patient Context state (optional inputs)
  const [patientName, setPatientName] = useState<string>('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<string>('Unspecified');
  const [allergies, setAllergies] = useState<string>('');
  const [renalImpairment, setRenalImpairment] = useState<boolean>(false);
  const [hepaticImpairment, setHepaticImpairment] = useState<boolean>(false);
  const [isPregnant, setIsPregnant] = useState<boolean>(false);

  useEffect(() => {
    // Load existing registered patient passports for fast selector dropdown
    listPatientsApi().then(res => setRegisteredPatients(res.patients || [])).catch(() => {});
  }, []);

  const applyPatientPassport = (patient: PatientPassport) => {
    setLinkedPatient(patient);
    setPatientName(patient.full_name);
    if (patient.date_of_birth) {
      // Calculate age approximate
      const birthYear = new Date(patient.date_of_birth).getFullYear();
      if (!isNaN(birthYear)) {
        const age = new Date().getFullYear() - birthYear;
        if (age > 0 && age < 120) setPatientAge(age.toString());
      }
    }
    if (patient.gender) setPatientGender(patient.gender);
    if (patient.allergies) setAllergies(patient.allergies);
    setRenalImpairment(patient.renal_impairment);
    setHepaticImpairment(patient.hepatic_impairment);
    setIsPregnant(patient.is_pregnant);
    setPassportNotice(`Pre-filled profile & risks from RxGuardian Passport: ${patient.full_name}`);
  };

  const handleResolvePassportQr = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passportQrInput.trim()) return;

    setIsResolvingQr(true);
    setPassportNotice(null);
    try {
      const res = await getPatientByTokenApi(passportQrInput.trim());
      applyPatientPassport(res.patient);
      setPassportQrInput('');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'RxGuardian Passport not found for this QR token.');
    } finally {
      setIsResolvingQr(false);
    }
  };

  // Analysis workflow states
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [ocrError, setOcrError] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [ocrConfidence, setOcrConfidence] = useState<number>(1.0);

  // Guardrail 8: Initialize with EXACTLY 0 rows!
  const [medicines, setMedicines] = useState<MedicineCandidate[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [rxscore, setRxScore] = useState<RxScore | null>(null);
  const [assessmentSummary, setAssessmentSummary] = useState<any>(null);
  const [geminiReview, setGeminiReview] = useState<GeminiPrescriptionReview | null>(null);

  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [extractionNotice, setExtractionNotice] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);

  // Triggered when user selects/uploads prescription image
  const handleImageUpload = async (file: File) => {
    setIsExtracting(true);
    setOcrError(null);
    setExtractionNotice(null);
    setSaveSuccess(false);

    try {
      // Step A: Direct Gemini API Prescription Multimodal Extraction
      const ocrResult = await extractPrescriptionApi(file);
      const rawText = ocrResult?.raw_text || '';
      const confidence = ocrResult?.confidence ?? 90;
      const extractedMeds = ocrResult?.medicines || [];
      const lines = ocrResult?.lines || [];

      if (ocrResult?.patient_name && !patientName) {
        setPatientName(ocrResult.patient_name);
      }

      setRawOcrText(rawText);
      setOcrConfidence(confidence);

      // Step B: Resolve Gemini extracted candidate medicines with RxNorm
      const parsedResult = await parsePrescriptionApi(extractedMeds, lines);

      // Step C: OpenFDA verification enrichment
      const verifiedResult = await verifyMedicinesApi(parsedResult?.medicines || []);

      const verifiedMeds = verifiedResult?.medicines || [];
      setMedicines(verifiedMeds);

      if (verifiedMeds.length > 0) {
        setExtractionNotice({
          type: 'success',
          message: `Extracted ${verifiedMeds.length} medication line(s) from prescription.`
        });
        await executeSafetyCheck(verifiedMeds, confidence);
      } else {
        setExtractionNotice({
          type: 'warning',
          message: 'No medication lines detected in the prescription image. You can manually add medicines using the table below.'
        });
      }
    } catch (err) {
      console.error('[NewAnalysis] Upload OCR pipeline error:', err);
      const errMsg = (err as Error).message || 'Failed to process prescription image.';
      setOcrError(errMsg);
      setExtractionNotice(null);

      // Guardrail 5: Clear review table on OCR error!
      setMedicines([]);
      setAlerts([]);
      setRxScore(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const executeSafetyCheck = async (medsList: MedicineCandidate[], confidenceVal?: number, customPatient?: PatientPassport | null) => {
    if (medsList.length === 0) return;

    setIsEvaluating(true);
    try {
      const activePatient = customPatient !== undefined ? customPatient : linkedPatient;
      const pContext: PatientContext = {
        patient_name: patientName || undefined,
        patient_age: patientAge || undefined,
        patient_gender: patientGender,
        allergies: allergies.trim() || undefined,
        renal_impairment: renalImpairment,
        hepatic_impairment: hepaticImpairment,
        is_pregnant: isPregnant,
        patient_id: activePatient?.id,
        current_medications: activePatient?.current_medications || undefined,
        previous_reactions: activePatient?.previous_reactions || undefined
      };

      const result = await checkSafetyApi(medsList, pContext, confidenceVal ?? ocrConfidence, rawOcrText);
      setAlerts(result.alerts);
      setRxScore(result.rxscore);
      setAssessmentSummary(result.assessment_summary);
      setGeminiReview(result.gemini_review || null);
    } catch (err) {
      console.error('Safety check failed:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    if (medicines.length > 0) {
      executeSafetyCheck(medicines, ocrConfidence, linkedPatient);
    }
  }, [linkedPatient]);

  const handleManualSafetyRecheck = () => {
    executeSafetyCheck(medicines, ocrConfidence);
  };

  const handleSaveAnalysis = async () => {
    if (medicines.length === 0) return;

    setIsSaving(true);
    try {
      const saveRes = await saveAnalysisApi({
        patient_name: patientName.trim() || 'Anonymous Patient',
        patient_age: patientAge ? parseInt(patientAge) : null,
        patient_gender: patientGender,
        allergies: allergies.trim() || null,
        renal_impairment: renalImpairment ? 1 : 0,
        hepatic_impairment: hepaticImpairment ? 1 : 0,
        is_pregnant: isPregnant ? 1 : 0,
        raw_ocr_text: rawOcrText,
        medicines,
        alerts,
        rxscore: rxscore?.score || 0,
        band: rxscore?.band || 'Needs Review',
        summary: { ...assessmentSummary, gemini_review: geminiReview }
      });

      // If linked to a Patient Digital Passport, append analysis ID to patient's record
      if (linkedPatient && saveRes?.id) {
        try {
          await linkAnalysisToPatientApi(linkedPatient.id, saveRes.id);
        } catch (linkErr) {
          console.error('[Patient Passport Link Error]', linkErr);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/history');
      }, 1200);
    } catch (err) {
      alert((err as Error).message || 'Failed to save prescription analysis.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Title Banner */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937]">New Prescription Analysis</h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Upload prescription image, verify extracted medicines, evaluate safety risks & compute RxScore
          </p>
        </div>

        <div className="flex items-center gap-2">
          {medicines.length > 0 && (
            <>
              <button
                onClick={handlePrintReport}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#E2E8E8] text-xs font-semibold text-[#1F2937] hover:bg-[#F7F9FA]"
              >
                <Printer className="w-4 h-4 text-[#6B7280]" /> Print Report
              </button>

              <button
                onClick={handleSaveAnalysis}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F6E6E] text-white text-xs font-semibold hover:bg-[#0F6E6E]/90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Record'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-[#1E8A5F]/10 border border-[#1E8A5F]/30 text-[#1E8A5F] rounded-lg p-4 flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-5 h-5" />
          <span>Analysis saved successfully! Redirecting to clinical history...</span>
        </div>
      )}

      {/* Patient Context Input Form (Optional) */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8E8] pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#1F2937] flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#0F6E6E]" /> Patient Clinical Context & Passport Intake
            </h2>
            <p className="text-xs text-[#6B7280]">
              Scan an RxGuardian Passport QR or manually enter patient demographics and allergy history to enable targeted safety checks.
            </p>
          </div>

          {linkedPatient && (
            <span className="px-2.5 py-1 rounded-lg bg-[#0F6E6E]/10 border border-[#0F6E6E]/30 text-[#0F6E6E] text-xs font-bold flex items-center gap-1.5 self-start sm:self-center">
              <ShieldCheck className="w-4 h-4 text-[#0F6E6E]" /> Linked Passport: {linkedPatient.full_name}
            </span>
          )}
        </div>

        {/* Scan RxGuardian Passport QR / Select Registered Passport */}
        <div className="p-3.5 bg-[#0F6E6E]/5 border border-[#0F6E6E]/20 rounded-lg space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#1F2937]">
            <QrCode className="w-4 h-4 text-[#0F6E6E]" />
            <span>Scan RxGuardian Passport QR Code or Select Patient</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            {/* Token Input */}
            <form onSubmit={handleResolvePassportQr} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Paste or scan Passport QR Token (e.g. rxp_...)"
                value={passportQrInput}
                onChange={(e) => setPassportQrInput(e.target.value)}
                className="px-3 py-1.5 text-xs border border-[#CBD5E1] rounded bg-white w-full focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30 font-mono"
              />
              <button
                type="submit"
                disabled={isResolvingQr || !passportQrInput.trim()}
                className="px-3 py-1.5 bg-[#0F6E6E] text-white rounded font-bold hover:bg-[#0F6E6E]/90 transition-colors disabled:opacity-50 shrink-0"
              >
                {isResolvingQr ? 'Resolving...' : 'Pre-fill from QR'}
              </button>
            </form>

            {/* Select dropdown from existing database */}
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280] font-medium shrink-0">or Select Existing:</span>
              <select
                onChange={(e) => {
                  const p = registeredPatients.find(x => x.id === e.target.value);
                  if (p) applyPatientPassport(p);
                }}
                defaultValue=""
                className="px-3 py-1.5 border border-[#CBD5E1] rounded bg-white text-xs w-full focus:outline-none focus:ring-2 focus:ring-[#0F6E6E]/30"
              >
                <option value="" disabled>-- Select Registered RxGuardian Passport --</option>
                {registeredPatients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.allergies ? `Allergies: ${p.allergies}` : 'No allergies'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {passportNotice && (
            <div className="mt-2 text-[11px] font-semibold text-[#0F6E6E] flex items-center justify-between bg-white p-2 rounded border border-[#0F6E6E]/20">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0F6E6E]" />
                <span>{passportNotice}</span>
              </div>
              <button
                onClick={() => {
                  setLinkedPatient(null);
                  setPassportNotice(null);
                }}
                className="text-[10px] underline text-[#6B7280] hover:text-[#1F2937]"
              >
                Clear Passport Link
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[#6B7280] font-medium mb-1">Patient Name</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] font-medium mb-1">Age (Years)</label>
            <input
              type="number"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              placeholder="e.g. 45"
              className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-[#6B7280] font-medium mb-1">Gender</label>
            <select
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
            >
              <option value="Unspecified">Unspecified</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-[#6B7280] font-medium mb-1">Known Allergies / Sensitivities</label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. Penicillin, Sulfa, NSAIDs (leave blank if none)"
              className="w-full px-3 py-1.5 border border-[#E2E8E8] rounded bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
            />
          </div>

          {/* Checkbox Impairment Flags */}
          <div className="sm:col-span-2 md:col-span-3 flex flex-wrap items-center gap-6 pt-2 text-xs text-[#1F2937]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={renalImpairment}
                onChange={(e) => setRenalImpairment(e.target.checked)}
                className="rounded border-[#E2E8E8] text-[#0F6E6E] focus:ring-[#0F6E6E]"
              />
              <span>Renal Impairment</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hepaticImpairment}
                onChange={(e) => setHepaticImpairment(e.target.checked)}
                className="rounded border-[#E2E8E8] text-[#0F6E6E] focus:ring-[#0F6E6E]"
              />
              <span>Hepatic Impairment</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPregnant}
                onChange={(e) => setIsPregnant(e.target.checked)}
                className="rounded border-[#E2E8E8] text-[#0F6E6E] focus:ring-[#0F6E6E]"
              />
              <span>Pregnant / Breastfeeding</span>
            </label>
          </div>
        </div>
      </div>

      {/* Image Uploader Component */}
      <ImageUploader
        onUpload={handleImageUpload}
        isLoading={isExtracting}
        error={ocrError}
        onRetry={() => {
          setOcrError(null);
          setExtractionNotice(null);
          setMedicines([]);
        }}
      />

      {/* OCR Outcome Notification Banner */}
      {extractionNotice && (
        <div
          className={`rounded-lg p-4 flex items-center gap-2 text-xs font-semibold border ${
            extractionNotice.type === 'success'
              ? 'bg-[#1E8A5F]/10 border-[#1E8A5F]/30 text-[#1E8A5F]'
              : 'bg-[#C08A1E]/10 border-[#C08A1E]/30 text-[#C08A1E]'
          }`}
        >
          {extractionNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{extractionNotice.message}</span>
        </div>
      )}

      {/* Pharmacist Review Table (Guardrail 8: empty until upload!) */}
      <PharmacistReviewTable
        medicines={medicines}
        patientContext={{
          patient_name: patientName,
          patient_age: patientAge,
          patient_gender: patientGender,
          allergies,
          renal_impairment: renalImpairment,
          hepatic_impairment: hepaticImpairment,
          is_pregnant: isPregnant
        }}
        onUpdateMedicines={(updated) => {
          setMedicines(updated);
          executeSafetyCheck(updated, ocrConfidence);
        }}
      />

      {/* Safety Assessment & RxScore Panel */}
      {medicines.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={handleManualSafetyRecheck}
              disabled={isEvaluating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E2E8E8] bg-white text-xs font-semibold text-[#0F6E6E] hover:bg-[#F7F9FA]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
              Re-evaluate Safety Checks
            </button>
          </div>

          <SafetyAlertsPanel
            alerts={alerts}
            rxscore={rxscore}
            assessmentSummary={assessmentSummary}
            geminiReview={geminiReview}
          />
        </div>
      )}

    </div>
  );
};
