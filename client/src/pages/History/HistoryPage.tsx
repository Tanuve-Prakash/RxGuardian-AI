import React, { useEffect, useState } from 'react';
import { getHistoryApi, getAnalysisDetailApi, deleteAnalysisApi } from '../../services/analysis';
import { AnalysisRecord } from '../../types';
import { Search, Filter, Trash2, Eye, Printer, AlertTriangle, ShieldCheck, ShieldAlert, FileText, X } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bandFilter, setBandFilter] = useState<string>('all');

  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchHistory();
  }, [searchQuery, bandFilter]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getHistoryApi(searchQuery, bandFilter);
      setAnalyses(data.analyses);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (id: string) => {
    try {
      const data = await getAnalysisDetailApi(id);
      setSelectedRecord(data.analysis);
      setIsModalOpen(true);
    } catch (err) {
      alert('Failed to load analysis details.');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this prescription analysis record?')) return;

    try {
      await deleteAnalysisApi(id);
      setAnalyses(prev => prev.filter(item => item.id !== id));
      if (selectedRecord?.id === id) {
        setIsModalOpen(false);
      }
    } catch (err) {
      alert('Failed to delete record.');
    }
  };

  const bandColors = {
    'Safe': 'bg-[#1E8A5F]/10 text-[#1E8A5F] border-[#1E8A5F]/20',
    'Needs Review': 'bg-[#C08A1E]/10 text-[#C08A1E] border-[#C08A1E]/20',
    'High Risk': 'bg-[#B23A3A]/10 text-[#B23A3A] border-[#B23A3A]/20'
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-6 shadow-xs">
        <h1 className="text-xl font-bold text-[#1F2937]">Prescription Analysis History</h1>
        <p className="text-xs text-[#6B7280] mt-1">
          Search and review past verified prescription records, safety warnings, and RxScores
        </p>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name or OCR text..."
              className="w-full pl-9 pr-3 py-2 border border-[#E2E8E8] rounded bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
            <select
              value={bandFilter}
              onChange={(e) => setBandFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E2E8E8] rounded bg-[#F7F9FA] focus:bg-white text-xs text-[#1F2937]"
            >
              <option value="all">All Risk Bands</option>
              <option value="Safe">Safe (80-100)</option>
              <option value="Needs Review">Needs Review (50-79)</option>
              <option value="High Risk">High Risk (&lt;50)</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">Loading analysis records...</div>
        ) : analyses.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">
            No prescription records match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E2E8E8] rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F9FA] border-b border-[#E2E8E8] text-[#6B7280] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Age / Sex</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Medicines</th>
                  <th className="py-3 px-3">RxScore Band</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E8]">
                {analyses.map((record) => (
                  <tr key={record.id} className="hover:bg-[#F7F9FA] transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#1F2937]">
                      {record.patient_name || 'Anonymous Patient'}
                    </td>
                    <td className="py-3 px-3 text-[#6B7280]">
                      {record.patient_age ? `${record.patient_age} yrs` : 'N/A'} • {record.patient_gender || 'Unspecified'}
                    </td>
                    <td className="py-3 px-3 text-[#6B7280]">
                      {new Date(record.created_at).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-3 text-[#1F2937]">
                      {record.medicines?.length || 0} items
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold border ${bandColors[record.band] || 'bg-gray-100'}`}>
                        {record.rxscore}/100 ({record.band})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetail(record.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#E2E8E8] text-xs font-semibold text-[#0F6E6E] hover:bg-[#0F6E6E]/5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-1 rounded text-[#6B7280] hover:text-[#B23A3A] hover:bg-[#B23A3A]/10"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analysis Detail Modal */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-[#E2E8E8] p-6 max-w-3xl w-full shadow-lg max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E8]">
              <div>
                <h3 className="text-base font-bold text-[#1F2937]">
                  Prescription Record — {selectedRecord.patient_name}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  ID: {selectedRecord.id} • Saved {new Date(selectedRecord.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded border border-[#E2E8E8] text-xs font-semibold text-[#1F2937] hover:bg-[#F7F9FA] flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded hover:bg-[#F7F9FA] text-[#6B7280]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="py-4 space-y-4 text-xs">
              
              {/* Patient Info Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F7F9FA] p-3 rounded border border-[#E2E8E8]">
                <div>
                  <span className="text-[#6B7280] block font-medium">Patient Name</span>
                  <span className="font-semibold text-[#1F2937]">{selectedRecord.patient_name}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block font-medium">Age / Gender</span>
                  <span className="font-semibold text-[#1F2937]">{selectedRecord.patient_age || 'N/A'} / {selectedRecord.patient_gender || 'Unspecified'}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block font-medium">RxScore</span>
                  <span className="font-bold text-[#0F6E6E]">{selectedRecord.rxscore}/100 ({selectedRecord.band})</span>
                </div>
                <div>
                  <span className="text-[#6B7280] block font-medium">Allergies</span>
                  <span className="font-semibold text-[#1F2937]">{selectedRecord.allergies || 'None documented'}</span>
                </div>
              </div>

              {/* Verified Medicines List */}
              <div>
                <h4 className="font-bold text-[#1F2937] mb-2 uppercase tracking-wider text-[11px] text-[#6B7280]">
                  Verified Prescription Medicines ({selectedRecord.medicines?.length || 0})
                </h4>
                <div className="overflow-x-auto border border-[#E2E8E8] rounded">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F7F9FA] border-b border-[#E2E8E8] text-[#6B7280] font-semibold">
                        <th className="py-2 px-3">Medicine</th>
                        <th className="py-2 px-3">Strength</th>
                        <th className="py-2 px-3">Dosage / Form</th>
                        <th className="py-2 px-3">Frequency</th>
                        <th className="py-2 px-3">Route</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8E8]">
                      {selectedRecord.medicines?.map((m, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-[#1F2937]">{m.name}</td>
                          <td className="py-2 px-3 text-[#6B7280]">{m.strength || 'Not detected'}</td>
                          <td className="py-2 px-3 text-[#6B7280]">{m.dosage || 'Not detected'}</td>
                          <td className="py-2 px-3 text-[#6B7280]">{m.frequency || 'Not detected'}</td>
                          <td className="py-2 px-3 text-[#6B7280]">{m.route || 'Not detected'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clinical Alerts */}
              {selectedRecord.alerts && selectedRecord.alerts.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#1F2937] mb-2 uppercase tracking-wider text-[11px] text-[#6B7280]">
                    Identified Safety Alerts ({selectedRecord.alerts.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedRecord.alerts.map((alert, idx) => (
                      <div key={idx} className="bg-[#B23A3A]/5 border border-[#B23A3A]/20 p-2.5 rounded">
                        <span className="font-bold text-[#B23A3A] block">{alert.title}</span>
                        <p className="text-[#1F2937] mt-0.5">{alert.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gemini AI Review Section in History Modal */}
              {(selectedRecord as any).summary?.gemini_review && (
                <div className="bg-linear-to-br from-[#0F6E6E]/5 to-[#3B5BA5]/5 border border-[#0F6E6E]/20 p-3.5 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F6E6E] text-xs">Gemini AI Prescription Review</span>
                    <span className="bg-[#0F6E6E]/10 text-[#0F6E6E] font-bold px-2 py-0.5 rounded text-[10px]">
                      Risk: {(selectedRecord as any).summary.gemini_review.risk_level}
                    </span>
                  </div>
                  <p className="text-xs text-[#1F2937] leading-relaxed">
                    {(selectedRecord as any).summary.gemini_review.clinical_summary}
                  </p>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
