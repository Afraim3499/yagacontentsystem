import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardView from './components/views/DashboardView';
import ContentStudioView from './components/views/ContentStudioView';
import CreatorsAccountsView from './components/views/CreatorsAccountsView';
import PlatformsPlaybooksView from './components/views/PlatformsPlaybooksView';
import ActivityLogsView from './components/views/ActivityLogsView';
import EngagementDeskView from './components/views/EngagementDeskView';
import IssueDeskView from './components/views/IssueDeskView';
import AnalyticsView from './components/views/AnalyticsView';
import SettingsView from './components/views/SettingsView';
import MemberTrackingDeskView from './components/views/MemberTrackingDeskView';
import ReviewModerationDeskView from './components/views/ReviewModerationDeskView';
import VipMembersDeskView from './components/views/VipMembersDeskView';
import TradeSignalsDeskView from './components/views/TradeSignalsDeskView';
import AffiliatesDeskView from './components/views/AffiliatesDeskView';
import CrmLockScreen from './components/CrmLockScreen';

function toCreator(row, voiceRow) {
  return {
    id: row.id,
    realName: row.real_name,
    publicName: row.public_name,
    title: row.title || '',
    telegramHandle: row.telegram_handle || '',
    telegramChatId: row.telegram_chat_id || '',
    email: row.email || '',
    active: row.active,
    startDate: row.start_date,
    assignedPlatforms: [],
    voiceProfile: voiceRow ? {
      tone: voiceRow.tone || '',
      sentenceLength: voiceRow.sentence_length || '',
      vocabulary: voiceRow.vocabulary || '',
      humor: voiceRow.humor || '',
      ctaStyle: voiceRow.cta_style || ''
    } : { tone: '', sentenceLength: '', vocabulary: '', humor: '', ctaStyle: '' }
  };
}

function toPlatform(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    dailyPostsReq: row.daily_posts_req,
    articleFreq: row.article_freq,
    engagementReq: row.engagement_req,
    status: row.status
  };
}

function toAccount(row) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    platformId: row.platform_id,
    handle: row.handle,
    status: row.status,
    postingReady: row.posting_ready
  };
}

function toIssue(row) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    platformId: row.platform_id,
    platformName: row.platform_id,
    accountId: row.account_id || '',
    issueType: row.issue_type,
    description: row.description,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : '',
    ownerResponse: row.owner_response
  };
}

function toConversion(row) {
  return {
    refCode: row.ref_code,
    creatorId: row.creator_id,
    platformId: row.platform_id,
    clicks: row.clicks,
    freeJoins: row.free_joins,
    vipConversions: row.vip_conversions,
    estimatedRevenue: `$${Number(row.estimated_revenue).toLocaleString()}`
  };
}

function toTask(row) {
  return {
    id: row.id,
    batch: row.batch_number,
    creatorId: row.creator_id,
    creatorName: '',
    platformId: row.platform_id,
    platformName: '',
    slot: row.scheduled_time || '',
    publishTime: row.scheduled_time || '',
    status: row.status,
    caption: row.caption,
    imageLink: row.asset_link || null
  };
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("yaga_crm_authenticated") === "true";
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Supabase state
  const [creators, setCreators] = useState([]);
  const [owners, setOwners] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [issues, setIssues] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const [systemSettings, setSystemSettings] = useState({
    companyName: "Yaga Calls Operations",
    systemPhase: "CONTENT_ACTIVE",
    timezone: "UTC+6",
    ownerTelegramChatId: "1617457685",
    botUsername: "@yagacontentbot",
    activeCreatorsCount: 0,
    activePlatformsCount: 0,
    contentOperationsStatus: "UNLOCKED",
    staggeredBatchIntervalMinutes: 30,
    autoActivationGatePercent: 100,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── FETCH ALL DATA FROM SUPABASE ON MOUNT ──
  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    try {
      // Fetch system_phase from system_config
      const { data: configData } = await supabase.from('system_config').select('*').eq('key', 'system_phase');
      const livePhase = configData && configData[0] ? configData[0].value : 'CONTENT_ACTIVE';

      // Fetch creators + voice profiles
      const { data: creatorsData } = await supabase.from('creators').select('*').order('id');
      const { data: voiceData } = await supabase.from('voice_profiles').select('*');
      const { data: accountsData } = await supabase.from('accounts').select('*').order('id');

      const voiceMap = {};
      (voiceData || []).forEach(v => { voiceMap[v.creator_id] = v; });

      const mappedCreators = (creatorsData || []).map(c => {
        const cr = toCreator(c, voiceMap[c.id]);
        cr.assignedPlatforms = (accountsData || [])
          .filter(a => a.creator_id === c.id)
          .map(a => a.platform_id);
        return cr;
      });

      setCreators(mappedCreators);
      setAccounts((accountsData || []).map(toAccount));

      // Fetch owners
      const { data: ownersData } = await supabase.from('owners').select('*').order('created_at');
      setOwners(ownersData || []);

      // Fetch platforms
      const { data: platformsData } = await supabase.from('platforms').select('*').order('id');
      setPlatforms((platformsData || []).map(toPlatform));

      // Fetch issues
      const { data: issuesData } = await supabase.from('issue_tickets').select('*').order('created_at', { ascending: false });
      setIssues((issuesData || []).map(toIssue));

      // Fetch conversions
      const { data: convsData } = await supabase.from('referral_conversions').select('*');
      setConversions((convsData || []).map(toConversion));

      // Fetch today's tasks
      const today = new Date().toISOString().split('T')[0];
      const dayId = `DAY-${today.replace(/-/g, '')}`;
      const { data: tasksData } = await supabase.from('assignment_queue').select('*').eq('day_id', dayId).order('created_at');
      
      const mappedTasks = (tasksData || []).map(t => {
        const task = toTask(t);
        const creator = (creatorsData || []).find(c => c.id === t.creator_id);
        const platform = (platformsData || []).find(p => p.id === t.platform_id);
        task.creatorName = creator?.public_name || t.creator_id;
        task.platformName = platform?.name || t.platform_id;
        return task;
      });
      setTasks(mappedTasks);

      // Update system settings counts & live phase
      setSystemSettings(prev => ({
        ...prev,
        systemPhase: livePhase,
        activeCreatorsCount: mappedCreators.filter(c => c.active).length,
        activePlatformsCount: (platformsData || []).filter(p => p.status === 'Active').length
      }));

    } catch (err) {
      console.error('Error fetching Supabase data:', err);
      showToast('⚠️ Error connecting to Supabase. Check console.');
    }
    setLoading(false);
  }

  // ── SUPABASE REALTIME SUBSCRIPTIONS & BROWSER VISIBILITY RE-SYNC ──
  useEffect(() => {
    const channel = supabase
      .channel('live-crm-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creators' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owners' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_queue' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_tickets' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, () => fetchAllData())
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAllData(); // Instant re-sync when laptop wakes up or tab is focused!
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ── BUILD DAILY BATCH OBJECT ──
  const today = new Date().toISOString().split('T')[0];
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const totalTasks = tasks.length;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const batch1Tasks = tasks.filter(t => t.batch === 1);
  const batch2Tasks = tasks.filter(t => t.batch === 2);
  const batch3Tasks = tasks.filter(t => t.batch === 3);

  const batchStatus = (batchTasks) => {
    if (batchTasks.length === 0) return 'PENDING';
    if (batchTasks.every(t => t.status === 'Completed')) return 'COMPLETED';
    if (batchTasks.some(t => t.status === 'Delivered' || t.status === 'Completed')) return 'IN_PROGRESS';
    return 'PENDING';
  };

  const dailyBatch = {
    dayId: `DAY-${today.replace(/-/g, '')}`,
    date: today,
    status: totalTasks > 0 ? 'SENT' : 'Draft',
    totalAssignments: totalTasks,
    batch1Status: batchStatus(batch1Tasks),
    batch2Status: batchStatus(batch2Tasks),
    batch3Status: batchStatus(batch3Tasks),
    completionPercent,
    tasks
  };

  // ── EVENT HANDLERS ──
  const handlePhaseToggle = async () => {
    const phases = ['CONTENT_ACTIVE', 'PLATFORM_ONBOARDING', 'PAUSED'];
    const currentIndex = phases.indexOf(systemSettings.systemPhase);
    const nextPhase = phases[(currentIndex + 1) % phases.length];
    
    setSystemSettings(prev => ({ ...prev, systemPhase: nextPhase }));

    // Persist to Supabase system_config
    await supabase.from('system_config').upsert({
      key: 'system_phase',
      value: nextPhase,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    showToast(`System Phase updated & saved: ${nextPhase.replace(/_/g, ' ')}`);
  };

  const handleSendToTeam = () => {
    if (systemSettings.systemPhase === 'PAUSED') {
      showToast("⚠️ System Phase is currently PAUSED. Switch Phase to CONTENT ACTIVE to enable dispatches.");
      return;
    }
    showToast("🚀 3-Batch Staggered Distribution initiated! Batch 1 sent immediately. Batch 2 (+30m) & Batch 3 (+60m) queued.");
  };

  const handleResolveIssue = async (issueId, responseText) => {
    setIssues(prev => prev.map(iss => {
      if (iss.id === issueId) {
        return { ...iss, status: 'RESOLVED', ownerResponse: responseText };
      }
      return iss;
    }));
    showToast(`Issue ${issueId} resolved and response sent to creator via Telegram.`);
  };

  const openIssuesCount = issues.filter(i => i.status === 'OPEN').length;

  if (!isAuthenticated) {
    return <CrmLockScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#e39e2e] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#e39e2e] font-bold text-sm uppercase tracking-widest">Connecting to Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Fixed Navbar */}
      <Navbar 
        systemSettings={systemSettings} 
        activeBatch={dailyBatch}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onPhaseToggle={handlePhaseToggle}
      />

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-16 sm:bottom-6 right-3 sm:right-6 z-50 glass-panel p-3.5 sm:p-4 max-w-md bg-[#0f141d]/95 border border-[#e39e2e]/50 shadow-2xl rounded-2xl flex items-center gap-3">
          <span className="text-xl">⚡️</span>
          <p className="text-xs font-semibold text-slate-100 leading-snug">{toastMessage}</p>
        </div>
      )}

      {/* Main Body Layout */}
      <div className="flex-1 flex gap-4 md:gap-6 px-3.5 sm:px-6 pb-20 md:pb-6 max-w-[1800px] w-full mx-auto">
        {/* Left Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          openIssuesCount={openIssuesCount}
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Right Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView 
              systemSettings={systemSettings}
              creators={creators}
              platforms={platforms}
              accounts={accounts}
              dailyBatch={dailyBatch}
              issues={issues}
              onPhaseToggle={handlePhaseToggle}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'studio' && (
            <ContentStudioView 
              creators={creators}
              platforms={platforms}
              accounts={accounts}
              conversions={conversions}
              onDispatchBatchSuccess={fetchAllData}
            />
          )}

          {activeTab === 'signals' && (
            <TradeSignalsDeskView />
          )}

          {activeTab === 'affiliates' && (
            <AffiliatesDeskView />
          )}

          {activeTab === 'vip' && (
            <VipMembersDeskView />
          )}

          {activeTab === 'members' && (
            <MemberTrackingDeskView />
          )}

          {activeTab === 'reviews' && (
            <ReviewModerationDeskView />
          )}

          {activeTab === 'creators' && (
            <CreatorsAccountsView 
              creators={creators}
              owners={owners}
              accounts={accounts}
              platforms={platforms}
              onRefreshData={fetchAllData}
            />
          )}

          {activeTab === 'playbooks' && (
            <PlatformsPlaybooksView 
              platforms={platforms}
            />
          )}

          {activeTab === 'logs' && (
            <ActivityLogsView 
              creators={creators}
              platforms={platforms}
            />
          )}

          {activeTab === 'engagement' && (
            <EngagementDeskView 
              creators={creators}
            />
          )}

          {activeTab === 'issues' && (
            <IssueDeskView 
              issues={issues}
              onResolveIssue={handleResolveIssue}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView 
              conversions={conversions}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              systemSettings={systemSettings}
              owners={owners}
              onSaveSettings={(newSettings) => {
                setSystemSettings(prev => ({ ...prev, ...newSettings }));
                showToast("System settings updated cleanly.");
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
