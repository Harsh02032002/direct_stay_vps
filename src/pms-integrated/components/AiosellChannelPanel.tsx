import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Send,
  RefreshCw,
  Copy,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Zap,
  Calendar,
} from 'lucide-react';
import { showToast } from '../../utils/toast';

interface AiosellChannelPanelProps {
  selectedHotelId: string;
  getAuthHeaders: () => Record<string, string>;
  onAfterSync?: () => void;
}

export const AiosellChannelPanel: React.FC<AiosellChannelPanelProps> = ({
  selectedHotelId,
  getAuthHeaders,
  onAfterSync,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [hotelCode, setHotelCode] = useState('sandbox-pms');
  const [pmsSlug, setPmsSlug] = useState('sample-pms');
  const [username, setUsername] = useState('aiosell');
  const [password, setPassword] = useState('AIOsell@123');
  const [webhookUrl, setWebhookUrl] = useState('https://directstay.online/api/ota/aiosell/webhook');

  // Push parameters (pre-filled with Aiosell Sandbox default roomCodes & rateplanCodes)
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(tomorrowIso);
  const [execAvail, setExecAvail] = useState<number>(4);
  const [suiteAvail, setSuiteAvail] = useState<number>(1);
  const [execSingleRate, setExecSingleRate] = useState<number>(1300);
  const [execDoubleRate, setExecDoubleRate] = useState<number>(1300);
  const [suiteSingleRate, setSuiteSingleRate] = useState<number>(2499.9);
  const [suiteDoubleRate, setSuiteDoubleRate] = useState<number>(2499.9);
  const [minStay, setMinStay] = useState<number>(1);
  const [maxStay, setMaxStay] = useState<number>(14);
  const [stopSell, setStopSell] = useState<boolean>(false);
  const [closeOnArrival, setCloseOnArrival] = useState<boolean>(false);
  const [closeOnDeparture, setCloseOnDeparture] = useState<boolean>(false);

  const [isSavingCfg, setIsSavingCfg] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState<any>(null);
  const [lastPushResult, setLastPushResult] = useState<any>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/ota/aiosell/config?hotelId=${encodeURIComponent(selectedHotelId)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.config) {
        setHotelCode(json.config.hotelCode || 'sandbox-pms');
        setPmsSlug(json.config.pmsSlug || 'sample-pms');
        setUsername(json.config.username || 'aiosell');
        if (json.productionWebhookUrl) setWebhookUrl(json.productionWebhookUrl);
      }
    } catch {
      // ignore initial fetch error
    }
  }, [selectedHotelId, getAuthHeaders]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = async () => {
    setIsSavingCfg(true);
    try {
      const res = await fetch('/api/ota/aiosell/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          hotelId: selectedHotelId,
          hotelCode,
          pmsSlug,
          username,
          password,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Aiosell Channel Manager configuration saved!', 'success');
      } else {
        showToast(json.error || 'Failed to save Aiosell settings', 'error');
      }
    } catch {
      showToast('Network error saving Aiosell configuration', 'error');
    } finally {
      setIsSavingCfg(false);
    }
  };

  const handlePushToAiosell = async (mode: 'INVENTORY' | 'RATES' | 'RESTRICTIONS' | 'FULL_ARI') => {
    setIsPushing(true);
    try {
      const res = await fetch('/api/ota/aiosell/push', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          hotelId: selectedHotelId,
          mode,
          startDate,
          endDate,
          config: { hotelCode, pmsSlug, username, password },
          rooms: [
            { roomCode: 'executive', available: execAvail },
            { roomCode: 'suite', available: suiteAvail },
          ],
          rates: [
            { roomCode: 'executive', rateplanCode: 'executive-s-ep', rate: execSingleRate },
            { roomCode: 'executive', rateplanCode: 'executive-d-ep', rate: execDoubleRate },
            { roomCode: 'suite', rateplanCode: 'suite-s-cp', rate: suiteSingleRate },
            { roomCode: 'suite', rateplanCode: 'suite-d-cp', rate: suiteDoubleRate },
          ],
          restrictions: {
            stopSell,
            minimumStay: minStay,
            maximumStay: maxStay,
            closeOnArrival,
            closeOnDeparture,
          },
        }),
      });
      const json = await res.json();
      setLastPushResult(json);
      if (json.success) {
        showToast(`Aiosell ${mode} push succeeded! Updates live on live.aiosell.com.`, 'success');
        onAfterSync?.();
      } else {
        showToast(json.error || 'Aiosell push returned an error — check response log below.', 'warning');
      }
    } catch {
      showToast('Network error pushing to Aiosell API', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const handleFetchLiveAiosell = async () => {
    setIsFetching(true);
    try {
      const res = await fetch('/api/ota/aiosell/fetch', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          hotelId: selectedHotelId,
          startDate,
          endDate,
          type: 'all',
          config: { hotelCode, pmsSlug, username, password },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setLiveSnapshot(json.data);
        showToast('Fetched live Inventory & Rates from Aiosell!', 'success');
      } else {
        showToast(json.error || 'Failed to fetch Aiosell calendar', 'error');
      }
    } catch {
      showToast('Network error fetching from Aiosell', 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSimulateWebhook = async (action: 'book' | 'modify' | 'cancel') => {
    setIsTestingWebhook(true);
    const sampleBookingId = 'AIO-SANDBOX-TEST-101';
    try {
      const res = await fetch(`/api/ota/aiosell/webhook?hotelId=${encodeURIComponent(selectedHotelId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${username}:${password}`),
        },
        body: JSON.stringify({
          action,
          hotelCode,
          bookingId: sampleBookingId,
          cmBookingId: 'CM-998877',
          channel: 'Booking.com',
          bookedOn: `${todayIso} 12:00:00`,
          checkin: startDate,
          checkout: endDate > startDate ? endDate : tomorrowIso,
          pah: false,
          amount: {
            amountBeforeTax: action === 'modify' ? 2800 : 2600,
            tax: action === 'modify' ? 140 : 130,
            amountAfterTax: action === 'modify' ? 2940 : 2730,
            currency: 'INR',
          },
          guest: {
            firstName: 'Aiosell',
            lastName: action === 'modify' ? 'Sandbox Guest (Modified)' : 'Sandbox Guest',
            phone: '9876543210',
            email: 'sandbox@aiosell.com',
          },
          rooms: [
            {
              roomCode: 'executive',
              rateplanCode: 'executive-d-ep',
              occupancy: { adults: 2, children: 0 },
              guestName: 'Aiosell Sandbox Guest',
            },
          ],
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Webhook [${action.toUpperCase()}] verified! Booking #${sampleBookingId} synced.`, 'success');
        onAfterSync?.();
      } else {
        showToast(json.message || 'Webhook test failed', 'error');
      }
    } catch {
      showToast('Network error testing Aiosell webhook', 'error');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#C49A3A]/40 shadow-sm p-4 sm:p-5 space-y-4">
      {/* Header + Copyable Webhook URL */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-mono font-extrabold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Official Aiosell 2-Way Channel Manager
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              All OTAs via 1 Hub (MMT, Goibibo, Booking.com, Agoda, Expedia, Airbnb)
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#C49A3A]" /> Aiosell REST API Connector &amp; Reservation Webhook
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-[#FAF7F2] px-3 py-2 rounded-xl border border-[#C49A3A]/40">
          <div className="text-[10.5px]">
            <span className="font-bold text-slate-600 block uppercase font-mono">Share Webhook URL with Aiosell:</span>
            <code className="font-mono font-bold text-slate-900 break-all">{webhookUrl}</code>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(webhookUrl);
              showToast('Aiosell Webhook URL copied to clipboard!', 'success');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#17120F] hover:bg-slate-800 text-[#E5C158] text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Copy className="w-3.5 h-3.5" /> Copy URL
          </button>
        </div>
      </div>

      {/* Row 1: Credentials & Mapping Config */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
        <div>
          <label className="font-bold text-slate-600 block mb-1 uppercase font-mono text-[10px]">Hotel Code *</label>
          <input
            type="text"
            value={hotelCode}
            onChange={(e) => setHotelCode(e.target.value)}
            placeholder="sandbox-pms"
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
          />
        </div>
        <div>
          <label className="font-bold text-slate-600 block mb-1 uppercase font-mono text-[10px]">PMS Partner Slug *</label>
          <input
            type="text"
            value={pmsSlug}
            onChange={(e) => setPmsSlug(e.target.value)}
            placeholder="sample-pms"
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
          />
        </div>
        <div>
          <label className="font-bold text-slate-600 block mb-1 uppercase font-mono text-[10px]">Basic Auth User</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
          />
        </div>
        <div>
          <label className="font-bold text-slate-600 block mb-1 uppercase font-mono text-[10px]">Basic Auth Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={isSavingCfg}
            onClick={handleSaveConfig}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSavingCfg ? 'Saving...' : 'Save Config'}</span>
          </button>
        </div>
      </div>

      {/* Row 2: Live Rate, Inventory & Restriction Push Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
        <div className="lg:col-span-4 p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
          <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600" /> 1. Date Range &amp; Inventory
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase block">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-600 block">executive Avail</label>
              <input
                type="number"
                min={0}
                value={execAvail}
                onChange={(e) => setExecAvail(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-2.5 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-600 block">suite Avail</label>
              <input
                type="number"
                min={0}
                value={suiteAvail}
                onChange={(e) => setSuiteAvail(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-2.5 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
          <div className="font-extrabold text-slate-800">2. Rate Plans (₹ INR)</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-slate-500 block">executive-s-ep (₹)</label>
              <input
                type="number"
                min={0}
                value={execSingleRate}
                onChange={(e) => setExecSingleRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 block">executive-d-ep (₹)</label>
              <input
                type="number"
                min={0}
                value={execDoubleRate}
                onChange={(e) => setExecDoubleRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 block">suite-s-cp (₹)</label>
              <input
                type="number"
                min={0}
                value={suiteSingleRate}
                onChange={(e) => setSuiteSingleRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 block">suite-d-cp (₹)</label>
              <input
                type="number"
                min={0}
                value={suiteDoubleRate}
                onChange={(e) => setSuiteDoubleRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
          <div className="font-extrabold text-slate-800">3. Restrictions</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-slate-500 block">Min Stay</label>
              <input
                type="number"
                min={1}
                value={minStay}
                onChange={(e) => setMinStay(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 block">Max Stay</label>
              <input
                type="number"
                min={1}
                value={maxStay}
                onChange={(e) => setMaxStay(Math.max(1, parseInt(e.target.value, 10) || 14))}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={stopSell} onChange={(e) => setStopSell(e.target.checked)} className="accent-rose-600" />
              <span>Stop Sell</span>
            </label>
            <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={closeOnArrival} onChange={(e) => setCloseOnArrival(e.target.checked)} className="accent-amber-600" />
              <span>CTA</span>
            </label>
            <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={closeOnDeparture} onChange={(e) => setCloseOnDeparture(e.target.checked)} className="accent-amber-600" />
              <span>CTD</span>
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPushing}
            onClick={() => handlePushToAiosell('FULL_ARI')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPushing ? 'Pushing to Aiosell...' : 'Push Rate + Inventory + Restrictions'}</span>
          </button>
          <button
            type="button"
            disabled={isFetching}
            onClick={handleFetchLiveAiosell}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Pull Live Aiosell Data</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-mono font-bold text-slate-500 uppercase mr-1">Webhook Self-Test:</span>
          {(['book', 'modify', 'cancel'] as const).map((act) => (
            <button
              key={act}
              type="button"
              disabled={isTestingWebhook}
              onClick={() => handleSimulateWebhook(act)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-mono font-bold text-[11px] uppercase cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-amber-600" /> {act}
            </button>
          ))}
        </div>
      </div>

      {/* Live Response / Calendar Preview */}
      {(lastPushResult || liveSnapshot) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
          {lastPushResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Last Aiosell Push Response
              </div>
              <pre className="text-[10.5px] font-mono text-slate-700 overflow-x-auto max-h-36 bg-white p-2 rounded border border-slate-200">
                {JSON.stringify(lastPushResult.steps || lastPushResult, null, 2)}
              </pre>
            </div>
          )}
          {liveSnapshot && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" /> Live Aiosell Sandbox Calendar Data
              </div>
              <pre className="text-[10.5px] font-mono text-slate-700 overflow-x-auto max-h-36 bg-white p-2 rounded border border-slate-200">
                {JSON.stringify(liveSnapshot, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default AiosellChannelPanel;
