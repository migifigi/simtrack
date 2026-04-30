import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Trash2, Download, ChevronLeft, ChevronRight,
  Settings as SettingsIcon, Eraser, Edit3, Calendar,
  BarChart3, X, Check, Clock, Tag as TagIcon, FileText,
  Cloud, CloudOff, RefreshCw, AlertCircle, User, Menu
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const NAVY = "#1B3A6B";
const BLUE = "#2E5FAC";
const ORANGE = "#E07B39";
const LIGHT = "#F5F7FA";
const BORDER = "#E2E8F0";
const TEXT_DIM = "#64748B";
const SUCCESS = "#0E9F6E";
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

const todayISO = () => new Date().toISOString().split("T")[0];
const shiftDate = (iso, delta) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().split("T")[0];
};
const formatDateFR = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-CH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
};
const formatDateShort = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" });
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

export default function App() {
  // Core state
  const [tags, setTags] = useState(DEFAULT_TAGS);
  const [activeTagId, setActiveTagId] = useState("t1");
  const [currentDate, setCurrentDate] = useState(todayISO());
  const [daysData, setDaysData] = useState({});
  const [settings, setSettings] = useState({ startHour: 6, endHour: 19, slotMinutes: 30 });
  const [userName, setUserName] = useState("");
  const [syncUrl, setSyncUrl] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSyncAt, setLastSyncAt] = useState(null);

  // UI state
  const [editingTag, setEditingTag] = useState(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(COLOR_PALETTE[0]);
  const [eraseMode, setEraseMode] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState("day");
  const [activeTab, setActiveTab] = useState("saisie");
  const [loaded, setLoaded] = useState(false);

  const isDragging = useRef(false);
  const lastTouchedSlot = useRef(null);
  const syncTimeout = useRef(null);

  const slots = useMemo(
    () => generateSlots(settings.startHour, settings.endHour, settings.slotMinutes),
    [settings]
  );
  const dayData = daysData[currentDate] || {};
  const tagById = (id) => tags.find(t => t.id === id);

  // -------- Load from local storage --------
  useEffect(() => {
    const load = async () => {
      try {
        const [tagsRes, settingsRes, daysRes, prefsRes] = await Promise.all([
          Promise.resolve({ value: localStorage.getItem("tags") }),
          Promise.resolve({ value: localStorage.getItem("settings") }),
          Promise.resolve({ value: localStorage.getItem("daysData") }),
          Promise.resolve({ value: localStorage.getItem("prefs") }),
        ]);
        if (tagsRes?.value) setTags(JSON.parse(tagsRes.value));
        if (settingsRes?.value) setSettings(JSON.parse(settingsRes.value));
        if (daysRes?.value) setDaysData(JSON.parse(daysRes.value));
        if (prefsRes?.value) {
          const prefs = JSON.parse(prefsRes.value);
          if (prefs.userName) setUserName(prefs.userName);
          if (prefs.syncUrl) setSyncUrl(prefs.syncUrl);
          if (!prefs.userName) setShowFirstRun(true);
        } else {
          setShowFirstRun(true);
        }
      } catch (e) {}
      setLoaded(true);
    };
    load();
  }, []);

  // -------- Save to local storage --------
  useEffect(() => { if (loaded) localStorage.setItem("tags", JSON.stringify(tags)); }, [tags, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("settings", JSON.stringify(settings)); }, [settings, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("daysData", JSON.stringify(daysData)); }, [daysData, loaded]);
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("prefs", JSON.stringify({ userName, syncUrl }));
    }
  }, [userName, syncUrl, loaded]);

  // -------- Cloud sync --------
  const syncToCloud = async (date) => {
    if (!syncUrl || !userName) return;
    setSyncStatus("syncing");
    try {
      const dayPayload = daysData[date] || {};
      const entries = Object.entries(dayPayload).map(([idx, tagId]) => {
        const i = parseInt(idx);
        const tag = tagById(tagId);
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
        body: JSON.stringify({ action: "save", user: userName, date, entries }),
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
  };

  // Auto-sync (debounced)
  useEffect(() => {
    if (!loaded || !syncUrl || !userName) return;
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => syncToCloud(currentDate), 1500);
    return () => clearTimeout(syncTimeout.current);
  }, [daysData, syncUrl, userName, loaded]);

  const loadFromCloud = async () => {
    if (!syncUrl || !userName) {
      alert("Configurer d'abord le nom et l'URL Google Sheets dans les paramètres.");
      return;
    }
    setSyncStatus("syncing");
    try {
      const res = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "load", user: userName }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        // Reconstruct daysData from sheet rows
        // Sheet columns: User, Date, Idx, Start, End, Duration, TagName, TagColor, Saved
        const rebuilt = {};
        data.data.forEach(row => {
          const [user, date, idx, start, end, duration, tagName] = row;
          if (!rebuilt[date]) rebuilt[date] = {};
          // Find or create tag by name
          let tag = tags.find(t => t.name === tagName);
          if (!tag) {
            // Use existing tag IDs as best effort - here we just store name as fallback
            // For simplicity: skip if tag not found locally
            return;
          }
          rebuilt[date][idx] = tag.id;
        });
        setDaysData(prev => ({ ...prev, ...rebuilt }));
        setSyncStatus("success");
        setLastSyncAt(new Date());
        alert(`✅ ${Object.keys(rebuilt).length} jour(s) restauré(s) depuis Google Sheets.`);
      } else {
        setSyncStatus("error");
        alert("Erreur lors du chargement.");
      }
    } catch (e) {
      setSyncStatus("error");
      alert("Erreur de connexion : " + e.message);
    }
  };

  // -------- Slot interactions --------
  const setSlot = (slotIdx, tagId) => {
    setDaysData(prev => {
      const day = { ...(prev[currentDate] || {}) };
      if (tagId === null) delete day[slotIdx];
      else day[slotIdx] = tagId;
      return { ...prev, [currentDate]: day };
    });
  };

  const handleSlotInteraction = (slotIdx) => {
    if (eraseMode) setSlot(slotIdx, null);
    else setSlot(slotIdx, activeTagId);
  };

  const eraseSlot = (slotIdx) => {
    setSlot(slotIdx, null);
  };

  const handleMouseDown = (slotIdx) => {
    isDragging.current = true;
    lastTouchedSlot.current = slotIdx;
    handleSlotInteraction(slotIdx);
  };
  const handleMouseEnter = (slotIdx) => {
    if (isDragging.current && lastTouchedSlot.current !== slotIdx) {
      lastTouchedSlot.current = slotIdx;
      handleSlotInteraction(slotIdx);
    }
  };
  const handleMouseUp = () => {
    isDragging.current = false;
    lastTouchedSlot.current = null;
  };

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  // -------- Tag management --------
  const addTag = () => {
    if (!newTagName.trim()) return;
    const newTag = { id: `t${Date.now()}`, name: newTagName.trim(), color: newTagColor };
    setTags([...tags, newTag]);
    setNewTagName("");
    setNewTagColor(COLOR_PALETTE[0]);
    setShowAddTag(false);
  };

  const updateTag = (id, updates) => {
    setTags(tags.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTag = (id) => {
    setConfirmDialog({
      title: "Supprimer la catégorie ?",
      message: "Les créneaux déjà assignés à cette catégorie seront effacés.",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: () => {
        setTags(tags.filter(t => t.id !== id));
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
        if (activeTagId === id && tags.length > 1) {
          setActiveTagId(tags.find(t => t.id !== id)?.id);
        }
      }
    });
  };

  const clearDay = () => {
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
  };

  // -------- Analytics --------
  const getAnalyticsData = () => {
    let dates = [];
    if (analyticsRange === "day") dates = [currentDate];
    else if (analyticsRange === "week") {
      const d = new Date(currentDate + "T00:00:00");
      const dow = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dow - 1));
      for (let i = 0; i < 7; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        dates.push(dd.toISOString().split("T")[0]);
      }
    } else if (analyticsRange === "all") dates = Object.keys(daysData);

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

    return { data, totalMin, daysCount: dates.filter(d => daysData[d] && Object.keys(daysData[d]).length > 0).length };
  };

  const analytics = getAnalyticsData();

  // -------- CSV Export --------
  const exportCSV = () => {
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
    a.download = `suivi_activite_${userName.replace(/\s+/g,"_") || "user"}_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dayMinutes = Object.keys(dayData).length * settings.slotMinutes;

  // ========== RENDER ==========
  return (
    <div className="min-h-screen pb-20 lg:pb-6" style={{ background: LIGHT, fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap');
        body { margin: 0; -webkit-tap-highlight-color: transparent; }
        .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scroll-thin::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        button, [role="button"] { touch-action: manipulation; }
      `}</style>

      {/* HEADER */}
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
              <SyncIndicator status={syncStatus} hasUrl={!!syncUrl} lastSyncAt={lastSyncAt} />
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded border transition"
                style={{ borderColor: BORDER, color: NAVY, background: "white" }}
                title="Paramètres"
              >
                <SettingsIcon size={16} />
              </button>
              <button
                onClick={exportCSV}
                className="px-3 py-2 rounded text-xs lg:text-sm font-semibold flex items-center gap-1.5 text-white transition"
                style={{ background: ORANGE }}
              >
                <Download size={14} />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>

          {/* Date navigator - boutons fixes pour éviter chevauchements */}
          <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => setCurrentDate(shiftDate(currentDate, -1))}
              className="p-2 rounded hover:bg-slate-100 active:bg-slate-200 flex-shrink-0 relative z-10"
              style={{ background: LIGHT }}
              aria-label="Jour précédent"
            >
              <ChevronLeft size={20} style={{ color: NAVY }} />
            </button>

            <div className="flex-1 min-w-0 text-center">
              <div className="font-semibold capitalize text-sm lg:text-base truncate" style={{ color: NAVY }}>
                <span className="lg:hidden">{formatDateShort(currentDate)}</span>
                <span className="hidden lg:inline">{formatDateFR(currentDate)}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="text-xs border rounded px-2 py-0.5 max-w-[140px]"
                  style={{ borderColor: BORDER, color: TEXT_DIM }}
                />
                {currentDate !== todayISO() && (
                  <button
                    type="button"
                    onClick={() => setCurrentDate(todayISO())}
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
              onClick={() => setCurrentDate(shiftDate(currentDate, 1))}
              className="p-2 rounded hover:bg-slate-100 active:bg-slate-200 flex-shrink-0 relative z-10"
              style={{ background: LIGHT }}
              aria-label="Jour suivant"
            >
              <ChevronRight size={20} style={{ color: NAVY }} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="max-w-7xl mx-auto p-3 lg:p-6 lg:grid lg:grid-cols-12 lg:gap-6">
        {/* TAGS PANEL */}
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

        {/* GRID */}
        <main className={`lg:col-span-6 ${activeTab === "saisie" ? "block" : "hidden lg:block"}`}>
          <TimeGridPanel
            slots={slots}
            settings={settings}
            dayData={dayData}
            tagById={tagById}
            handleMouseDown={handleMouseDown}
            handleMouseEnter={handleMouseEnter}
            eraseMode={eraseMode}
            dayMinutes={dayMinutes}
            clearDay={clearDay}
            eraseSlot={eraseSlot}
          />
        </main>

        {/* ANALYTICS */}
        <aside className={`lg:col-span-3 mt-3 lg:mt-0 ${activeTab === "analyse" ? "block" : "hidden lg:block"}`}>
          <AnalyticsPanel
            analytics={analytics}
            analyticsRange={analyticsRange}
            setAnalyticsRange={setAnalyticsRange}
          />
        </aside>
      </div>

      {/* MOBILE TAB BAR */}
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
                onClick={() => setActiveTab(t.id)}
                className="flex flex-col items-center justify-center py-2.5 transition"
                style={{
                  color: active ? NAVY : TEXT_DIM,
                  background: active ? `${BLUE}10` : "transparent",
                }}
              >
                <Icon size={20} />
                <span className="text-xs mt-0.5 font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* MODALS */}
      {showFirstRun && (
        <Modal title="👋 Bienvenue" onClose={() => {}} hideClose>
          <FirstRunSetup
            userName={userName}
            setUserName={setUserName}
            onDone={() => setShowFirstRun(false)}
          />
        </Modal>
      )}

      {showAddTag && (
        <Modal onClose={() => setShowAddTag(false)} title="Nouvelle catégorie">
          <AddTagForm
            newTagName={newTagName}
            setNewTagName={setNewTagName}
            newTagColor={newTagColor}
            setNewTagColor={setNewTagColor}
            onCancel={() => setShowAddTag(false)}
            onAdd={addTag}
          />
        </Modal>
      )}

      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Paramètres" wide>
          <SettingsForm
            settings={settings}
            setSettings={setSettings}
            userName={userName}
            setUserName={setUserName}
            syncUrl={syncUrl}
            setSyncUrl={setSyncUrl}
            loadFromCloud={loadFromCloud}
            syncStatus={syncStatus}
            onClose={() => setShowSettings(false)}
          />
        </Modal>
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

// =================== SUB-COMPONENTS ===================

function SyncIndicator({ status, hasUrl, lastSyncAt }) {
  if (!hasUrl) {
    return (
      <div
        className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 hidden sm:flex"
        style={{ background: LIGHT, color: TEXT_DIM }}
        title="Aucune synchronisation cloud configurée"
      >
        <CloudOff size={12} />
        Local
      </div>
    );
  }
  const cfg = {
    idle:    { icon: Cloud,     color: BLUE,    bg: `${BLUE}15`,    label: "Synchronisé" },
    syncing: { icon: RefreshCw, color: ORANGE,  bg: `${ORANGE}15`,  label: "Sync..." },
    success: { icon: Check,     color: SUCCESS, bg: `${SUCCESS}15`, label: "Sync OK" },
    error:   { icon: AlertCircle, color: ERROR, bg: `${ERROR}15`,   label: "Erreur" },
  }[status];
  const Icon = cfg.icon;
  return (
    <div
      className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
      style={{ background: cfg.bg, color: cfg.color }}
      title={lastSyncAt ? `Dernière sync : ${lastSyncAt.toLocaleTimeString("fr-CH")}` : ""}
    >
      <Icon size={12} className={status === "syncing" ? "animate-spin" : ""} />
      <span className="hidden sm:inline">{cfg.label}</span>
    </div>
  );
}

function TagsPanel({ tags, activeTagId, setActiveTagId, eraseMode, setEraseMode, editingTag, setEditingTag, updateTag, deleteTag, setShowAddTag, tagById }) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "white", borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: NAVY }}>
          <TagIcon size={14} /> Catégories
        </h2>
        <button
          onClick={() => setShowAddTag(true)}
          className="w-8 h-8 rounded flex items-center justify-center text-white"
          style={{ background: NAVY }}
        >
          <Plus size={16} />
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: TEXT_DIM }}>
        Sélectionner puis cliquer (ou glisser sur la grille pour remplir plusieurs créneaux).
      </p>

      <div className="space-y-1.5 max-h-96 overflow-y-auto scroll-thin pr-1">
        {tags.map(tag => (
          <div
            key={tag.id}
            className={`group flex items-center gap-2 p-2 rounded cursor-pointer transition border-2`}
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
                onClick={(e) => { e.stopPropagation(); setEditingTag(tag.id); }}
                className="p-1.5 hover:bg-slate-100 rounded"
              >
                <Edit3 size={13} style={{ color: TEXT_DIM }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                className="p-1.5 hover:bg-red-50 rounded"
              >
                <Trash2 size={13} style={{ color: ERROR }} />
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
                key={c}
                onClick={() => updateTag(activeTagId, { color: c })}
                className="w-6 h-6 rounded border-2 transition"
                style={{
                  background: c,
                  borderColor: tagById(activeTagId).color === c ? NAVY : "transparent",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setEraseMode(!eraseMode)}
        className="mt-3 w-full px-3 py-2.5 rounded text-sm font-medium flex items-center justify-center gap-2 border transition"
        style={{
          borderColor: eraseMode ? ERROR : BORDER,
          background: eraseMode ? "#FEE2E2" : "white",
          color: eraseMode ? ERROR : NAVY,
        }}
      >
        <Eraser size={14} />
        {eraseMode ? "Mode gomme actif" : "Activer la gomme"}
      </button>
    </div>
  );
}

function TimeGridPanel({ slots, settings, dayData, tagById, handleMouseDown, handleMouseEnter, eraseMode, dayMinutes, clearDay, eraseSlot }) {
  return (
    <div className="rounded-lg border" style={{ background: "white", borderColor: BORDER }}>
      <div className="px-4 py-2 flex items-center justify-between text-xs border-b" style={{ background: LIGHT, borderColor: BORDER }}>
        <div className="flex items-center gap-2" style={{ color: TEXT_DIM }}>
          <Clock size={12} />
          <span><strong style={{ color: NAVY }}>{minutesToHours(dayMinutes)}</strong> sur {minutesToHours(slots.length * settings.slotMinutes)}</span>
        </div>
        {Object.keys(dayData).length > 0 && (
          <button
            onClick={clearDay}
            className="text-xs flex items-center gap-1 hover:underline font-medium"
            style={{ color: ERROR }}
          >
            <Trash2 size={11} /> Effacer le jour
          </button>
        )}
      </div>

      <div className="px-4 py-2 text-xs border-b" style={{ background: `${ORANGE}08`, borderColor: BORDER, color: TEXT_DIM }}>
        💡 <strong style={{ color: NAVY }}>Astuce :</strong> survoler/toucher un créneau rempli puis cliquer le ❌ pour effacer rapidement
      </div>

      <div className="p-3 lg:p-4 select-none">
        <div className="grid grid-cols-1 gap-1">
          {slots.map((slotLabel, idx) => (
            <SlotRow
              key={idx}
              idx={idx}
              slotLabel={slotLabel}
              tag={tagById(dayData[idx])}
              handleMouseDown={handleMouseDown}
              handleMouseEnter={handleMouseEnter}
              eraseMode={eraseMode}
              eraseSlot={eraseSlot}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotRow({ idx, slotLabel, tag, handleMouseDown, handleMouseEnter, eraseMode, eraseSlot }) {
  const isHourMark = slotLabel.endsWith(":00");
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const startLongPress = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      if (tag) {
        longPressTriggered.current = true;
        eraseSlot(idx);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

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
      <div
        onMouseDown={() => {
          startLongPress();
          handleMouseDown(idx);
        }}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onMouseEnter={() => handleMouseEnter(idx)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (tag) eraseSlot(idx);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          startLongPress();
          if (!longPressTriggered.current) handleMouseDown(idx);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          cancelLongPress();
        }}
        onTouchMove={(e) => {
          cancelLongPress();
          e.preventDefault();
          const touch = e.touches[0];
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          const slotAttr = el?.getAttribute?.("data-slot");
          if (slotAttr !== null && slotAttr !== undefined) {
            handleMouseEnter(parseInt(slotAttr));
          }
        }}
        data-slot={idx}
        className="flex-1 h-11 lg:h-9 rounded transition flex items-center px-3 text-sm border relative group"
        style={{
          background: tag ? tag.color : "white",
          color: tag ? "white" : TEXT_DIM,
          borderColor: tag ? tag.color : BORDER,
          fontWeight: tag ? 500 : 400,
          cursor: eraseMode ? "crosshair" : "pointer",
        }}
      >
        {tag ? (
          <>
            <span className="truncate flex-1 pointer-events-none">{tag.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eraseSlot(idx);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
                eraseSlot(idx);
              }}
              className="ml-2 w-7 h-7 lg:w-6 lg:h-6 rounded-full flex items-center justify-center transition opacity-70 hover:opacity-100 active:scale-90 flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.25)",
              }}
              title="Effacer ce créneau"
              aria-label="Effacer ce créneau"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <span className="text-xs italic opacity-60 pointer-events-none">
            {eraseMode ? "Toucher pour effacer" : "Toucher pour assigner"}
          </span>
        )}
      </div>
    </div>
  );
}

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

function FirstRunSetup({ userName, setUserName, onDone }) {
  const [name, setName] = useState(userName || "");
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm" style={{ color: TEXT_DIM, lineHeight: 1.5 }}>
          Pour commencer, indique ton prénom et nom. Cela permettra d'identifier tes saisies (utile si plusieurs collègues utilisent l'outil).
        </p>
      </div>
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
          onKeyDown={(e) => e.key === "Enter" && name.trim() && (setUserName(name.trim()), onDone())}
        />
      </div>
      <button
        disabled={!name.trim()}
        onClick={() => { setUserName(name.trim()); onDone(); }}
        className="w-full px-3 py-2.5 rounded text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: NAVY }}
      >
        Commencer
      </button>
      <p className="text-xs text-center" style={{ color: TEXT_DIM }}>
        Tu pourras configurer la sauvegarde Google Sheets dans les paramètres ⚙️
      </p>
    </div>
  );
}

function AddTagForm({ newTagName, setNewTagName, newTagColor, setNewTagColor, onCancel, onAdd }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
          Nom
        </label>
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
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
              key={c}
              onClick={() => setNewTagColor(c)}
              className="w-8 h-8 rounded border-2 transition"
              style={{
                background: c,
                borderColor: newTagColor === c ? NAVY : "transparent",
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2.5 rounded text-sm font-medium border"
          style={{ borderColor: BORDER, color: NAVY }}
        >
          Annuler
        </button>
        <button
          onClick={onAdd}
          disabled={!newTagName.trim()}
          className="flex-1 px-3 py-2.5 rounded text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: NAVY }}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function SettingsForm({ settings, setSettings, userName, setUserName, syncUrl, setSyncUrl, loadFromCloud, syncStatus, onClose }) {
  const [section, setSection] = useState("general");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded" style={{ background: LIGHT }}>
        {[
          { id: "general", label: "Général" },
          { id: "grid", label: "Grille" },
          { id: "cloud", label: "☁️ Cloud" },
        ].map(s => (
          <button
            key={s.id}
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
        <div className="space-y-3">
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

      {section === "cloud" && (
        <div className="space-y-3">
          <div className="text-xs p-3 rounded" style={{ background: `${BLUE}10`, color: NAVY, lineHeight: 1.5 }}>
            <strong>Synchronisation Google Sheets :</strong> tes données sont automatiquement enregistrées dans <strong>ton</strong> Google Sheet. Multi-utilisateurs, multi-appareils. Suivre la procédure d'installation (5 min) puis coller l'URL ci-dessous.
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: NAVY }}>
              URL du script Google Apps Script
            </label>
            <input
              type="url"
              value={syncUrl}
              onChange={(e) => setSyncUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 border rounded text-xs font-mono"
              style={{ borderColor: BORDER }}
            />
          </div>
          <button
            onClick={loadFromCloud}
            disabled={!syncUrl || syncStatus === "syncing"}
            className="w-full px-3 py-2.5 rounded text-sm font-medium flex items-center justify-center gap-2 border disabled:opacity-50"
            style={{ borderColor: BLUE, color: BLUE, background: "white" }}
          >
            <RefreshCw size={14} className={syncStatus === "syncing" ? "animate-spin" : ""} />
            Restaurer depuis Google Sheets
          </button>
          <p className="text-xs" style={{ color: TEXT_DIM }}>
            La sauvegarde s'effectue automatiquement à chaque modification (1,5 sec après).
          </p>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full px-3 py-2.5 rounded text-sm font-semibold text-white"
        style={{ background: NAVY }}
      >
        Fermer
      </button>
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
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
              <X size={18} style={{ color: TEXT_DIM }} />
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
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded text-sm font-medium border"
            style={{ borderColor: BORDER, color: NAVY, background: "white" }}
          >
            {cancelLabel}
          </button>
          <button
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
