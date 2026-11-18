import React, { useState, useEffect } from 'react';
import { 
  Database, Cloud, CheckCircle2, AlertCircle, RefreshCw, Copy, Check, 
  Key, Globe, ExternalLink, Code, Layers, Eye, EyeOff
} from 'lucide-react';
import { 
  getSupabaseCredentials, 
  saveSupabaseCredentials, 
  testSupabaseConnection, 
  generateSupabaseSqlSchema, 
  syncAllToSupabase 
} from '../utils/supabaseClient';
import { getPmsData } from '../utils/dummyData';

export default function SupabaseDatabaseCard() {
  const [uri, setUri] = useState('');
  const [showUri, setShowUri] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    dbName?: string;
    collections?: string[];
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [showSchemaViewer, setShowSchemaViewer] = useState(false);

  useEffect(() => {
    const creds = getSupabaseCredentials();
    setUri(creds.url);

    if (creds.url) {
      testSupabaseConnection(creds.url).then(setTestResult);
    }
  }, []);

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);
    setSyncResult(null);

    const trimmedUri = uri.trim();
    saveSupabaseCredentials(trimmedUri);

    if (!trimmedUri) {
      setTestResult({
        success: false,
        message: 'URI cleared. App is using default MongoDB Atlas cluster.'
      });
      return;
    }

    setTesting(true);
    const res = await testSupabaseConnection(trimmedUri, undefined, true);
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      setSyncing(true);
      const currentData = getPmsData();
      const syncRes = await syncAllToSupabase(currentData);
      setSyncing(false);
      if (syncRes.success) {
        setSyncResult({
          success: true,
          message: 'All local PMS hotel records were synced to MongoDB Atlas Cloud successfully!'
        });
        const refreshed = await testSupabaseConnection(trimmedUri);
        setTestResult(refreshed);
      }
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(uri.trim());
    setTesting(false);
    setTestResult(res);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const currentData = getPmsData();
    const res = await syncAllToSupabase(currentData);
    setSyncing(false);

    if (res.success) {
      setSyncResult({
        success: true,
        message: 'Manual sync complete! All hotels, rooms, bookings, check-ins, invoices, and expenses are backed up to MongoDB Atlas (database: "hotel").'
      });
      const refreshed = await testSupabaseConnection(uri.trim());
      setTestResult(refreshed);
    } else {
      setSyncResult({
        success: false,
        message: res.error || 'Sync failed. Please check your MongoDB Atlas connection string and IP Network Access.'
      });
    }
  };

  const handleCopySchema = () => {
    const schema = generateSupabaseSqlSchema();
    navigator.clipboard.writeText(schema);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 3000);
  };

  const isConnected = testResult?.success ?? false;

  return (
    <div className="bg-white border border-luxury-brown-100 rounded-3xl overflow-hidden shadow-sm space-y-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-luxury-brown-950 via-luxury-brown-900 to-luxury-brown-950 text-white p-6 border-b border-luxury-gold-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono uppercase tracking-wider">
            <Cloud className="w-3 h-3 text-emerald-400" /> MongoDB Atlas Cloud Engine
          </div>
          <h3 className="text-lg font-serif font-bold text-luxury-beige-50 flex items-center gap-2">
            MongoDB Atlas Cloud Database Connection
          </h3>
          <p className="text-luxury-brown-300 text-xs">
            Connected to <code className="text-luxury-gold-300">cluster0.hddqr9e.mongodb.net/hotel</code> — persists all bookings, rooms, check-ins, and invoices automatically in MongoDB Atlas.
          </p>
        </div>

        {/* Status Indicator Pill */}
        <div className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 shrink-0 ${
          isConnected
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
            : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{isConnected ? 'MongoDB Atlas Connected & Active' : 'Checking MongoDB Atlas...'}</span>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6">
        {/* Connection Form */}
        <form onSubmit={handleSaveConnection} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase text-luxury-brown-800 tracking-wide flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-luxury-gold-600" /> MongoDB Atlas Connection String (URI) *
            </label>
            <div className="relative">
              <input
                type={showUri ? 'text' : 'password'}
                required
                placeholder="mongodb+srv://username:password@cluster0.mongodb.net/hotel?retryWrites=true&w=majority"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                className="w-full text-xs font-mono bg-luxury-beige-50/60 border border-luxury-brown-200 rounded-xl pl-4 pr-10 py-2.5 text-luxury-brown-950 focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
              />
              <button
                type="button"
                onClick={() => setShowUri(!showUri)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-luxury-brown-500 hover:text-luxury-brown-800 cursor-pointer"
              >
                {showUri ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-luxury-brown-500">
              Active Cluster: <span className="font-mono font-semibold text-luxury-brown-800">cluster0.hddqr9e.mongodb.net</span> • Target Database: <span className="font-mono font-semibold text-luxury-brown-800">{testResult?.dbName || 'hotel'}</span>
            </p>
          </div>

          {/* Test & Save Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !uri}
                className="px-4 py-2 border border-luxury-brown-250 bg-white hover:bg-luxury-beige-50 text-luxury-brown-850 disabled:opacity-50 font-medium rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-luxury-gold-600" />}
                Test Connection
              </button>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                Sync All Data to MongoDB Now
              </button>
            </div>

            <button
              type="submit"
              disabled={testing}
              className="px-5 py-2.5 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-luxury-gold-400" /> Save & Sync MongoDB URI
            </button>
          </div>
        </form>

        {/* Test / Sync Result Banners */}
        {testResult && (
          <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1.5 flex-1">
              <p className="font-bold text-sm">
                {testResult.success ? 'MongoDB Atlas Connection Verified' : 'MongoDB Atlas Connection Issue'}
              </p>
              <p className="leading-relaxed">{testResult.message}</p>
              {testResult.collections && testResult.collections.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Active Collections ({testResult.collections.length}):
                  </span>
                  {testResult.collections.map((col) => (
                    <span
                      key={col}
                      className="px-2 py-0.5 bg-white border border-emerald-300 rounded-md font-mono text-[10px] text-emerald-900 font-semibold"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {syncResult && (
          <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
            syncResult.success
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <Cloud className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{syncResult.success ? 'MongoDB Atlas Synchronization Complete' : 'Sync Warning'}</p>
              <p className="mt-0.5">{syncResult.message}</p>
            </div>
          </div>
        )}

        {/* Collections Info Box */}
        <div className="bg-luxury-beige-50/80 border border-luxury-brown-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-serif font-bold text-sm text-luxury-brown-950 flex items-center gap-1.5">
                <Code className="w-4 h-4 text-luxury-gold-600" /> Auto-Managed MongoDB Collections
              </h4>
              <p className="text-[11px] text-luxury-brown-600 mt-0.5">
                Unlike SQL databases, MongoDB Atlas automatically creates all collections (<code className="font-mono">hotels</code>, <code className="font-mono">rooms</code>, <code className="font-mono">bookings</code>, <code className="font-mono">checkins</code>, <code className="font-mono">invoices</code>, etc.) inside the <strong>hotel</strong> database—no manual SQL script required!
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySchema}
                className="px-3.5 py-1.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSchema ? 'Copied!' : 'Copy Collections List'}
              </button>
              <a
                href="https://cloud.mongodb.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white border border-luxury-brown-250 hover:bg-luxury-beige-100 text-luxury-brown-900 font-medium rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                Open Atlas <ExternalLink className="w-3 h-3 text-luxury-gold-600" />
              </a>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowSchemaViewer(!showSchemaViewer)}
              className="text-xs font-mono font-bold text-luxury-gold-700 hover:text-luxury-gold-800 underline flex items-center gap-1 cursor-pointer"
            >
              {showSchemaViewer ? '▼ Hide Collections Overview' : '▶ View MongoDB Collections List'}
            </button>

            {showSchemaViewer && (
              <div className="mt-3 relative bg-luxury-brown-950 text-luxury-beige-100 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 overflow-y-auto border border-luxury-gold-500/30">
                <pre>{generateSupabaseSqlSchema()}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
