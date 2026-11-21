import sys

with open('src/components/CheckInFormView.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update React import
old_import = "import React, { useState, useEffect } from 'react';"
new_import = "import React, { useState, useEffect, useMemo } from 'react';"
if old_import in c:
    c = c.replace(old_import, new_import, 1)
    print('1. Updated React import')

# 2. Add stayHours state
old_state = "const [customExtraRows, setCustomExtraRows] = useState<Array<{ id: string; label: string; qty: number | ''; rate: number | '' }>>([]);"
new_state = old_state + "\n  const [stayHours, setStayHours] = useState<number | ''>('');"
if old_state in c and "const [stayHours, setStayHours]" not in c:
    c = c.replace(old_state, new_state, 1)
    print('2. Added stayHours state')

# 3. Add same-day stay logic & hours computation
old_stay_days = """  const todayIstStr = getTodayDateStr();
  const stayNights = calcStayDays(checkInDate, checkOutDate);
  const isEditingExistingDates = Boolean(editingCheckIn || selectedBooking);
  const isFutureAdvanceArrival = Boolean(!editingCheckIn && !selectedBooking && checkInDate > todayIstStr);"""

new_stay_days = """  const todayIstStr = getTodayDateStr();
  const stayNights = calcStayDays(checkInDate, checkOutDate);
  const isEditingExistingDates = Boolean(editingCheckIn || selectedBooking);
  const isFutureAdvanceArrival = Boolean(!editingCheckIn && !selectedBooking && checkInDate > todayIstStr);
  const isSameDayStay = Boolean(checkInDate && checkOutDate && checkInDate === checkOutDate);

  const computedStayHours = useMemo(() => {
    if (!isSameDayStay) return null;
    try {
      const nowIst = getIstNowParts();
      const in24 = to24hTime(arrivalTime, nowIst.hhmm);
      const out24 = to24hTime(departureTime, '18:00');
      const [inH, inM] = in24.split(':').map(Number);
      const [outH, outM] = out24.split(':').map(Number);
      const diffMin = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMin <= 0) return 3;
      return Math.max(1, Math.round(diffMin / 60));
    } catch {
      return 3;
    }
  }, [isSameDayStay, arrivalTime, departureTime]);

  const handleSelectStayHours = (hrs: number) => {
    setStayHours(hrs);
    try {
      const nowIst = getIstNowParts();
      const in24 = to24hTime(arrivalTime, nowIst.hhmm);
      const [inH, inM] = in24.split(':').map(Number);
      let outTotalMinutes = inH * 60 + inM + hrs * 60;
      if (outTotalMinutes >= 24 * 60) {
        outTotalMinutes = 23 * 60 + 59;
      }
      const outH = Math.floor(outTotalMinutes / 60);
      const outM = outTotalMinutes % 60;
      const hhmm = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
      setDepartureTime(to12hTime(hhmm, '06:00 PM'));
    } catch {
      // fallback
    }
  };"""

if old_stay_days in c:
    c = c.replace(old_stay_days, new_stay_days, 1)
    print('3. Added isSameDayStay & computedStayHours')

# 4. Update handleArrivalDateChange & handleDepartureDateChange
old_handlers = """  const handleArrivalDateChange = (rawNewDate: string) => {
    if (!rawNewDate) return;
    const todayIst = getTodayDateStr();
    let nextIn = rawNewDate;
    if (!isEditingExistingDates && nextIn < todayIst) {
      nextIn = todayIst;
      showToast('Past arrival dates cannot be selected for new bookings.', 'warning');
    }
    const prevDuration = Math.max(1, calcStayDays(checkInDate, checkOutDate));
    setCheckInDate(nextIn);
    if (!checkOutDate || nextIn >= checkOutDate) {
      setCheckOutDate(getFutureDateStr(prevDuration, nextIn));
    }
    // Prevent past time if switching back to today on a new booking
    if (!isEditingExistingDates && nextIn === todayIst) {
      const nowIst = getIstNowParts();
      if (to24hTime(arrivalTime, nowIst.hhmm) < nowIst.hhmm) {
        setArrivalTime(nowIst.displayTime);
      }
    }
  };

  const handleArrivalTimeChange = (newHhmm: string) => {
    if (!newHhmm) return;
    const todayIst = getTodayDateStr();
    const nowIst = getIstNowParts();
    if (!isEditingExistingDates && checkInDate === todayIst && newHhmm < nowIst.hhmm) {
      setArrivalTime(nowIst.displayTime);
      showToast('Past arrival time cannot be selected for today\\'s new booking.', 'warning');
      return;
    }
    setArrivalTime(to12hTime(newHhmm, nowIst.displayTime));
  };

  const handleDepartureDateChange = (rawNewOut: string) => {
    if (!rawNewOut) return;
    const minOut = getFutureDateStr(1, checkInDate || getTodayDateStr());
    if (rawNewOut <= checkInDate) {
      setCheckOutDate(minOut);
      showToast('Departure date must always be later than arrival date.', 'warning');
      return;
    }
    setCheckOutDate(rawNewOut);
  };"""

new_handlers = """  const handleArrivalDateChange = (rawNewDate: string) => {
    if (!rawNewDate) return;
    const todayIst = getTodayDateStr();
    let nextIn = rawNewDate;
    if (!isEditingExistingDates && nextIn < todayIst) {
      nextIn = todayIst;
      showToast('Past arrival dates cannot be selected for new bookings.', 'warning');
    }
    const prevDuration = Math.max(1, calcStayDays(checkInDate, checkOutDate));
    setCheckInDate(nextIn);
    if (!checkOutDate || nextIn > checkOutDate) {
      setCheckOutDate(isSameDayStay ? nextIn : getFutureDateStr(prevDuration, nextIn));
    }
    // Prevent past time if switching back to today on a new booking
    if (!isEditingExistingDates && nextIn === todayIst) {
      const nowIst = getIstNowParts();
      if (to24hTime(arrivalTime, nowIst.hhmm) < nowIst.hhmm) {
        setArrivalTime(nowIst.displayTime);
      }
    }
  };

  const handleArrivalTimeChange = (newHhmm: string) => {
    if (!newHhmm) return;
    const todayIst = getTodayDateStr();
    const nowIst = getIstNowParts();
    if (!isEditingExistingDates && checkInDate === todayIst && newHhmm < nowIst.hhmm) {
      setArrivalTime(nowIst.displayTime);
      showToast('Past arrival time cannot be selected for today\\'s new booking.', 'warning');
      return;
    }
    setArrivalTime(to12hTime(newHhmm, nowIst.displayTime));
  };

  const handleDepartureDateChange = (rawNewOut: string) => {
    if (!rawNewOut) return;
    if (rawNewOut < checkInDate) {
      setCheckOutDate(checkInDate);
      showToast('Departure date cannot be earlier than arrival date.', 'warning');
      return;
    }
    setCheckOutDate(rawNewOut);
    if (rawNewOut === checkInDate && !stayHours) {
      setStayHours(3);
    }
  };"""

if old_handlers in c:
    c = c.replace(old_handlers, new_handlers, 1)
    print('4. Updated arrival/departure handlers')
else:
    print('4. old_handlers not found exactly')

# 5. Update Stay & Rate Row 1 JSX
old_row1 = """                    {/* Row 1: Choose Date (Arrival) | Departure | Nights | Source */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#263449]">
                            Choose Date <span className="text-[#A8812B]">*</span>
                          </label>
                          <span className="text-[10px] font-mono font-bold text-[#8B691E]">
                            {formatDdmmyyyy(checkInDate)} / {arrivalTime}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_102px] gap-1.5">
                          <input
                            type="date"
                            required
                            min={!isEditingExistingDates ? todayIstStr : undefined}
                            value={checkInDate}
                            onChange={e => handleArrivalDateChange(e.target.value)}
                            className="w-full px-2.5 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                          <input
                            type="time"
                            value={to24hTime(arrivalTime, getIstNowParts().hhmm)}
                            min={!isEditingExistingDates && checkInDate === todayIstStr ? getIstNowParts().hhmm : undefined}
                            onChange={e => handleArrivalTimeChange(e.target.value)}
                            className="w-full px-2 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#263449]">
                            Departure <span className="text-[#A8812B]">*</span>
                          </label>
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            {formatDdmmyyyy(checkOutDate)} / {departureTime}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_102px] gap-1.5">
                          <input
                            type="date"
                            required
                            min={getFutureDateStr(1, checkInDate || todayIstStr)}
                            value={checkOutDate}
                            onChange={e => handleDepartureDateChange(e.target.value)}
                            className="w-full px-2.5 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                          <input
                            type="time"
                            value={to24hTime(departureTime, to24hTime(hotelSettings?.checkOutTime, '11:00'))}
                            onChange={e => handleDepartureTimeChange(e.target.value)}
                            className="w-full px-2 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-1 space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Nights</label>
                        <div className="py-2 px-2 rounded-xl border border-[#DCE3EC] bg-[#F4F6F9] text-center text-xs font-mono font-extrabold text-[#263449] whitespace-nowrap">
                          {stayNights} nt{stayNights > 1 ? 's' : ''}
                        </div>
                      </div>"""

new_row1 = """                    {/* Row 1: Choose Date (Arrival) | Departure | Nights/Hours | Source */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#263449]">
                            Choose Date <span className="text-[#A8812B]">*</span>
                          </label>
                          <span className="text-[10px] font-mono font-bold text-[#8B691E]">
                            {formatDdmmyyyy(checkInDate)} / {arrivalTime}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_102px] gap-1.5">
                          <input
                            type="date"
                            required
                            min={!isEditingExistingDates ? todayIstStr : undefined}
                            value={checkInDate}
                            onChange={e => handleArrivalDateChange(e.target.value)}
                            className="w-full px-2.5 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                          <input
                            type="time"
                            value={to24hTime(arrivalTime, getIstNowParts().hhmm)}
                            min={!isEditingExistingDates && checkInDate === todayIstStr ? getIstNowParts().hhmm : undefined}
                            onChange={e => handleArrivalTimeChange(e.target.value)}
                            className="w-full px-2 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#263449]">
                            Departure <span className="text-[#A8812B]">*</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            {isSameDayStay ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckOutDate(getFutureDateStr(1, checkInDate || todayIstStr));
                                  setStayHours('');
                                }}
                                className="text-[9.5px] font-mono font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                                title="Switch to overnight stay (1 night)"
                              >
                                + Overnight
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckOutDate(checkInDate);
                                  setStayHours(3);
                                }}
                                className="text-[9.5px] font-mono font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                                title="Set same-day hourly stay"
                              >
                                ⚡ Same-Day
                              </button>
                            )}
                            <span className="text-[10px] font-mono font-bold text-slate-600">
                              {formatDdmmyyyy(checkOutDate)} / {departureTime}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_102px] gap-1.5">
                          <input
                            type="date"
                            required
                            min={checkInDate || todayIstStr}
                            value={checkOutDate}
                            onChange={e => handleDepartureDateChange(e.target.value)}
                            className="w-full px-2.5 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                          <input
                            type="time"
                            value={to24hTime(departureTime, to24hTime(hotelSettings?.checkOutTime, '11:00'))}
                            onChange={e => handleDepartureTimeChange(e.target.value)}
                            className="w-full px-2 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-1 space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">
                          {isSameDayStay ? 'Hours' : 'Nights'}
                        </label>
                        <div className={`py-2 px-1.5 rounded-xl border text-center text-xs font-mono font-extrabold whitespace-nowrap ${
                          isSameDayStay
                            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                            : 'border-[#DCE3EC] bg-[#F4F6F9] text-[#263449]'
                        }`}>
                          {isSameDayStay
                            ? `${stayHours || computedStayHours || 3}h`
                            : `${stayNights} nt${stayNights > 1 ? 's' : ''}`}
                        </div>
                      </div>"""

if old_row1 in c:
    c = c.replace(old_row1, new_row1, 1)
    print('5. Updated Stay & Rate Row 1 JSX')
else:
    print('5. old_row1 not found')

# 6. Add Hourly / Day-Use Duration panel right under Row 1
old_row1_end = """                        </select>
                      </div>
                    </div>"""

new_row1_end = """                        </select>
                      </div>
                    </div>

                    {/* Same-Day / Hourly Stay Duration Options (Shown when Check-In Date === Departure Date) */}
                    {isSameDayStay && (
                      <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50/80 via-indigo-50/60 to-purple-50/50 border border-indigo-200 space-y-2 animate-fadeIn">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10.5px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-700 text-white tracking-wider">
                              ⚡ Day-Use / Hourly Stay (Same Date)
                            </span>
                            <span className="text-[10px] font-mono text-slate-600">
                              (Check-in &amp; Check-out on {formatDdmmyyyy(checkInDate)})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-full">
                            Duration: {stayHours || computedStayHours || 3} Hours
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-mono font-bold uppercase text-slate-700 whitespace-nowrap">
                              Stay Hours:
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={stayHours}
                              onChange={e => {
                                const v = e.target.value;
                                if (v === '') {
                                  setStayHours('');
                                } else {
                                  handleSelectStayHours(Math.max(1, Math.min(24, parseInt(v, 10) || 1)));
                                }
                              }}
                              placeholder={String(computedStayHours || 3)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 focus:border-indigo-500 focus:outline-none"
                            />
                            <span className="text-xs font-mono text-slate-600">Hours</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-500 mr-1">Quick Select:</span>
                            {[2, 3, 4, 6, 8, 12].map(hrs => (
                              <button
                                key={hrs}
                                type="button"
                                onClick={() => handleSelectStayHours(hrs)}
                                className={`px-2 py-1 text-[10px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                                  (stayHours === hrs || (!stayHours && computedStayHours === hrs))
                                    ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                {hrs}h
                              </button>
                            ))}
                            {stayHours !== '' && (
                              <button
                                type="button"
                                onClick={() => setStayHours('')}
                                className="text-[10px] font-mono text-rose-600 hover:text-rose-800 underline ml-1 cursor-pointer"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}"""

if old_row1_end in c:
    c = c.replace(old_row1_end, new_row1_end, 1)
    print('6. Added Same-Day Hourly duration panel under Row 1')
else:
    print('6. old_row1_end not found')

# 7. Update Packages & add-ons custom section for multiple items
old_custom = """                        {/* Custom Add-On */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded-xl bg-[#F4F6F9] border border-[#DCE3EC] items-end">
                          <div className="md:col-span-6 space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Custom Add-on Label</label>
                            <input
                              type="text"
                              value={customAddonLabel}
                              onChange={e => setCustomAddonLabel(e.target.value)}
                              placeholder="e.g. Airport Pickup / Cake / Bouquet"
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={customAddonQty}
                              onChange={e => setCustomAddonQty(Math.max(1, Number(e.target.value) || 1))}
                              className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                            />
                          </div>
                          <div className="md:col-span-3 space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Rate (₹)</label>
                            <input
                              type="number"
                              min={0}
                              value={customAddonRate || ''}
                              onChange={e => setCustomAddonRate(Math.max(0, Number(e.target.value) || 0))}
                              placeholder="0"
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                            />
                          </div>
                        </div>"""

new_custom = """                        {/* Custom Add-Ons: Multi-item support */}
                        <div className="space-y-3 p-3.5 rounded-xl bg-[#F4F6F9] border border-[#DCE3EC]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#263449]">Custom Add-ons &amp; Extra Services</span>
                              {customAddonTotal > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                                  ₹{customAddonTotal.toLocaleString('en-IN')} total
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomExtraRows(prev => [
                                  ...prev,
                                  { id: `cx-${Date.now()}-${prev.length}`, label: '', qty: 1, rate: '' }
                                ])
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#C49A3A] text-[#8B691E] hover:bg-[#FDF8ED] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" /> + Add Another Custom Item
                            </button>
                          </div>

                          {/* Row 1: Primary custom add-on */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-2.5 rounded-lg border border-[#E5E7EB]">
                            <div className="md:col-span-6 space-y-1">
                              <label className="text-[11px] font-bold text-[#263449] block">Custom Add-on Label</label>
                              <input
                                type="text"
                                value={customAddonLabel}
                                onChange={e => setCustomAddonLabel(e.target.value)}
                                placeholder="e.g. Airport Pickup / Cake / Bouquet"
                                className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                              />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                              <label className="text-[11px] font-bold text-[#263449] block">Qty</label>
                              <input
                                type="number"
                                min={1}
                                value={customAddonQty}
                                onChange={e => setCustomAddonQty(Math.max(1, Number(e.target.value) || 1))}
                                className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white text-center"
                              />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                              <label className="text-[11px] font-bold text-[#263449] block">Rate (₹)</label>
                              <input
                                type="number"
                                min={0}
                                value={customAddonRate || ''}
                                onChange={e => setCustomAddonRate(Math.max(0, Number(e.target.value) || 0))}
                                placeholder="0"
                                className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white text-center"
                              />
                            </div>
                            <div className="md:col-span-1 text-right text-[11px] font-mono font-bold text-slate-700 py-1.5">
                              ₹{customAddonSingleTotal.toLocaleString('en-IN')}
                            </div>
                          </div>

                          {/* Additional Dynamic Custom Add-On Rows */}
                          {customExtraRows.map((row, idx) => {
                            const rowAmt = Math.round((Math.max(1, Number(row.qty) || 1)) * (Number(row.rate) || 0) * 100) / 100;
                            return (
                              <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-2.5 rounded-lg border border-[#E5E7EB]">
                                <div className="md:col-span-5 space-y-1">
                                  <label className="text-[11px] font-bold text-[#263449] block">Custom Item #{idx + 2}</label>
                                  <input
                                    type="text"
                                    value={row.label}
                                    placeholder="e.g. Candlelight Dinner, Laundry, City Cab"
                                    onChange={e =>
                                      setCustomExtraRows(prev =>
                                        prev.map(r => (r.id === row.id ? { ...r, label: e.target.value } : r))
                                      )
                                    }
                                    className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                  <label className="text-[11px] font-bold text-[#263449] block">Qty</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={row.qty}
                                    onChange={e =>
                                      setCustomExtraRows(prev =>
                                        prev.map(r =>
                                          r.id === row.id
                                            ? { ...r, qty: e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1) }
                                            : r
                                        )
                                      )
                                    }
                                    className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold text-center bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                  <label className="text-[11px] font-bold text-[#263449] block">Rate (₹)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={row.rate}
                                    placeholder="0"
                                    onChange={e =>
                                      setCustomExtraRows(prev =>
                                        prev.map(r =>
                                          r.id === row.id
                                            ? { ...r, rate: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) }
                                            : r
                                        )
                                      )
                                    }
                                    className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold text-center bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2 text-right text-[11px] font-mono font-bold text-slate-700 py-1.5">
                                  ₹{rowAmt.toLocaleString('en-IN')}
                                </div>
                                <div className="md:col-span-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setCustomExtraRows(prev => prev.filter(r => r.id !== row.id))}
                                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>"""

if old_custom in c:
    c = c.replace(old_custom, new_custom, 1)
    print('7. Updated Packages & add-ons custom section to support multiple items')
else:
    print('7. old_custom not found')

with open('src/components/CheckInFormView.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('CheckInFormView.tsx updated successfully!')
