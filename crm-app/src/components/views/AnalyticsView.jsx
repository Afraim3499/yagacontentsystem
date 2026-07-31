import React from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function AnalyticsView({ conversions }) {
  const chartData = conversions.map(c => ({
    name: c.refCode.replace('ref_', ''),
    Clicks: c.clicks,
    Joins: c.freeJoins,
    VIPConversions: c.vipConversions
  }));

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2">
          <span className="badge badge-emerald">Growth & ROI</span>
          <span className="text-xs text-slate-400 font-mono">Conversion Attribution Engine</span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          Traffic Source Attribution & VIP Conversion Analytics
        </h2>
        <p className="text-xs text-slate-400">
          Track referral links, free Telegram group joins, VIP memberships, and revenue generated per platform/creator.
        </p>
      </div>

      {/* Analytics Chart */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          Funnel Performance: Clicks vs Free Joins vs VIP Conversions
        </h3>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="Clicks" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Joins" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="VIPConversions" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attribution Referral Table */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Referral Link ROI Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th className="p-3">Ref Code</th>
                <th className="p-3">Creator</th>
                <th className="p-3">Platform</th>
                <th className="p-3">Total Clicks</th>
                <th className="p-3">Free Group Joins</th>
                <th className="p-3">VIP Conversions</th>
                <th className="p-3">Est. Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {conversions.map((conv) => (
                <tr key={conv.refCode} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-bold text-cyan-400">{conv.refCode}</td>
                  <td className="p-3 font-sans text-white">{conv.creatorId}</td>
                  <td className="p-3 font-bold text-indigo-400">{conv.platformId}</td>
                  <td className="p-3 text-slate-300">{conv.clicks.toLocaleString()}</td>
                  <td className="p-3 text-cyan-300 font-bold">{conv.freeJoins}</td>
                  <td className="p-3 text-emerald-400 font-bold">{conv.vipConversions}</td>
                  <td className="p-3 font-bold text-emerald-300">{conv.estimatedRevenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
