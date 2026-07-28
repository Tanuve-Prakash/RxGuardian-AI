import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/Dashboard/StatCard';
import { getDashboardStatsApi, getHistoryApi } from '../../services/analysis';
import { DashboardStats, AnalysisRecord } from '../../types';
import { PlusCircle, FileCheck, AlertTriangle, ShieldCheck, History, ArrowRight, Activity } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsData, historyData] = await Promise.all([
        getDashboardStatsApi(),
        getHistoryApi()
      ]);

      setStats(statsData);
      setRecentAnalyses(historyData.analyses.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const bandColors = {
    'Safe': 'bg-[#1E8A5F]/10 text-[#1E8A5F] border-[#1E8A5F]/20',
    'Needs Review': 'bg-[#C08A1E]/10 text-[#C08A1E] border-[#C08A1E]/20',
    'High Risk': 'bg-[#B23A3A]/10 text-[#B23A3A] border-[#B23A3A]/20'
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937]">Clinical Dashboard</h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Real-time prescription analysis history, risk scoring, and active alert metrics
          </p>
        </div>

        <Link
          to="/new-analysis"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#0F6E6E] text-white text-xs font-semibold hover:bg-[#0F6E6E]/90 transition-colors shadow-xs shrink-0 self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Start New Prescription Analysis
        </Link>
      </div>

      {/* Stats Cards Grid (Real numbers from DB!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Prescriptions"
          value={isLoading ? '-' : (stats?.total_analyzed ?? 0)}
          description="Total records analyzed"
          icon={FileCheck}
        />
        <StatCard
          title="Alerts Flagged"
          value={isLoading ? '-' : (stats?.alerts_flagged ?? 0)}
          description="Total clinical flags"
          icon={AlertTriangle}
          badgeText={stats?.alerts_flagged ? `${stats.alerts_flagged} Alerts` : 'None'}
          badgeColor={stats?.alerts_flagged ? 'warning' : 'safe'}
        />
        <StatCard
          title="Average RxScore"
          value={isLoading ? '-' : (stats?.average_rxscore ? `${stats.average_rxscore}/100` : 'N/A')}
          description="Mean clinical risk score"
          icon={ShieldCheck}
          badgeText={stats?.average_rxscore ? (stats.average_rxscore >= 80 ? 'Safe' : stats.average_rxscore >= 50 ? 'Review' : 'High Risk') : 'No Data'}
          badgeColor={stats?.average_rxscore ? (stats.average_rxscore >= 80 ? 'safe' : stats.average_rxscore >= 50 ? 'warning' : 'danger') : 'neutral'}
        />
        <StatCard
          title="Top Alert Type"
          value={isLoading ? '-' : (stats?.most_common_alert || 'None')}
          description="Most frequent alert"
          icon={Activity}
        />
      </div>

      {/* Recent Analyses List */}
      <div className="bg-white rounded-lg border border-[#E2E8E8] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#1F2937]">Recent Prescription Analyses</h2>
            <p className="text-xs text-[#6B7280]">Latest verified prescriptions saved in your clinic database</p>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-[#0F6E6E] hover:underline flex items-center gap-1"
          >
            View All History <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">Loading clinical history...</div>
        ) : recentAnalyses.length === 0 ? (
          <div className="border-2 border-dashed border-[#E2E8E8] rounded-lg p-8 text-center bg-[#F7F9FA]">
            <History className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#1F2937]">No prescription analyses recorded yet</p>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
              Run your first analysis to extract medicines, evaluate drug interactions, and generate an RxScore.
            </p>
            <Link
              to="/new-analysis"
              className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 rounded-md bg-[#0F6E6E] text-white text-xs font-semibold hover:bg-[#0F6E6E]/90"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Start First Analysis
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E2E8E8] rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F9FA] border-b border-[#E2E8E8] text-[#6B7280] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Patient Name</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Medicines</th>
                  <th className="py-3 px-3">Alerts</th>
                  <th className="py-3 px-3">RxScore</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E8]">
                {recentAnalyses.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F7F9FA] transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#1F2937]">
                      {item.patient_name || 'Anonymous Patient'}
                    </td>
                    <td className="py-3 px-3 text-[#6B7280]">
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-3 text-[#1F2937]">
                      {item.medicines?.length || 0} items
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        item.alerts?.length > 0 ? 'bg-[#C08A1E]/10 text-[#C08A1E]' : 'bg-[#1E8A5F]/10 text-[#1E8A5F]'
                      }`}>
                        {item.alerts?.length || 0} Flags
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold border ${bandColors[item.band] || 'bg-gray-100'}`}>
                        {item.rxscore}/100 ({item.band})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to="/history"
                        className="text-xs font-semibold text-[#0F6E6E] hover:underline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
