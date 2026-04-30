import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Trash2, Download, ChevronLeft, ChevronRight,
  Settings as SettingsIcon, Eraser, Edit3,
  BarChart3, X, Clock, Tag as TagIcon, FileText,
  AlertCircle, User, Lock, Unlock, Shield, Cloud, CloudOff,
  RefreshCw, Check, KeyRound
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// =================== CONSTANTS ===================

const NAVY = "#1B3A6B";
const BLUE = "#2E5FAC";
const ORANGE = "#E07B39";
const LIGHT = "#F5F7FA";
const BORDER = "#E2E8F0";
const TEXT_DIM = "#64748B";
const ERROR = "#DC2626";

const DEFAULT_TAGS = [
  { id: "t1", name: "Planification tournées", color: "#1B3A6B" },
  { id: "t2", name: "Saisie commandes", color: "#2E5FAC" },
  { id: "t3", name: "Appels chauffeurs", color: "#E07B39" },
  { id: "t4", name: "Coordination logistique", color: "#5B8FD9" },
  { id: "t5", name: "Suivi GPS / télématique", color: "#0E9F6E" },
  { id: "t6", name: "Échanges clients", color: "#D97706" },
  { id: "t7", name: "Administration / e-mails", color: "#7C3AED" },
  { id: "t8", name: "Réunions / brief équipe", color: "#DB2777" },
  { id: "t9", name: "Gestion incidents", color: "#DC2626" },
  { id: "t10", name: "Pause / Repas", color: "#94A3B8" },
];

const COLOR_PALETTE = [
  "#1B3A6B","#2E5FAC","#E07B39","#5B8FD9","#0E9F6E",
  "#D97706","#7C3AED","#DB2777","#DC2626","#94A3B8",
  "#0891B2","#65A30D","#CA8A04","#9333EA","#475569",
  "#059669","#B45309","#BE123C","#1E40AF","#3F3F46"
];

const STORAGE_KEY = "simond-suivi-v4";
const DEFAULT_ADMIN_PASSWORD = "simond2026";
const ADMIN_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
const ADMIN_TAP_COUNT = 5;
const ADMIN_TAP_WINDOW = 3000; // 3 sec pour faire les 5 taps

// =================== UTILS ===================

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shiftDate = (iso, delta) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const formatDateFR = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-CH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
};

const generateSlots = (startHour, endHour, slotMinutes) => {
  const slots = [];
  let totalMin = startHour * 60;
  const endMin = endHour * 60;
  while (totalMin < endMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    totalMin += slotMinutes;
  }
  return slots;
};

const minutesToHours = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h00`;
  return `${h}h${String(m).padStart(2, "0")}`;
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
  }
};

// =================== APP ===================

export default function App() {
  const initial = useMemo(() => loadState() || {}, []);

  const [tags, setTags] = useState(initial.tags || DEFAULT_TAGS);
  const [activeTagId, setActiveTagId] = useState(initial.activeTagId || "t1");
  const [currentDate, setCurrentDate] = useState(todayISO());
  const [daysData, setDaysData] = useState(initial.daysData || {});
  const [settings, setSettings] = useState(initial.settings || { startHour: 6, endHour: 19, slotMinutes: 30 });
  const [userName, setUserName] = useState(initial.userName || "");

  // Admin state
  const [adminPassword, setAdminPassword] = useState(initial.adminPassword || DEFAULT_ADMIN_PASSWORD);
  const [adminSessionUntil, setAdminSessionUntil] = useState(0);
  const [unlockedDates, setUnlockedDates] = useState(initial.unlockedDates || []);
  const [syncUrl, setSyncUrl] = useState(initial.syncUrl || "");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const isAdminActive = adminSessionUntil > Date.now();
  const isCurrentDateNotToday = currentDate !== todayISO();
  const isDateUnlocked = unlockedDates.includes(currentDate);
  const isDateLocked = isCurrentDateNotToday && !isAdminActive && !isDateUnlocked;

  const [editingTag, setEditingTag] = useState(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(!initial.userName);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [eraseMode, setEraseMode] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState("day");
  const [activeTab, setActiveTab] = useState("saisie");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Admin tap counter
  const tapCount = useRef(0);
  const tapTimer = useRef(null);

  const slots = useMemo(
    () => generateSlots(settings.startHour, settings.endHour, settings.slotMinutes),
    [settings]
  );

  const dayData = daysData[currentDate] || {};
  const tagById = useCallback(
    (id) => tags.find(t => t.id === id),
    [tags]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      saveState({ tags, activeTagId, daysData, settings, userName, adminPassword, unlockedDates, syncUrl });
    }, 300);
    return () => clearTimeout(timer);
  }, [tags, activeTagId, daysData, settings, userName, adminPassword, unlockedDates, syncUrl]);

  // Tap handler caché pour activer l'admin
  const handleSecretTap = useCallback(() => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, ADMIN_TAP_WINDOW);

    if (tapCount.current >= ADMIN_TAP_COUNT) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (isAdminActive) {
        // Si déjà admin, ouvrir directement les paramètres
        setShowSettings(true);
      } else {
        setShowAdminLogin(true);
      }
    }
  }, [isAdminActive]);

  // Tentative de connexion admin
  const tryAdminLogin = useCallback((password) => {
    if (password === adminPassword) {
      setAdminSessionUntil(Date.now() + ADMIN_SESSION_DURATION);
      setShowAdminLogin(false);
      return true;
    }
    return false;
  }, [adminPassword]);

  // Déconnexion admin manuelle
  const logoutAdmin = useCallback(() => {
    setAdminSessionUntil(0);
  }, []);

  // Auto-déconnexion admin à expiration
  useEffect(() => {
    if (!isAdminActive) return;
    const remaining = adminSessionUntil - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      setAdminSessionUntil(0);
    }, remaining);
    return () => clearTimeout(timer);
  }, [adminSessionUntil, isAdminActive]);

  // Déverrouiller la date courante (admin only)
  const unlockCurrentDate = useCallback(() => {
    if (!isAdminActive) return;
    setUnlockedDates(prev => {
      if (prev.includes(currentDate)) return prev;
      return [...prev, currentDate];
    });
  }, [isAdminActive, currentDate]);

  // ---------- Cloud sync ----------
  const syncTimeout = useRef(null);

  const syncToCloud = useCallback(async () => {
    if (!syncUrl || !userName) return;
    setSyncStatus("syncing");
    try {
      const dayPayload = daysData[currentDate] || {};
      const entries = Object.entries(dayPayload).map(([idx, tagId]) => {
        const i = parseInt(idx);
        const tag = tags.find(t => t.id === tagId);
        const start = slots[i];
        const endMin = settings.startHour * 60 + (i + 1) * settings.slotMinutes;
        const eh = Math.floor(endMin / 60);
        const em = endMin % 60;
        const end = `${String(eh).padStart(2,"0")}:${String(em).padStart(2,"0")}`;
        return {
          idx: i, start, end,
          duration: settings.slotMinutes,
          tagName: tag?.name || "(inconnu)",
          tagColor: tag?.color || "#000000",
        };
      });
      const res = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save", user: userName, date: currentDate, entries }),
      });
      const data = await res.json();
      if (data.ok) {
        setSyncStatus("success");
        setLastSyncAt(new Date());
      } else {
        setSyncStatus("error");
      }
    } catch (e) {
      setSyncStatus("error");
    }
  }, [syncUrl, userName, daysData, currentDate, tags, slots, settings]);

  // Auto-sync debounced
  useEffect(() => {
    if (!syncUrl || !userName) return;
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      syncToCloud();
    }, 2000);
    return () => {
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
    };
  }, [daysData, currentDate, syncUrl, userName, syncToCloud]);

  const goToPreviousDay = useCallback(() => {
    setCurrentDate(prev => shiftDate(prev, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    setCurrentDate(prev => shiftDate(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(todayISO());
  }, []);

  const isDragging = useRef(false);
  const lastTouchedSlot = useRef(null);

  const setSlot = useCallback((slotIdx, tagId) => {
    if (isDateLocked) return; // Blocage en mode lecture seule
    setDaysData(prev => {
      const day = { ...(prev[currentDate] || {}) };
      if (tagId === null) {
        delete day[slotIdx];
      } else {
        day[slotIdx] = tagId;
      }
      return { ...prev, [currentDate]: day };
    });
  }, [currentDate, isDateLocked]);

  const handleSlotPaint = useCallback((slotIdx) => {
    if (eraseMode) {
      setSlot(slotIdx, null);
    } else {
      setSlot(slotIdx, activeTagId);
    }
  }, [eraseMode, setSlot, activeTagId]);

  const eraseSlot = useCallback((slotIdx) => {
    setSlot(slotIdx, null);
  }, [setSlot]);

  const handleSlotMouseDown = useCallback((slotIdx) => {
    isDragging.current = true;
    lastTouchedSlot.current = slotIdx;
    handleSlotPaint(slotIdx);
  }, [handleSlotPaint]);

  const handleSlotMouseEnter = useCallback((slotIdx) => {
    if (isDragging.current && lastTouchedSlot.current !== slotIdx) {
      lastTouchedSlot.current = slotIdx;
      handleSlotPaint(slotIdx);
    }
  }, [handleSlotPaint]);

  useEffect(() => {
    const stopDrag = () => {
      isDragging.current = false;
      lastTouchedSlot.current = null;
    };
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("touchend", stopDrag);
    document.addEventListener("touchcancel", stopDrag);
    return () => {
      document.removeEventListener("mouseup", stopDrag);
      document.removeEventListener("touchend", stopDrag);
      document.removeEventListener("touchcancel", stopDrag);
    };
  }, []);

  const addTag = useCallback((name, color) => {
    const newTag = { id: `t${Date.now()}`, name: name.trim(), color };
    setTags(prev => [...prev, newTag]);
  }, []);

  const updateTag = useCallback((id, updates) => {
    setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTag = useCallback((id) => {
    setConfirmDialog({
      title: "Supprimer la catégorie ?",
      message: "Les créneaux déjà assignés à cette catégorie seront effacés.",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: () => {
        setTags(prev => prev.filter(t => t.id !== id));
        setDaysData(prev => {
          const next = {};
          for (const [date, day] of Object.entries(prev)) {
            const cleaned = {};
            for (const [idx, tagId] of Object.entries(day)) {
              if (tagId !== id) cleaned[idx] = tagId;
            }
            next[date] = cleaned;
          }
          return next;
        });
        setActiveTagId(prevActive => {
          if (prevActive === id) {
            const remaining = tags.filter(t => t.id !== id);
            return remaining[0]?.id || "";
          }
          return prevActive;
        });
      }
    });
  }, [tags]);

  const clearDay = useCallback(() => {
    setConfirmDialog({
      title: "Effacer toutes les saisies du jour ?",
      message: `Cela supprimera toutes les entrées du ${formatDateFR(currentDate)}.`,
      confirmLabel: "Tout effacer",
      danger: true,
      onConfirm: () => {
        setDaysData(prev => {
          const next = { ...prev };
          delete next[currentDate];
          return next;
        });
      }
    });
  }, [currentDate]);

  const analytics = useMemo(() => {
    let dates = [];
    if (analyticsRange === "day") {
      dates = [currentDate];
    } else if (analyticsRange === "week") {
      const [y, m, d] = currentDate.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const dow = date.getDay() || 7;
      const monday = new Date(date);
      monday.setDate(date.getDate() - (dow - 1));
      for (let i = 0; i < 7; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        const yy = dd.getFullYear();
        const mm = String(dd.getMonth() + 1).padStart(2, "0");
        const ddd = String(dd.getDate()).padStart(2, "0");
        dates.push(`${yy}-${mm}-${ddd}`);
      }
    } else {
      dates = Object.keys(daysData);
    }

    const totals = {};
    let totalMin = 0;
    dates.forEach(date => {
      const day = daysData[date] || {};
      Object.values(day).forEach(tagId => {
        totals[tagId] = (totals[tagId] || 0) + settings.slotMinutes;
        totalMin += settings.slotMinutes;
      });
    });

    const data = tags.map(tag => ({
      name: tag.name,
      value: totals[tag.id] || 0,
      color: tag.color,
      pct: totalMin ? ((totals[tag.id] || 0) / totalMin) * 100 : 0,
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return {
      data,
      totalMin,
      daysCount: dates.filter(d => daysData[d] && Object.keys(daysData[d]).length > 0).length
    };
  }, [analyticsRange, currentDate, daysData, settings.slotMinutes, tags]);

  const exportCSV = useCallback(() => {
    const header = "Utilisateur;Date;Heure début;Heure fin;Durée (min);Catégorie\n";
    const rows = [];
    Object.entries(daysData)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, day]) => {
        Object.entries(day).forEach(([slotIdx, tagId]) => {
          const idx = parseInt(slotIdx);
          if (idx < 0 || idx >= slots.length) return;
          const start = slots[idx];
          const endMin = settings.startHour * 60 + (idx + 1) * settings.slotMinutes;
          const eh = Math.floor(endMin / 60);
          const em = endMin % 60;
          const end = `${String(eh).padStart(2,"0")}:${String(em).padStart(2,"0")}`;
          const tag = tagById(tagId);
          rows.push(`${userName || "(non défini)"};${date};${start};${end};${settings.slotMinutes};${tag ? tag.name : "(supprimé)"}`);
        });
      });
    const csv = header + rows.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suivi_activite_${(userName || "user").replace(/\s+/g,"_")}_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [daysData, slots, settings, tagById, userName]);

  const dayMinutes = Object.keys(dayData).length * settings.slotMinutes;

  return (
    <div className="min-h-screen pb-20 lg:pb-6" style={{ background: LIGHT, fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap');
        body { margin: 0; -webkit-tap-highlight-color: transparent; }
        .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scroll-thin::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
      `}</style>

      <header className="sticky top-0 z-30 border-b" style={{ background: "white", borderColor: BORDER }}>
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 lg:w-10 lg:h-10 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ background: NAVY }}
              >
                S
              </div>
              <div className="min-w-0">
                <h1
                  className="text-base lg:text-xl font-bold leading-tight truncate"
                  style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
                >
                  Suivi d'activité
                </h1>
                <p className="text-xs hidden sm:block" style={{ color: TEXT_DIM }}>
                  Simond SA · Exploitation
                  {userName && <span> · <strong>{userName}</strong></span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {syncUrl && userName && <SyncIndicator status={syncStatus} lastSyncAt={lastSyncAt} />}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="p-2 rounded border transition relative"
                style={{ borderColor: BORDER, color: NAVY, background: "white" }}
                aria-label="Paramètres"
              >
                <SettingsIcon size={16} style={{ pointerEvents: "none" }} />
                {isAdminActive && (
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                    style={{ background: ORANGE, border: "2px solid white" }}
                    title="Mode admin actif"
                  />
                )}
              </button>
              <button
                type="button"
                onClick={exportCSV}
                className="px-3 py-2 rounded text-xs lg:text-sm font-semibold flex items-center gap-1.5 text-white transition"
                style={{ background: ORANGE }}
              >
                <Download size={14} style={{ pointerEvents: "none" }} />
                <span className="hidden sm:inline pointer-events-none">CSV</span>
              </button>
            </div>
          </div>

          <DateNavigator
            currentDate={currentDate}
            onPrev={goToPreviousDay}
            onNext={goToNextDay}
            onToday={goToToday}
            onPickDate={setCurrentDate}
            onSecretTap={handleSecretTap}
            isLocked={isDateLocked}
            isAdminActive={isAdminActive}
          />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-3 lg:p-6 lg:grid lg:grid-cols-12 lg:gap-6">
        <aside className={`lg:col-span-3 mb-3 lg:mb-0 ${activeTab === "tags" ? "block" : "hidden lg:block"}`}>
          <TagsPanel
            tags={tags}
            activeTagId={activeTagId}
            setActiveTagId={setActiveTagId}
            eraseMode={eraseMode}
            setEraseMode={setEraseMode}
            editingTag={editingTag}
            setEditingTag={setEditingTag}
            updateTag={updateTag}
            deleteTag={deleteTag}
            setShowAddTag={setShowAddTag}
            tagById={tagById}
          />
        </aside>

        <main className={`lg:col-span-6 ${activeTab === "saisie" ? "block" : "hidden lg:block"}`}>
          <TimeGridPanel
            slots={slots}
            settings={settings}
            dayData={dayData}
            tagById={tagById}
            handleSlotMouseDown={handleSlotMouseDown}
            handleSlotMouseEnter={handleSlotMouseEnter}
            eraseMode={eraseMode}
            dayMinutes={dayMinutes}
            clearDay={clearDay}
            eraseSlot={eraseSlot}
            isLocked={isDateLocked}
            isAdminActive={isAdminActive}
            onUnlockDate={unlockCurrentDate}
            onLogoutAdmin={logoutAdmin}
            currentDate={currentDate}
          />
        </main>

        <aside className={`lg:col-span-3 mt-3 lg:mt-0 ${activeTab === "analyse" ? "block" : "hidden lg:block"}`}>
          <AnalyticsPanel
            analytics={analytics}
            analyticsRange={analyticsRange}
            setAnalyticsRange={setAnalyticsRange}
          />
        </aside>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t" style={{ background: "white", borderColor: BORDER }}>
        <div className="grid grid-cols-3">
          {[
            { id: "saisie", label: "Saisie", icon: Clock },
            { id: "tags", label: "Catégories", icon: TagIcon },
            { id: "analyse", label: "Analyse", icon: BarChart3 },
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className="flex flex-col items-center justify-center py-2.5 transition"
                style={{
                  color: active ? NAVY : TEXT_DIM,
                  background: active ? `${BLUE}10` : "transparent",
                }}
              >
                <Icon size={20} style={{ pointerEvents: "none" }} />
                <span className="text-xs mt-0.5 font-medium pointer-events-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showFirstRun && (
        <FirstRunModal
          onDone={(name) => {
            setUserName(name);
            setShowFirstRun(false);
          }}
        />
      )}

      {showAddTag && (
        <AddTagModal
          onClose={() => setShowAddTag(false)}
          onAdd={(name, color) => {
            addTag(name, color);
            setShowAddTag(false);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={setSettings}
          userName={userName}
          setUserName={setUserName}
          isAdminActive={isAdminActive}
          adminPassword={adminPassword}
          setAdminPassword={setAdminPassword}
          syncUrl={syncUrl}
          setSyncUrl={setSyncUrl}
          unlockedDates={unlockedDates}
          setUnlockedDates={setUnlockedDates}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAdminLogin && (
        <AdminLoginModal
          onTryLogin={tryAdminLogin}
          onClose={() => setShowAdminLogin(false)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

// =================== DATE NAVIGATOR ===================

function DateNavigator({ currentDate, onPrev, onNext, onToday, onPickDate, onSecretTap, isLocked, isAdminActive }) {
  const isToday = currentDate === todayISO();
  return (
    <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: BORDER }}>
      <button
        type="button"
        onClick={onPrev}
        className="p-2 rounded hover:bg-slate-100 active:bg-slate-200 flex-shrink-0"
        style={{ background: LIGHT }}
        aria-label="Jour précédent"
      >
        <ChevronLeft size={20} style={{ color: NAVY, pointerEvents: "none" }} />
      </button>

      <div className="flex-1 min-w-0 text-center">
        <button
          type="button"
          onClick={onSecretTap}
          className="font-semibold capitalize text-sm lg:text-base truncate w-full text-center inline-flex items-center justify-center gap-1.5"
          style={{ color: NAVY, background: "transparent", border: "none", cursor: "default" }}
          aria-label="Date courante"
        >
          {isLocked && <Lock size={12} style={{ color: TEXT_DIM, pointerEvents: "none" }} />}
          {isAdminActive && !isLocked && <Shield size={12} style={{ color: ORANGE, pointerEvents: "none" }} />}
          <span className="pointer-events-none">{formatDateFR(currentDate)}</span>
        </button>
        <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
          <input
            type="date"
            value={currentDate}
            onChange={(e) => onPickDate(e.target.value)}
            className="text-xs border rounded px-2 py-0.5 max-w-[140px]"
            style={{ borderColor: BORDER, color: TEXT_DIM }}
          />
          {!isToday && (
            <button
              type="button"
              onClick={onToday}
              className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap"
              style={{ background: `${BLUE}15`, color: BLUE }}
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="p-2 rounded hover:bg-slate-100 active:bg-slate-200 flex-shrink-0"
        style={{ background: LIGHT }}
        aria-label="Jour suivant"
      >
        <ChevronRight size={20} style={{ color: NAVY, pointerEvents: "none" }} />
      </button>
    </div>
  );
}

// =================== TAGS PANEL ===================

function TagsPanel({ tags, activeTagId, setActiveTagId, eraseMode, setEraseMode, editingTag, setEditingTag, updateTag, deleteTag, setShowAddTag, tagById }) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "white", borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: NAVY }}>
          <TagIcon size={14} /> Catégories
        </h2>
        <button
          type="button"
          onClick={() => setShowAddTag(true)}
          className="w-8 h-8 rounded flex items-center justify-center text-white"
          style={{ background: NAVY }}
          aria-label="Ajouter une catégorie"
        >
          <Plus size={16} style={{ pointerEvents: "none" }} />
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: TEXT_DIM }}>
        Sélectionner puis cliquer (ou glisser sur la grille pour remplir plusieurs créneaux).
      </p>

      <div className="space-y-1.5 max-h-96 overflow-y-auto scroll-thin pr-1">
        {tags.map(tag => (
          <div
            key={tag.id}
            className="group flex items-center gap-2 p-2 rounded cursor-pointer transition border-2"
            style={{
              background: activeTagId === tag.id && !eraseMode ? `${tag.color}15` : "transparent",
              borderColor: activeTagId === tag.id && !eraseMode ? tag.color : "transparent",
            }}
            onClick={() => { setActiveTagId(tag.id); setEraseMode(false); }}
          >
            <div className="w-5 h-5 rounded flex-shrink-0" style={{ background: tag.color }} />
            {editingTag === tag.id ? (
              <input
                type="text"
                value={tag.name}
                onChange={(e) => updateTag(tag.id, { name: e.target.value })}
                onBlur={() => setEditingTag(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTag(null)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="flex-1 text-sm px-1 border rounded"
                style={{ borderColor: BORDER }}
              />
            ) : (
              <span className="text-sm flex-1 truncate" style={{ color: NAVY }}>{tag.name}</span>
            )}
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingTag(tag.id); }}
                className="p-1.5 hover:bg-slate-100 rounded"
                aria-label="Renommer"
              >
                <Edit3 size={13} style={{ color: TEXT_DIM, pointerEvents: "none" }} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                className="p-1.5 hover:bg-red-50 rounded"
                aria-label="Supprimer"
              >
                <Trash2 size={13} style={{ color: ERROR, pointerEvents: "none" }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!eraseMode && tagById(activeTagId) && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: BORDER }}>
          <p className="text-xs mb-2" style={{ color: TEXT_DIM }}>Couleur de la catégorie active</p>
          <div className="flex flex-wrap gap-1">
            {COLOR_PALETTE.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => updateTag(activeTagId, { color: c })}
                className="w-6 h-6 rounded border-2 transition"
                style={{
                  background: c,
                  borderColor: tagById(activeTagId).color === c ? NAVY : "transparent",
                }}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setEraseMode(!eraseMode)}
        className="mt-3 w-full px-3 py-2.5 rounded text-sm font-medium flex items-center justify-center gap-2 border transition"
        style={{
          borderColor: eraseMode ? ERROR : BORDER,
          background: eraseMode ? "#FEE2E2" : "white",
          color: eraseMode ? ERROR : NAVY,
        }}
      >
        <Eraser size={14} style={{ pointerEvents: "none" }} />
        <span className="pointer-events-none">{eraseMode ? "Mode gomme actif" : "Activer la gomme"}</span>
      </button>
    </div>
  );
}

// =================== TIME GRID ===================

function TimeGridPanel({ slots, settings, dayData, tagById, handleSlotMouseDown, handleSlotMouseEnter, eraseMode, dayMinutes, clearDay, eraseSlot, isLocked, isAdminActive, onUnlockDate, onLogoutAdmin, currentDate }) {
  const totalDayMin = slots.length * settings.slotMinutes;
  const isPast = currentDate < todayISO();
  const isFuture = currentDate > todayISO();
  const lockMessage = isPast
    ? "Ce jour est passé et ne peut plus être modifié."
    : isFuture
    ? "Ce jour n'est pas encore arrivé. La saisie sera disponible le jour-même."
    : "Ce jour ne peut pas être modifié.";

  return (
    <div className="rounded-lg border" style={{ background: "white", borderColor: BORDER }}>
      <div className="px-4 py-2 flex items-center justify-between text-xs border-b" style={{ background: LIGHT, borderColor: BORDER }}>
        <div className="flex items-center gap-2" style={{ color: TEXT_DIM }}>
          <Clock size={12} />
          <span><strong style={{ color: NAVY }}>{minutesToHours(dayMinutes)}</strong> sur {minutesToHours(totalDayMin)}</span>
        </div>
        {Object.keys(dayData).length > 0 && !isLocked && (
          <button
            type="button"
            onClick={clearDay}
            className="text-xs flex items-center gap-1 hover:underline font-medium"
            style={{ color: ERROR }}
          >
            <Trash2 size={11} style={{ pointerEvents: "none" }} />
            <span className="pointer-events-none">Effacer le jour</span>
          </button>
        )}
      </div>

      {isLocked ? (
        <div className="px-4 py-3 text-xs border-b flex items-center justify-between gap-2" style={{ background: `${TEXT_DIM}10`, borderColor: BORDER }}>
          <div className="flex items-center gap-2" style={{ color: TEXT_DIM }}>
            <Lock size={14} />
            <span><strong style={{ color: NAVY }}>Lecture seule.</strong> {lockMessage}</span>
          </div>
        </div>
      ) : isAdminActive ? (
        <div className="px-4 py-2 text-xs border-b flex items-center justify-between gap-2 flex-wrap" style={{ background: `${ORANGE}15`, borderColor: BORDER }}>
          <div className="flex items-center gap-2" style={{ color: NAVY }}>
            <Shield size={14} style={{ color: ORANGE }} />
            <span><strong>Mode admin actif.</strong> Édition autorisée.</span>
          </div>
          <button
            type="button"
            onClick={onLogoutAdmin}
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ background: NAVY, color: "white" }}
          >
            Quitter admin
          </button>
        </div>
      ) : (
        <div className="px-4 py-2 text-xs border-b" style={{ background: `${ORANGE}08`, borderColor: BORDER, color: TEXT_DIM }}>
          💡 <strong style={{ color: NAVY }}>Astuce :</strong> cliquer sur le ❌ d'un créneau pour l'effacer
        </div>
      )}

      <div className={`p-3 lg:p-4 select-none ${isLocked ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-1 gap-1">
          {slots.map((slotLabel, idx) => (
            <SlotRow
              key={idx}
              idx={idx}
              slotLabel={slotLabel}
              tag={tagById(dayData[idx])}
              handleSlotMouseDown={handleSlotMouseDown}
              handleSlotMouseEnter={handleSlotMouseEnter}
              eraseMode={eraseMode}
              eraseSlot={eraseSlot}
              isLocked={isLocked}
            />
          ))}
        </div>

        {isLocked && isAdminActive === false && (
          <div className="mt-3 text-center">
            <p className="text-xs" style={{ color: TEXT_DIM }}>
              Pour modifier ce jour, activer le mode admin.
            </p>
          </div>
        )}

        {isAdminActive && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={onUnlockDate}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-2 border"
              style={{ borderColor: ORANGE, color: ORANGE, background: "white" }}
            >
              <Unlock size={12} />
              Déverrouiller ce jour de façon permanente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SlotRow({ idx, slotLabel, tag, handleSlotMouseDown, handleSlotMouseEnter, eraseMode, eraseSlot, isLocked }) {
  const isHourMark = slotLabel.endsWith(":00");

  return (
    <div className="flex items-stretch gap-2">
      <div
        className="w-12 lg:w-14 text-xs flex items-center justify-end pr-2 flex-shrink-0"
        style={{
          color: isHourMark ? NAVY : TEXT_DIM,
          fontWeight: isHourMark ? 600 : 400,
        }}
      >
        {slotLabel}
      </div>
      <div className="flex-1 flex items-stretch gap-1">
        <button
          type="button"
          disabled={isLocked}
          onMouseDown={() => !isLocked && handleSlotMouseDown(idx)}
          onMouseEnter={() => !isLocked && handleSlotMouseEnter(idx)}
          onTouchStart={(e) => {
            if (isLocked) return;
            e.preventDefault();
            handleSlotMouseDown(idx);
          }}
          onTouchMove={(e) => {
            if (isLocked) return;
            e.preventDefault();
            const touch = e.touches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const slotAttr = el?.getAttribute?.("data-slot");
            if (slotAttr !== null && slotAttr !== undefined) {
              handleSlotMouseEnter(parseInt(slotAttr));
            }
          }}
          data-slot={idx}
          className="flex-1 h-11 lg:h-9 rounded transition flex items-center px-3 text-sm border text-left"
          style={{
            background: tag ? tag.color : "white",
            color: tag ? "white" : TEXT_DIM,
            borderColor: tag ? tag.color : BORDER,
            fontWeight: tag ? 500 : 400,
            cursor: isLocked ? "not-allowed" : (eraseMode ? "crosshair" : "pointer"),
          }}
        >
          {tag ? (
            <span className="truncate flex-1 pointer-events-none">{tag.name}</span>
          ) : (
            <span className="text-xs italic opacity-60 pointer-events-none">
              {isLocked ? "—" : (eraseMode ? "Toucher pour effacer" : "Toucher pour assigner")}
            </span>
          )}
        </button>
        {tag && !isLocked && (
          <button
            type="button"
            onClick={() => eraseSlot(idx)}
            className="w-11 lg:w-9 h-11 lg:h-9 rounded flex items-center justify-center transition active:scale-90 flex-shrink-0"
            style={{
              background: tag.color,
              color: "white",
              border: `1px solid ${tag.color}`,
            }}
            aria-label="Effacer ce créneau"
          >
            <X size={16} strokeWidth={2.5} style={{ pointerEvents: "none" }} />
          </button>
        )}
      </div>
    </div>
  );
}

// =================== ANALYTICS ===================

function AnalyticsPanel({ analytics, analyticsRange, setAnalyticsRange }) {
  return (
    <>
      <div className="rounded-lg border p-4" style={{ background: "white", borderColor: BORDER }}>
        <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2 mb-3" style={{ color: NAVY }}>
          <BarChart3 size={14} /> Analyse
        </h2>

        <div className="flex gap-1 mb-4 p-1 rounded" style={{ background: LIGHT }}>
          {[
            { id: "day", label: "Jour" },
            { id: "week", label: "Semaine" },
            { id: "all", label: "Tout" },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAnalyticsRange(opt.id)}
              className="flex-1 text-xs py-1.5 rounded font-medium transition"
              style={{
                background: analyticsRange === opt.id ? "white" : "transparent",
                color: analyticsRange === opt.id ? NAVY : TEXT_DIM,
                boxShadow: analyticsRange === opt.id ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {analytics.data.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: TEXT_DIM }}>
            <FileText size={24} className="mx-auto mb-2 opacity-40" />
            Aucune donnée à analyser sur cette période.
          </div>
        ) : (
          <>
            <div className="text-center mb-2">
              <div className="text-2xl font-bold" style={{ color: NAVY }}>
                {minutesToHours(analytics.totalMin)}
              </div>
              <div className="text-xs" style={{ color: TEXT_DIM }}>
                sur {analytics.daysCount} jour{analytics.daysCount > 1 ? "s" : ""} saisi{analytics.daysCount > 1 ? "s" : ""}
              </div>
            </div>

            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={analytics.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                    {analytics.data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      `${minutesToHours(value)} (${((value/analytics.totalMin)*100).toFixed(1)}%)`,
                      "Durée"
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 mt-3 max-h-72 overflow-y-auto scroll-thin pr-1">
              {analytics.data.map((d, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: d.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium" style={{ color: NAVY }}>{d.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold" style={{ color: NAVY }}>{minutesToHours(d.value)}</div>
                    <div style={{ color: TEXT_DIM }}>{d.pct.toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 rounded-lg p-3 border-l-4" style={{ background: `${ORANGE}10`, borderColor: ORANGE }}>
        <p className="text-xs font-semibold mb-1" style={{ color: NAVY }}>💡 Conseil DRH</p>
        <p className="text-xs" style={{ color: NAVY, lineHeight: 1.5 }}>
          Saisir <strong>en temps réel</strong>, pas en fin de poste. Viser 2 à 3 semaines pour des données représentatives.
        </p>
      </div>
    </>
  );
}

// =================== MODALS ===================

function FirstRunModal({ onDone }) {
  const [name, setName] = useState("");
  return (
    <Modal title="👋 Bienvenue" hideClose>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: TEXT_DIM, lineHeight: 1.5 }}>
          Pour commencer, indique ton prénom et nom. Cela permettra d'identifier tes saisies dans les exports.
        </p>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
            Ton nom
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Ex : Jean Dupont"
            className="w-full px-3 py-2.5 border rounded text-sm"
            style={{ borderColor: BORDER }}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onDone(name.trim())}
          />
        </div>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => onDone(name.trim())}
          className="w-full px-3 py-2.5 rounded text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: NAVY }}
        >
          Commencer
        </button>
      </div>
    </Modal>
  );
}

function AddTagModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  return (
    <Modal title="Nouvelle catégorie" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
            Nom
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onAdd(name, color)}
            autoFocus
            placeholder="Ex : Saisie BL"
            className="w-full px-3 py-2.5 border rounded text-sm"
            style={{ borderColor: BORDER }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: NAVY }}>
            Couleur
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded border-2 transition"
                style={{
                  background: c,
                  borderColor: color === c ? NAVY : "transparent",
                }}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded text-sm font-medium border"
            style={{ borderColor: BORDER, color: NAVY }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => name.trim() && onAdd(name, color)}
            disabled={!name.trim()}
            className="flex-1 px-3 py-2.5 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({ settings, setSettings, userName, setUserName, isAdminActive, adminPassword, setAdminPassword, syncUrl, setSyncUrl, unlockedDates, setUnlockedDates, onClose }) {
  const [section, setSection] = useState("general");

  return (
    <Modal title="Paramètres" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex gap-1 p-1 rounded" style={{ background: LIGHT }}>
          {[
            { id: "general", label: "Général" },
            { id: "grid", label: "Grille" },
            ...(isAdminActive ? [{ id: "admin", label: "⚡ Admin" }] : []),
          ].map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className="flex-1 text-xs py-1.5 rounded font-medium transition"
              style={{
                background: section === s.id ? "white" : "transparent",
                color: section === s.id ? NAVY : TEXT_DIM,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === "general" && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
              <User size={12} className="inline mr-1" /> Nom de l'utilisateur
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
              style={{ borderColor: BORDER }}
            />
            <div className="text-xs p-3 rounded mt-3" style={{ background: LIGHT, color: TEXT_DIM, lineHeight: 1.5 }}>
              💾 Les données sont sauvegardées dans ton navigateur. Pour partager les données, utiliser l'export CSV.
            </div>
          </div>
        )}

        {section === "grid" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
                  Heure de début
                </label>
                <select
                  value={settings.startHour}
                  onChange={(e) => setSettings({ ...settings, startHour: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded text-sm"
                  style={{ borderColor: BORDER }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
                  Heure de fin
                </label>
                <select
                  value={settings.endHour}
                  onChange={(e) => setSettings({ ...settings, endHour: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded text-sm"
                  style={{ borderColor: BORDER }}
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map(i => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
                Granularité
              </label>
              <select
                value={settings.slotMinutes}
                onChange={(e) => setSettings({ ...settings, slotMinutes: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded text-sm"
                style={{ borderColor: BORDER }}
              >
                <option value={15}>15 min (précis)</option>
                <option value={30}>30 min (recommandé)</option>
                <option value={60}>1 heure (rapide)</option>
              </select>
            </div>
            <div className="text-xs p-3 rounded" style={{ background: LIGHT, color: TEXT_DIM }}>
              ⚠️ Modifier la granularité ne réinterprète pas les saisies déjà faites.
            </div>
          </div>
        )}

        {section === "admin" && isAdminActive && (
          <AdminSettings
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            syncUrl={syncUrl}
            setSyncUrl={setSyncUrl}
            unlockedDates={unlockedDates}
            setUnlockedDates={setUnlockedDates}
          />
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full px-3 py-2.5 rounded text-sm font-semibold text-white"
          style={{ background: NAVY }}
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
}

function AdminSettings({ adminPassword, setAdminPassword, syncUrl, setSyncUrl, unlockedDates, setUnlockedDates }) {
  const [pwd, setPwd] = useState(adminPassword);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);

  const savePassword = () => {
    if (pwd.length < 4) return;
    setAdminPassword(pwd);
    setPwdSaved(true);
    setTimeout(() => setPwdSaved(false), 2000);
  };

  const removeUnlocked = (date) => {
    setUnlockedDates(prev => prev.filter(d => d !== date));
  };

  return (
    <div className="space-y-4">
      <div className="text-xs p-3 rounded border-l-4" style={{ background: `${ORANGE}10`, borderColor: ORANGE, color: NAVY, lineHeight: 1.5 }}>
        <strong>⚡ Mode admin</strong> — accès aux paramètres sensibles. Session active 30 min.
      </div>

      {/* Mot de passe admin */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
          <KeyRound size={12} className="inline mr-1" /> Mot de passe admin
        </label>
        <div className="flex gap-2">
          <input
            type={showPwd ? "text" : "password"}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="flex-1 px-3 py-2 border rounded text-sm"
            style={{ borderColor: BORDER }}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="px-3 py-2 rounded text-xs border"
            style={{ borderColor: BORDER, color: NAVY }}
          >
            {showPwd ? "Masquer" : "Voir"}
          </button>
          <button
            type="button"
            onClick={savePassword}
            disabled={pwd.length < 4 || pwd === adminPassword}
            className="px-3 py-2 rounded text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: pwdSaved ? "#0E9F6E" : NAVY }}
          >
            {pwdSaved ? "✓ Enregistré" : "Enregistrer"}
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: TEXT_DIM }}>Minimum 4 caractères. Pensez à le partager au successeur si besoin.</p>
      </div>

      {/* Cloud sync */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
          <Cloud size={12} className="inline mr-1" /> URL Google Sheets (sync cloud)
        </label>
        <input
          type="url"
          value={syncUrl}
          onChange={(e) => setSyncUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/.../exec"
          className="w-full px-3 py-2 border rounded text-xs font-mono"
          style={{ borderColor: BORDER }}
        />
        <p className="text-xs mt-1" style={{ color: TEXT_DIM }}>
          Sauvegarde automatique 2 sec après chaque modification. Laisser vide pour désactiver.
        </p>
      </div>

      {/* Dates déverrouillées */}
      {unlockedDates.length > 0 && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: NAVY }}>
            <Unlock size={12} className="inline mr-1" /> Dates déverrouillées en permanence
          </label>
          <div className="space-y-1 max-h-32 overflow-y-auto scroll-thin">
            {unlockedDates.map(d => (
              <div key={d} className="flex items-center justify-between px-3 py-1.5 rounded text-xs" style={{ background: LIGHT }}>
                <span style={{ color: NAVY }}>{formatDateFR(d)}</span>
                <button
                  type="button"
                  onClick={() => removeUnlocked(d)}
                  className="text-xs hover:underline"
                  style={{ color: ERROR }}
                >
                  Reverrouiller
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminLoginModal({ onTryLogin, onClose }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = () => {
    if (!pwd) return;
    const ok = onTryLogin(pwd);
    if (!ok) {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPwd("");
    }
  };

  return (
    <Modal title="🔒 Accès administrateur" onClose={onClose}>
      <div className={`space-y-4 ${shake ? "animate-pulse" : ""}`}>
        <p className="text-sm" style={{ color: TEXT_DIM, lineHeight: 1.5 }}>
          Entrer le mot de passe administrateur pour accéder aux paramètres avancés (cloud, déverrouillage, etc.)
        </p>
        <div>
          <input
            type="password"
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
            placeholder="Mot de passe"
            className="w-full px-3 py-2.5 border rounded text-sm"
            style={{
              borderColor: error ? ERROR : BORDER,
              background: error ? `${ERROR}05` : "white",
            }}
          />
          {error && (
            <p className="text-xs mt-1" style={{ color: ERROR }}>
              Mot de passe incorrect.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded text-sm font-medium border"
            style={{ borderColor: BORDER, color: NAVY }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!pwd}
            className="flex-1 px-3 py-2.5 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            Se connecter
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SyncIndicator({ status, lastSyncAt }) {
  const cfg = {
    idle:    { icon: Cloud,     color: BLUE,    bg: `${BLUE}15`,    label: "Cloud" },
    syncing: { icon: RefreshCw, color: ORANGE,  bg: `${ORANGE}15`,  label: "Sync..." },
    success: { icon: Check,     color: "#0E9F6E", bg: `#0E9F6E15`,  label: "OK" },
    error:   { icon: AlertCircle, color: ERROR, bg: `${ERROR}15`,   label: "Erreur" },
  }[status];
  const Icon = cfg.icon;
  return (
    <div
      className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
      style={{ background: cfg.bg, color: cfg.color }}
      title={lastSyncAt ? `Dernière sync : ${lastSyncAt.toLocaleTimeString("fr-CH")}` : "Sync cloud"}
    >
      <Icon size={12} className={status === "syncing" ? "animate-spin" : ""} />
      <span className="hidden sm:inline">{cfg.label}</span>
    </div>
  );
}

function Modal({ children, onClose, title, hideClose, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: "rgba(15, 23, 42, 0.5)" }}
      onClick={hideClose ? undefined : onClose}
    >
      <div
        className={`bg-white rounded-lg w-full p-5 shadow-xl ${wide ? "max-w-lg" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: NAVY }}>{title}</h3>
          {!hideClose && (
            <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded" aria-label="Fermer">
              <X size={18} style={{ color: TEXT_DIM, pointerEvents: "none" }} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirmer", cancelLabel = "Annuler", danger = false, onConfirm, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-sm w-full p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: danger ? `${ERROR}15` : `${BLUE}15` }}
          >
            <AlertCircle size={20} style={{ color: danger ? ERROR : BLUE }} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1" style={{ color: NAVY }}>{title}</h3>
            <p className="text-sm" style={{ color: TEXT_DIM, lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded text-sm font-medium border"
            style={{ borderColor: BORDER, color: NAVY, background: "white" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 px-3 py-2.5 rounded text-sm font-semibold text-white"
            style={{ background: danger ? ERROR : NAVY }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
