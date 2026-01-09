import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TradingSignal } from '../lib/types';
import { generateSignal, getCurrentSession, getTimeUntilNextInterval } from '../lib/signalGenerator';
import SignalCard from './SignalCard';
import SessionIndicator from './SessionIndicator';
import { Play, Pause, Trash2, Activity, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [currentSignal, setCurrentSignal] = useState<TradingSignal | null>(null);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [session, setSession] = useState(getCurrentSession());
  const [nextSignalIn, setNextSignalIn] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadSignals();

    const subscription = supabase
      .channel('trading_signals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_signals' }, () => {
        loadSignals();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSession(getCurrentSession());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;

    if (isAutoMode) {
      const scheduleNextSignal = () => {
        const timeUntil = getTimeUntilNextInterval();

        const updateCountdown = () => {
          const remaining = getTimeUntilNextInterval();
          const seconds = Math.floor(remaining / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          setNextSignalIn(`${minutes}:${secs.toString().padStart(2, '0')}`);
        };

        interval = setInterval(updateCountdown, 1000);
        updateCountdown();

        timeout = setTimeout(async () => {
          await generateAndSaveSignal();
          scheduleNextSignal();
        }, timeUntil);
      };

      scheduleNextSignal();
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setNextSignalIn('');
    };
  }, [isAutoMode]);

  const loadSignals = async () => {
    const { data, error } = await supabase
      .from('trading_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setSignals(data);
      if (data.length > 0) {
        const latest = data[0];
        const now = new Date();
        const endTime = new Date(latest.end_time);
        if (now < endTime) {
          setCurrentSignal(latest);
        } else {
          setCurrentSignal(null);
        }
      }
    }
  };

  const generateAndSaveSignal = async () => {
    setIsGenerating(true);
    const newSignal = generateSignal();

    if (newSignal) {
      const { data, error } = await supabase
        .from('trading_signals')
        .insert([newSignal])
        .select()
        .single();

      if (!error && data) {
        setCurrentSignal(data);
      }
    }
    setIsGenerating(false);
  };

  const clearHistory = async () => {
    const confirmed = window.confirm('Are you sure you want to clear all signal history?');
    if (confirmed) {
      await supabase.from('trading_signals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setSignals([]);
      setCurrentSignal(null);
    }
  };

  const toggleMode = () => {
    setIsAutoMode(!isAutoMode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Activity className="w-10 h-10 text-emerald-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              AI Trading Bot
            </h1>
          </div>
          <p className="text-slate-400 text-sm">M5 Binary Options Signal Generator</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <SessionIndicator session={session} />
          </div>

          <div className="bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">Mode</span>
              <button
                onClick={toggleMode}
                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  isAutoMode
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {isAutoMode ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Auto
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Manual
                  </>
                )}
              </button>
            </div>

            {isAutoMode && nextSignalIn && (
              <div className="bg-slate-900 rounded p-3 mb-3">
                <p className="text-xs text-slate-400 mb-1">Next Signal In:</p>
                <p className="text-2xl font-bold text-emerald-400">{nextSignalIn}</p>
              </div>
            )}

            {!isAutoMode && (
              <button
                onClick={generateAndSaveSignal}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:from-slate-700 disabled:to-slate-700 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-5 h-5" />
                {isGenerating ? 'Analyzing...' : 'Generate Signal'}
              </button>
            )}

            <button
              onClick={clearHistory}
              className="w-full mt-3 bg-red-900/30 hover:bg-red-900/50 border border-red-800 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          </div>
        </div>

        {currentSignal && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
              Active Signal
            </h2>
            <SignalCard signal={currentSignal} />
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold mb-4">Signal History</h2>
          {signals.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center border border-slate-700">
              <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No signals yet. Generate your first signal!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
