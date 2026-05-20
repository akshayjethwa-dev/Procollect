import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Filter, TrendingUp, Calendar } from 'lucide-react';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { cn } from '../../lib/utils';

// Types for our calculated leaderboard data
interface AgentPerformance {
  agentId: string;
  agentName: string;
  totalAssigned: number;
  totalCollected: number;
  totalDue: number;
  collectionRate: number;
}

type TimeFilter = 'week' | 'month' | 'all';

export default function LeaderboardScreen() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [leaderboard, setLeaderboard] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboardData();
  }, [timeFilter]);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found.");
      }

      // 1. Get the current manager's agencyId
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        throw new Error("User profile not found.");
      }

      const agencyId = userDocSnap.data().agencyId;
      if (!agencyId) {
        throw new Error("No agency associated with this account.");
      }

      // 2. Fetch only users belonging to this agency
      const usersQuery = query(
        collection(db, 'users'), 
        where('agencyId', '==', agencyId)
      );
      const usersSnap = await getDocs(usersQuery);
      
      const agentsMap = new Map<string, string>();
      usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        // Filter roles in memory to avoid needing a complex composite index immediately
        if (data.role === 'agent' || data.role === 'independent_agent') {
          agentsMap.set(docSnap.id, data.name || 'Unknown Agent');
        }
      });

      // 3. Fetch only customers belonging to this agency
      const customersQuery = query(
        collection(db, 'customers'), 
        where('agencyId', '==', agencyId)
      );
      const customersSnap = await getDocs(customersQuery);
      
      // Determine date threshold based on timeFilter
      const now = new Date();
      let dateThreshold = new Date(0); // 'all' time
      if (timeFilter === 'week') {
        dateThreshold = new Date(now.setDate(now.getDate() - 7));
      } else if (timeFilter === 'month') {
        dateThreshold = new Date(now.setMonth(now.getMonth() - 1));
      }

      const performanceMap = new Map<string, AgentPerformance>();

      // Initialize map with the filtered agents for this agency
      agentsMap.forEach((name, id) => {
        performanceMap.set(id, {
          agentId: id,
          agentName: name,
          totalAssigned: 0,
          totalCollected: 0,
          totalDue: 0,
          collectionRate: 0,
        });
      });

      // Calculate stats based on assigned customers
      customersSnap.forEach(docSnap => {
        const cust = docSnap.data();
        const agentId = cust.assignedAgentId;
        const recordDate = cust.updatedAt ? new Date(cust.updatedAt) : new Date(cust.createdAt);

        if (agentId && performanceMap.has(agentId) && recordDate >= dateThreshold) {
          const stats = performanceMap.get(agentId)!;
          stats.totalAssigned += 1;
          stats.totalCollected += (cust.totalReceivedAmount || 0);
          stats.totalDue += (cust.totalDueAmount || 0);
        }
      });

      // Calculate rates
      const calculatedData = Array.from(performanceMap.values()).map(stat => ({
        ...stat,
        collectionRate: stat.totalDue > 0 ? (stat.totalCollected / stat.totalDue) * 100 : 0
      }));

      // Sort primarily by total collected, then by collection rate
      calculatedData.sort((a, b) => b.totalCollected - a.totalCollected || b.collectionRate - a.collectionRate);

      setLeaderboard(calculatedData);
    } catch (err: any) {
      console.error("Error fetching leaderboard data:", err);
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0: return <div className="bg-yellow-100 text-yellow-600 p-2 rounded-full shadow-sm"><Trophy size={20} /></div>;
      case 1: return <div className="bg-gray-200 text-gray-500 p-2 rounded-full shadow-sm"><Medal size={20} /></div>;
      case 2: return <div className="bg-orange-100 text-amber-700 p-2 rounded-full shadow-sm"><Medal size={20} /></div>;
      default: return <div className="w-9 h-9 flex items-center justify-center font-bold text-slate-400 bg-slate-100 rounded-full">#{index + 1}</div>;
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="text-yellow-500" />
            Performance Leaderboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track agent collection rates and total recoveries.</p>
        </div>

        <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          {(['week', 'month', 'all'] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors",
                timeFilter === filter 
                  ? "bg-brand-600 text-white shadow-sm" 
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {filter === 'all' ? 'All Time' : `This ${filter}`}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">Loading rankings...</div>
        ) : error ? (
           <div className="p-8 text-center text-red-500">{error}</div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No agents found for your agency.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaderboard.map((agent, index) => (
              <div 
                key={agent.agentId} 
                className={cn(
                  "p-4 flex items-center gap-4 transition-colors hover:bg-slate-50",
                  index < 3 ? "bg-slate-50/50" : ""
                )}
              >
                {/* Rank Badge */}
                <div className="shrink-0 w-12 flex justify-center">
                  {getRankBadge(index)}
                </div>

                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                      {agent.agentName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 truncate">{agent.agentName}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <TrendingUp size={12} />
                        {agent.totalAssigned} records assigned
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="text-right shrink-0 min-w-30">
                  <p className="font-bold text-emerald-600 text-lg">
                    ₹{agent.totalCollected.toLocaleString('en-IN')}
                  </p>
                  
                  {/* Mini Progress Bar */}
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 flex overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full",
                        agent.collectionRate >= 75 ? "bg-emerald-500" : 
                        agent.collectionRate >= 40 ? "bg-amber-400" : "bg-red-400"
                      )} 
                      style={{ width: `${Math.min(agent.collectionRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-medium text-slate-500 mt-1 text-right">
                    {agent.collectionRate.toFixed(1)}% Collected
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}