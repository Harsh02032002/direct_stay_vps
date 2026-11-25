import React, { useMemo, useState } from 'react';
import {
  PackageSearch,
  Plus,
  Search,
  Link2,
  CheckCircle2,
  Archive,
  Clock,
  Eye,
  X,
  AlertCircle,
  User,
  MapPin,
  Sparkles,
  FileText,
} from 'lucide-react';
import { LostFoundRecord, RoomAsset, StaffMemberRecord } from '../types';
import { showToast } from '../../utils/toast';

interface LostAndFoundWorkspaceProps {
  items: LostFoundRecord[];
  rooms: RoomAsset[];
  staff: StaffMemberRecord[];
  loggedInUser?: string;
  onAddItem: (item: Omit<LostFoundRecord, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<LostFoundRecord>) => void;
  onUpdateAllItems?: (items: LostFoundRecord[]) => void;
}

const CATEGORIES = [
  'Electronics',
  'Documents/Wallet',
  'Jewelry',
  'Clothing',
  'Bags & Luggage',
  'Keys & Cards',
  'Toiletries',
  'Others',
];

const WORKFLOW_STATUSES: LostFoundRecord['status'][] = [
  'Lost – Reported',
  'Found – Registered',
  'Matching – In Progress',
  'Matched',
  'Stored',
  'Returned to Guest',
  'Closed',
];

function normalizeRecordType(item: LostFoundRecord): 'found' | 'lost' {
  if (item.recordType === 'lost') return 'lost';
  if (item.recordType === 'found') return 'found';
  if (String(item.status || '').startsWith('Lost')) return 'lost';
  return 'found';
}

function normalizeStatus(item: LostFoundRecord): LostFoundRecord['status'] {
  const st = String(item.status || '');
  if (st === 'Registered') return normalizeRecordType(item) === 'lost' ? 'Lost – Reported' : 'Found – Registered';
  if (st === 'Claimed') return 'Returned to Guest';
  if (st === 'Disposed') return 'Closed';
  return (item.status || 'Found – Registered') as LostFoundRecord['status'];
}

function getStatusPillClass(status: string): string {
  switch (status) {
    case 'Lost – Reported':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'Found – Registered':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'Matching – In Progress':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    case 'Matched':
      return 'bg-purple-50 text-purple-800 border-purple-300';
    case 'Stored':
      return 'bg-slate-100 text-slate-800 border-slate-300';
    case 'Returned to Guest':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'Closed':
      return 'bg-zinc-100 text-zinc-700 border-zinc-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function LostAndFoundWorkspace({
  items = [],
  rooms = [],
  staff = [],
  loggedInUser = 'Front Desk',
  onAddItem,
  onUpdateItem,
  onUpdateAllItems,
}: LostAndFoundWorkspaceProps) {
  const todayIso = new Date().toISOString().slice(0, 10);

  // Filter tabs & search
  const [activeTab, setActiveTab] = useState<'all' | 'lost' | 'found' | 'matched' | 'returned' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Registration modal ('found' | 'lost' | null)
  const [registerModalType, setRegisterModalType] = useState<'found' | 'lost' | null>(null);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [description, setDescription] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [locationField, setLocationField] = useState('');
  const [staffName, setStaffName] = useState(loggedInUser || '');
  const [eventDate, setEventDate] = useState(todayIso);
  const [storageLocation, setStorageLocation] = useState('Front Desk Safe');
  const [guestName, setGuestName] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  // Matching modal
  const [matchingSource, setMatchingSource] = useState<LostFoundRecord | null>(null);
  const [selectedMatchTargetId, setSelectedMatchTargetId] = useState('');
  const [matchNotes, setMatchNotes] = useState('');

  // Return to Guest modal
  const [returningItem, setReturningItem] = useState<LostFoundRecord | null>(null);
  const [claimGuestName, setClaimGuestName] = useState('');
  const [claimGuestMobile, setClaimGuestMobile] = useState('');
  const [claimIdProof, setClaimIdProof] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Audit / Details drawer
  const [inspectItem, setInspectItem] = useState<LostFoundRecord | null>(null);

  const normalizedItems = useMemo(
    () =>
      items.map((it) => ({
        ...it,
        recordType: normalizeRecordType(it),
        status: normalizeStatus(it),
      })),
    [items]
  );

  const counts = useMemo(() => {
    return {
      all: normalizedItems.length,
      lost: normalizedItems.filter((i) => i.recordType === 'lost').length,
      found: normalizedItems.filter((i) => i.recordType === 'found').length,
      matched: normalizedItems.filter((i) => i.status === 'Matched' || Boolean(i.matchedItemId)).length,
      returned: normalizedItems.filter((i) => i.status === 'Returned to Guest').length,
      closed: normalizedItems.filter((i) => i.status === 'Closed').length,
    };
  }, [normalizedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return normalizedItems.filter((item) => {
      if (activeTab === 'lost' && item.recordType !== 'lost') return false;
      if (activeTab === 'found' && item.recordType !== 'found') return false;
      if (activeTab === 'matched' && item.status !== 'Matched' && !item.matchedItemId) return false;
      if (activeTab === 'returned' && item.status !== 'Returned to Guest') return false;
      if (activeTab === 'closed' && item.status !== 'Closed') return false;
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        String(item.itemName || '').toLowerCase().includes(q) ||
        String(item.category || '').toLowerCase().includes(q) ||
        String(item.description || '').toLowerCase().includes(q) ||
        String(item.roomNumber || '').toLowerCase().includes(q) ||
        String(item.locationFound || item.lastSeenLocation || '').toLowerCase().includes(q) ||
        String(item.guestName || item.claimedBy || '').toLowerCase().includes(q) ||
        String(item.guestMobile || item.claimGuestMobile || '').toLowerCase().includes(q) ||
        String(item.foundBy || item.reportedByStaff || '').toLowerCase().includes(q) ||
        String(item.id || '').toLowerCase().includes(q)
      );
    });
  }, [normalizedItems, activeTab, categoryFilter, searchQuery]);

  const openRegisterModal = (type: 'found' | 'lost') => {
    setRegisterModalType(type);
    setItemName('');
    setCategory('Electronics');
    setDescription('');
    setRoomNumber('');
    setLocationField('');
    setStaffName(loggedInUser || staff[0]?.name || 'Front Desk');
    setEventDate(todayIso);
    setStorageLocation('Front Desk Safe');
    setGuestName('');
    setGuestMobile('');
    setGuestEmail('');
  };

  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerModalType) return;
    if (!itemName.trim()) {
      showToast('Item Name is required.', 'warning');
      return;
    }
    if (registerModalType === 'lost' && (!guestName.trim() || !guestMobile.trim())) {
      showToast('Guest Name and Contact Number are required for Lost Guest Items.', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    const actor = loggedInUser || staffName || 'Front Desk';
    const isLost = registerModalType === 'lost';
    const initialStatus: LostFoundRecord['status'] = isLost ? 'Lost – Reported' : 'Found – Registered';
    const loc = locationField.trim() || (roomNumber.trim() ? `Room ${roomNumber.trim()}` : 'Hotel Premises');

    onAddItem({
      recordType: registerModalType,
      itemName: itemName.trim(),
      category,
      description: description.trim(),
      roomNumber: roomNumber.trim() || 'Lobby',
      source: 'Register',
      locationFound: loc,
      lastSeenLocation: isLost ? loc : undefined,
      foundBy: staffName.trim() || actor,
      reportedByStaff: isLost ? staffName.trim() || actor : undefined,
      dateFound: eventDate,
      dateReported: isLost ? eventDate : undefined,
      storageLocation: isLost ? undefined : storageLocation.trim() || 'Front Desk Safe',
      guestName: guestName.trim() || undefined,
      guestMobile: guestMobile.trim() || undefined,
      guestEmail: guestEmail.trim() || undefined,
      status: initialStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
      auditHistory: [
        {
          id: `AUD-${Date.now()}`,
          action: isLost ? 'Lost Item Reported' : 'Found Item Registered',
          toStatus: initialStatus,
          performedBy: actor,
          dateTime: nowIso,
          notes: `${itemName.trim()} (${category}) • ${loc}`,
        },
      ],
    });

    setRegisterModalType(null);
    showToast(
      isLost
        ? `Lost guest item "${itemName.trim()}" logged for ${guestName.trim()}.`
        : `Found item "${itemName.trim()}" registered in Lost & Found.`,
      'success'
    );
  };

  const handleStatusChange = (item: LostFoundRecord, nextStatus: LostFoundRecord['status']) => {
    if (nextStatus === 'Returned to Guest') {
      setReturningItem(item);
      setClaimGuestName(item.guestName || item.claimedBy || '');
      setClaimGuestMobile(item.guestMobile || item.claimGuestMobile || '');
      setClaimIdProof(item.claimIdProof || '');
      setReturnNotes(item.returnNotes || '');
      return;
    }
    const nowIso = new Date().toISOString();
    const actor = loggedInUser || 'Front Desk';
    const prevStatus = normalizeStatus(item);
    onUpdateItem(item.id, {
      status: nextStatus,
      updatedAt: nowIso,
      ...(nextStatus === 'Closed' ? { closedAt: nowIso, closedBy: actor } : {}),
      auditHistory: [
        ...(item.auditHistory || []),
        {
          id: `AUD-${Date.now()}`,
          action: 'Status Updated',
          fromStatus: prevStatus,
          toStatus: nextStatus,
          performedBy: actor,
          dateTime: nowIso,
          notes: `Status changed from "${prevStatus}" to "${nextStatus}"`,
        },
      ],
    });
    showToast(`Updated "${item.itemName}" status to ${nextStatus}.`, 'success');
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningItem) return;
    if (!claimGuestName.trim()) {
      showToast('Enter the guest name receiving the item.', 'warning');
      return;
    }
    const nowIso = new Date().toISOString();
    const actor = loggedInUser || 'Front Desk';
    const prevStatus = normalizeStatus(returningItem);
    const patch: Partial<LostFoundRecord> = {
      status: 'Returned to Guest',
      claimedBy: claimGuestName.trim(),
      claimGuestMobile: claimGuestMobile.trim(),
      claimIdProof: claimIdProof.trim(),
      claimDate: todayIso,
      returnedBy: actor,
      returnNotes: returnNotes.trim(),
      updatedAt: nowIso,
      auditHistory: [
        ...(returningItem.auditHistory || []),
        {
          id: `AUD-${Date.now()}`,
          action: 'Returned to Guest',
          fromStatus: prevStatus,
          toStatus: 'Returned to Guest',
          performedBy: actor,
          dateTime: nowIso,
          notes: `Handed over to ${claimGuestName.trim()}${claimGuestMobile ? ` (${claimGuestMobile})` : ''}${returnNotes ? ` — ${returnNotes.trim()}` : ''}`,
        },
      ],
    };

    if (returningItem.matchedItemId && onUpdateAllItems) {
      const nextAll = normalizedItems.map((it) => {
        if (it.id === returningItem.id) return { ...it, ...patch };
        if (it.id === returningItem.matchedItemId) {
          return {
            ...it,
            status: 'Returned to Guest' as const,
            claimedBy: claimGuestName.trim(),
            claimGuestMobile: claimGuestMobile.trim(),
            claimDate: todayIso,
            returnedBy: actor,
            updatedAt: nowIso,
            auditHistory: [
              ...(it.auditHistory || []),
              {
                id: `AUD-${Date.now()}-M`,
                action: 'Linked Item Returned to Guest',
                fromStatus: it.status,
                toStatus: 'Returned to Guest',
                performedBy: actor,
                dateTime: nowIso,
                notes: `Returned via linked record ${returningItem.id} to ${claimGuestName.trim()}`,
              },
            ],
          };
        }
        return it;
      });
      onUpdateAllItems(nextAll);
    } else {
      onUpdateItem(returningItem.id, patch);
    }

    showToast(`Marked "${returningItem.itemName}" as Returned to ${claimGuestName.trim()}.`, 'success');
    setReturningItem(null);
  };

  // Opposite-type candidates for matching (Lost ↔ Found)
  const matchCandidates = useMemo(() => {
    if (!matchingSource) return [];
    const srcType = normalizeRecordType(matchingSource);
    const targetType = srcType === 'lost' ? 'found' : 'lost';
    return normalizedItems
      .filter(
        (it) =>
          it.id !== matchingSource.id &&
          it.recordType === targetType &&
          it.status !== 'Returned to Guest' &&
          it.status !== 'Closed' &&
          !it.matchedItemId
      )
      .sort((a, b) => {
        const aScore =
          (a.category === matchingSource.category ? 2 : 0) +
          (a.roomNumber && a.roomNumber === matchingSource.roomNumber ? 2 : 0);
        const bScore =
          (b.category === matchingSource.category ? 2 : 0) +
          (b.roomNumber && b.roomNumber === matchingSource.roomNumber ? 2 : 0);
        return bScore - aScore;
      });
  }, [matchingSource, normalizedItems]);

  const handleConfirmMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchingSource || !selectedMatchTargetId) {
      showToast('Select a matching record first.', 'warning');
      return;
    }
    const target = normalizedItems.find((it) => it.id === selectedMatchTargetId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const actor = loggedInUser || 'Front Desk';
    const noteText = matchNotes.trim() || `Matched ${matchingSource.itemName} ↔ ${target.itemName}`;

    // IMPORTANT: Matching sets status to 'Matched' — NEVER auto-marks 'Returned to Guest'!
    if (onUpdateAllItems) {
      const nextAll = normalizedItems.map((it) => {
        if (it.id === matchingSource.id) {
          return {
            ...it,
            status: 'Matched' as const,
            matchedItemId: target.id,
            matchedItemName: target.itemName,
            matchedBy: actor,
            matchedAt: nowIso,
            matchNotes: noteText,
            updatedAt: nowIso,
            auditHistory: [
              ...(it.auditHistory || []),
              {
                id: `AUD-${Date.now()}-1`,
                action: 'Matched Item',
                fromStatus: it.status,
                toStatus: 'Matched',
                performedBy: actor,
                dateTime: nowIso,
                notes: `Linked with ${target.recordType === 'lost' ? 'Lost' : 'Found'} record ${target.id} (${target.itemName}). ${noteText}`,
              },
            ],
          };
        }
        if (it.id === target.id) {
          return {
            ...it,
            status: 'Matched' as const,
            matchedItemId: matchingSource.id,
            matchedItemName: matchingSource.itemName,
            matchedBy: actor,
            matchedAt: nowIso,
            matchNotes: noteText,
            updatedAt: nowIso,
            auditHistory: [
              ...(it.auditHistory || []),
              {
                id: `AUD-${Date.now()}-2`,
                action: 'Matched Item',
                fromStatus: it.status,
                toStatus: 'Matched',
                performedBy: actor,
                dateTime: nowIso,
                notes: `Linked with ${matchingSource.recordType === 'lost' ? 'Lost' : 'Found'} record ${matchingSource.id} (${matchingSource.itemName}). ${noteText}`,
              },
            ],
          };
        }
        return it;
      });
      onUpdateAllItems(nextAll);
    } else {
      onUpdateItem(matchingSource.id, {
        status: 'Matched',
        matchedItemId: target.id,
        matchedItemName: target.itemName,
        matchedBy: actor,
        matchedAt: nowIso,
        matchNotes: noteText,
        updatedAt: nowIso,
      });
    }

    showToast(
      `Matched "${matchingSource.itemName}" with "${target.itemName}". Status updated to Matched (ready for guest return).`,
      'success'
    );
    setMatchingSource(null);
    setSelectedMatchTargetId('');
    setMatchNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Header Banner & Dual Registration Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono uppercase font-bold mb-1">
            <PackageSearch className="w-3.5 h-3.5 text-amber-600" /> Complete Lost &amp; Found Management
          </div>
          <h3 className="text-lg font-serif font-bold text-slate-900">
            Lost &amp; Found Guest Property Register
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Register both <strong>Found Items</strong> (including from Checkout) and <strong>Lost Guest Reports</strong>, match Lost ↔ Found records, track storage &amp; guest returns with full audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openRegisterModal('lost')}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Register Lost Guest Item
          </button>
          <button
            type="button"
            onClick={() => openRegisterModal('found')}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Register Found Item
          </button>
        </div>
      </div>

      {/* 6 Filter Tabs + Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All Entries (${counts.all})` },
                { id: 'lost', label: `Lost Items (${counts.lost})` },
                { id: 'found', label: `Found Items (${counts.found})` },
                { id: 'matched', label: `Matched Items (${counts.matched})` },
                { id: 'returned', label: `Returned Items (${counts.returned})` },
                { id: 'closed', label: `Closed Entries (${counts.closed})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-amber-400 shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search item, room, guest, mobile..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs w-56"
              />
            </div>
          </div>
        </div>

        {/* Register Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10.5px] font-mono font-bold uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Type &amp; Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Room / Location</th>
                <th className="py-3 px-4">Guest / Staff</th>
                <th className="py-3 px-4">Date &amp; Match</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No entries match the selected filter. Use <strong>Register Found Item</strong> or <strong>Register Lost Guest Item</strong> above.
                  </td>
                </tr>
              ) : (
                filteredItems.map((lf) => {
                  const isLost = lf.recordType === 'lost';
                  const canMatch = !lf.matchedItemId && lf.status !== 'Returned to Guest' && lf.status !== 'Closed';
                  return (
                    <tr key={lf.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold uppercase border ${
                              isLost
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {isLost ? 'LOST' : 'FOUND'}
                          </span>
                          {lf.source === 'Checkout' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-mono font-bold">
                              Checkout
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900">{lf.itemName}</div>
                        {lf.description && (
                          <div className="text-[10.5px] text-slate-500 line-clamp-1 max-w-[240px]">
                            {lf.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                        {lf.category}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {lf.roomNumber ? `Room ${lf.roomNumber}` : 'General Area'}
                        </div>
                        <div className="text-[10.5px] text-slate-500">
                          {lf.locationFound || lf.lastSeenLocation || '—'}
                        </div>
                        {lf.storageLocation && !isLost && (
                          <div className="text-[10px] font-mono text-amber-700">
                            Stored: {lf.storageLocation}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {lf.guestName || lf.claimedBy ? (
                          <div className="font-semibold text-slate-900">
                            {lf.guestName || lf.claimedBy}
                            {(lf.guestMobile || lf.claimGuestMobile) && (
                              <span className="block text-[10px] font-mono text-slate-500">
                                {lf.guestMobile || lf.claimGuestMobile}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-500">Guest unknown</div>
                        )}
                        <div className="text-[10px] text-slate-400">
                          {isLost ? 'Logged by: ' : 'Found by: '}
                          {lf.foundBy || lf.reportedByStaff || 'Staff'}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        <div>{lf.dateFound || lf.dateReported || '—'}</div>
                        {lf.matchedItemId && (
                          <div className="text-[10px] text-purple-700 font-bold flex items-center gap-1 mt-0.5">
                            <Link2 className="w-3 h-3" /> Linked: {lf.matchedItemName || lf.matchedItemId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={lf.status}
                          onChange={(e) => handleStatusChange(lf, e.target.value as LostFoundRecord['status'])}
                          className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold cursor-pointer ${getStatusPillClass(lf.status)}`}
                        >
                          {WORKFLOW_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canMatch && (
                            <button
                              type="button"
                              onClick={() => {
                                setMatchingSource(lf);
                                setSelectedMatchTargetId('');
                                setMatchNotes('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer"
                              title="Match with opposite Lost/Found entry"
                            >
                              <Link2 className="w-3 h-3" /> Match
                            </button>
                          )}
                          {lf.status !== 'Returned to Guest' && lf.status !== 'Closed' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(lf, 'Returned to Guest')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] cursor-pointer"
                            >
                              Return
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setInspectItem(lf)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title="Inspect Details & Audit Trail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER FOUND / LOST MODAL */}
      {registerModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div
              className={`p-5 text-white flex items-center justify-between ${
                registerModalType === 'lost' ? 'bg-rose-900' : 'bg-slate-900'
              }`}
            >
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-80 block">
                  Lost &amp; Found Register
                </span>
                <h3 className="font-serif font-bold text-base">
                  {registerModalType === 'lost' ? 'Register Lost Guest Item' : 'Register Found Item'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRegisterModalType(null)}
                className="text-white/75 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRegistration} className="p-5 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder={registerModalType === 'lost' ? 'e.g., Black Leather Wallet' : 'e.g., Apple iPhone Charger'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Detailed Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Color, brand, distinguishing marks, contents..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Room Number</label>
                  <input
                    type="text"
                    list="lf-rooms-list"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g., 301 or Lobby"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                  <datalist id="lf-rooms-list">
                    {rooms.map((r) => (
                      <option key={r.id} value={r.number} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    {registerModalType === 'lost' ? 'Last Seen Location' : 'Exact Area / Location Found'}
                  </label>
                  <input
                    type="text"
                    value={locationField}
                    onChange={(e) => setLocationField(e.target.value)}
                    placeholder="e.g., Bedside drawer, Restaurant Table 4"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    {registerModalType === 'lost' ? 'Date Reported *' : 'Date Found *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    {registerModalType === 'lost' ? 'Logged By Staff' : 'Found By Staff'}
                  </label>
                  <input
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Staff Name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {registerModalType === 'found' && (
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Storage Location</label>
                  <input
                    type="text"
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                    placeholder="e.g., Front Desk Safe / HK Locker B2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <span className="text-[10.5px] font-mono font-bold uppercase text-slate-600 block">
                  Guest Details {registerModalType === 'lost' ? '(Required)' : '(Optional if known)'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required={registerModalType === 'lost'}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Guest Full Name"
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    required={registerModalType === 'lost'}
                    value={guestMobile}
                    onChange={(e) => setGuestMobile(e.target.value)}
                    placeholder="Guest Mobile / Contact"
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                  />
                </div>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Guest Email (optional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRegisterModalType(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl font-bold text-white cursor-pointer ${
                    registerModalType === 'lost'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-slate-900 hover:bg-slate-800 text-amber-400'
                  }`}
                >
                  {registerModalType === 'lost' ? 'Log Lost Guest Report' : 'Register Found Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MATCH LOST <-> FOUND MODAL */}
      {matchingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-purple-950 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-purple-200 block">
                  Item Matching Engine
                </span>
                <h3 className="font-serif font-bold text-base">
                  Match: {matchingSource.itemName} ({matchingSource.recordType === 'lost' ? 'LOST' : 'FOUND'})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMatchingSource(null)}
                className="text-purple-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmMatch} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                Linking a Lost and Found entry updates both records to <strong>Matched</strong>. Items will only be marked <strong>Returned to Guest</strong> after physical handover is verified.
              </div>

              {matchCandidates.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-slate-500">
                  No unmatched {matchingSource.recordType === 'lost' ? 'Found' : 'Lost'} items available right now.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {matchCandidates.map((cand) => {
                    const selected = selectedMatchTargetId === cand.id;
                    const sameCat = cand.category === matchingSource.category;
                    const sameRoom = cand.roomNumber && cand.roomNumber === matchingSource.roomNumber;
                    return (
                      <label
                        key={cand.id}
                        className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                          selected
                            ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-300'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="matchCandidate"
                            checked={selected}
                            onChange={() => setSelectedMatchTargetId(cand.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{cand.itemName}</span>
                              <div className="flex gap-1">
                                {sameCat && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9.5px] font-bold">
                                    Same Category
                                  </span>
                                )}
                                {sameRoom && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9.5px] font-bold">
                                    Same Room
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-[10.5px] text-slate-500 mt-0.5">
                              {cand.category} • Room {cand.roomNumber || 'N/A'} • {cand.dateFound || cand.dateReported}
                              {cand.guestName ? ` • Guest: ${cand.guestName}` : ''}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-600 mb-1">Match Verification Notes</label>
                <input
                  type="text"
                  value={matchNotes}
                  onChange={(e) => setMatchNotes(e.target.value)}
                  placeholder="e.g., Confirmed serial number / color with guest over phone"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMatchingSource(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMatchTargetId}
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  Confirm Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN TO GUEST MODAL */}
      {returningItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">Confirm Guest Return — {returningItem.itemName}</h3>
              <button
                type="button"
                onClick={() => setReturningItem(null)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmReturn} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Claimed / Received By Guest *</label>
                <input
                  type="text"
                  required
                  value={claimGuestName}
                  onChange={(e) => setClaimGuestName(e.target.value)}
                  placeholder="Guest Full Name"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Guest Contact</label>
                  <input
                    type="text"
                    value={claimGuestMobile}
                    onChange={(e) => setClaimGuestMobile(e.target.value)}
                    placeholder="Mobile Number"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">ID Proof Verified</label>
                  <input
                    type="text"
                    value={claimIdProof}
                    onChange={(e) => setClaimIdProof(e.target.value)}
                    placeholder="Aadhaar / Passport #"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Handover / Courier Notes</label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Handed over at Front Desk / Courier tracking ID..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturningItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Mark Returned to Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS & AUDIT TRAIL MODAL */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-300 block">
                  {inspectItem.id} • {inspectItem.recordType === 'lost' ? 'LOST REPORT' : 'FOUND ENTRY'}
                </span>
                <h3 className="font-serif font-bold text-base">{inspectItem.itemName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Category</span>
                  <strong className="text-slate-900">{inspectItem.category}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Status</span>
                  <strong className="text-slate-900">{inspectItem.status}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Room / Location</span>
                  <strong className="text-slate-900">
                    {inspectItem.roomNumber ? `Room ${inspectItem.roomNumber}` : 'N/A'} • {inspectItem.locationFound || inspectItem.lastSeenLocation || '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Guest / Claimed By</span>
                  <strong className="text-slate-900">
                    {inspectItem.claimedBy || inspectItem.guestName || 'Unknown'}
                  </strong>
                </div>
              </div>

              {inspectItem.description && (
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block mb-1">Description</span>
                  <p className="p-3 rounded-xl bg-white border border-slate-200 text-slate-700">{inspectItem.description}</p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block mb-2">
                  Audit History ({(inspectItem.auditHistory || []).length})
                </span>
                <div className="space-y-2">
                  {(inspectItem.auditHistory || []).length === 0 ? (
                    <div className="text-slate-400 italic">No audit events recorded yet.</div>
                  ) : (
                    (inspectItem.auditHistory || []).map((ev, idx) => (
                      <div key={ev.id || idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900">{ev.action}</strong>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(ev.dateTime).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-600 mt-0.5">
                          By <strong>{ev.performedBy}</strong>
                          {ev.notes ? ` — ${ev.notes}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
