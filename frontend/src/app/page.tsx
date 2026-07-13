"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { 
  Upload, 
  MapPin, 
  Settings, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  RotateCcw,
  Link as LinkIcon,
  Trash2,
  ChevronDown,
  Search,
  Type,
  Mail,
  User,
  Lock,
  LogOut,
  Database,
  LayoutDashboard,
  Eye,
  KeyRound,
  ShieldCheck,
  Activity,
  Edit2,
  Users,
  X,
  Menu
} from "lucide-react";
import JSZip from "jszip";
import { supabase, anonSupabase } from "@/lib/supabase";

// ─── Certificate Font Catalogue ─────────────────────────────────────────────
interface FontOption {
  value: string;     // value sent to backend / ReportLab name
  label: string;
  category: string;
  google?: boolean;
  preview?: string;  // override CSS font-family for preview
}

const CERTIFICATE_FONTS: FontOption[] = [
  // ── Built-in PDF fonts (always available, no download needed) ──
  { value: "Helvetica",             label: "Helvetica",          category: "Built-in" },
  { value: "Helvetica-Bold",        label: "Helvetica Bold",     category: "Built-in" },
  { value: "Times-Roman",           label: "Times Roman",        category: "Built-in", preview: "Times New Roman" },
  { value: "Times-Bold",            label: "Times Bold",         category: "Built-in", preview: "Times New Roman" },
  { value: "Courier",               label: "Courier",            category: "Built-in" },
  // ── Elegant Serif (Google) ──
  { value: "Playfair Display",      label: "Playfair Display",   category: "Serif",     google: true },
  { value: "Cinzel",                label: "Cinzel",             category: "Serif",     google: true },
  { value: "Cinzel Decorative",     label: "Cinzel Decorative",  category: "Serif",     google: true },
  { value: "Cormorant Garamond",    label: "Cormorant Garamond", category: "Serif",     google: true },
  { value: "EB Garamond",           label: "EB Garamond",        category: "Serif",     google: true },
  { value: "Lora",                  label: "Lora",               category: "Serif",     google: true },
  { value: "Merriweather",          label: "Merriweather",       category: "Serif",     google: true },
  { value: "Libre Baskerville",     label: "Libre Baskerville",  category: "Serif",     google: true },
  { value: "Crimson Text",          label: "Crimson Text",       category: "Serif",     google: true },
  { value: "Spectral",              label: "Spectral",           category: "Serif",     google: true },
  { value: "Bitter",                label: "Bitter",             category: "Serif",     google: true },
  { value: "Zilla Slab",            label: "Zilla Slab",         category: "Serif",     google: true },
  // ── Modern Sans-Serif (Google) ──
  { value: "Montserrat",            label: "Montserrat",         category: "Sans-Serif", google: true },
  { value: "Open Sans",             label: "Open Sans",          category: "Sans-Serif", google: true },
  { value: "Roboto",                label: "Roboto",             category: "Sans-Serif", google: true },
  { value: "Poppins",               label: "Poppins",            category: "Sans-Serif", google: true },
  { value: "Raleway",               label: "Raleway",            category: "Sans-Serif", google: true },
  { value: "Nunito",                label: "Nunito",             category: "Sans-Serif", google: true },
  { value: "Lato",                  label: "Lato",               category: "Sans-Serif", google: true },
  { value: "Inter",                 label: "Inter",              category: "Sans-Serif", google: true },
  { value: "Josefin Sans",          label: "Josefin Sans",       category: "Sans-Serif", google: true },
  { value: "Oswald",                label: "Oswald",             category: "Sans-Serif", google: true },
  { value: "Ubuntu",                label: "Ubuntu",             category: "Sans-Serif", google: true },
  { value: "Cabin",                 label: "Cabin",              category: "Sans-Serif", google: true },
  { value: "Exo 2",                 label: "Exo 2",              category: "Sans-Serif", google: true },
  { value: "Quicksand",             label: "Quicksand",          category: "Sans-Serif", google: true },
  { value: "Varela Round",          label: "Varela Round",       category: "Sans-Serif", google: true },
  // ── Script / Calligraphy (Google) ──
  { value: "Dancing Script",        label: "Dancing Script",     category: "Script",    google: true },
  { value: "Great Vibes",           label: "Great Vibes",        category: "Script",    google: true },
  { value: "Pacifico",              label: "Pacifico",           category: "Display",   google: true },
  { value: "Sacramento",            label: "Sacramento",         category: "Script",    google: true },
  { value: "Alex Brush",            label: "Alex Brush",         category: "Script",    google: true },
  { value: "Allura",                label: "Allura",             category: "Script",    google: true },
  { value: "Pinyon Script",         label: "Pinyon Script",      category: "Script",    google: true },
  { value: "Petit Formal Script",   label: "Petit Formal Script",category: "Script",    google: true },
];

const CATEGORY_ORDER = ["Built-in", "Serif", "Sans-Serif", "Script", "Display"];

// ─── FontPicker Component ────────────────────────────────────────────────────
interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  accentColor?: string;
}

function FontPicker({ value, onChange, accentColor = "#6d28d9" }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? CERTIFICATE_FONTS.filter(f =>
        f.label.toLowerCase().includes(query.toLowerCase()) ||
        f.category.toLowerCase().includes(query.toLowerCase())
      )
    : CERTIFICATE_FONTS;

  // Group by category in defined order
  const grouped = CATEGORY_ORDER.reduce<Record<string, FontOption[]>>((acc, cat) => {
    const items = filtered.filter(f => f.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const selectedFont = CERTIFICATE_FONTS.find(f => f.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        className="w-full flex items-center justify-between gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm shadow-sm hover:border-violet-400 hover:shadow-md transition-all cursor-pointer"
      >
        <span
          className="truncate font-medium text-zinc-800"
          style={{ fontFamily: selectedFont?.preview ?? selectedFont?.value ?? "inherit" }}
        >
          {selectedFont?.label ?? value}
        </span>
        <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-100">
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5">
              <Search size={12} className="text-zinc-400 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search fonts…"
                className="flex-1 text-xs bg-transparent outline-none text-zinc-700 placeholder:text-zinc-400"
              />
            </div>
          </div>
          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(grouped).map(([cat, fonts]) => (
              <div key={cat}>
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 bg-zinc-50 border-b border-zinc-100">{cat}</div>
                {fonts.map(font => (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => { onChange(font.value); setOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-[13px] transition-colors cursor-pointer hover:bg-violet-50 ${
                      font.value === value ? "bg-violet-100 text-violet-700" : "text-zinc-700"
                    }`}
                    style={{ fontFamily: font.preview ?? font.value }}
                  >
                    {font.label}
                    {font.value === value && <span className="float-right text-violet-500 text-xs">✓</span>}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="px-3 py-6 text-xs text-zinc-400 text-center">No fonts match &quot;{query}&quot;</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface Point {
  x: number; // 0 to 1
  y: number; // 0 to 1
}

interface CertRow {
  name: string;
  college: string;
  year: string;
  month?: string;
  department?: string;
  cert_code?: string;
  pdf_url?: string;
  status: "active" | "error" | "pending" | "processing";
  error?: string;
  intern_id?: string;
  email?: string;
  email_status?: "pending" | "sending" | "sent" | "failed";
}

// ─── Field Box type (left-top corner + width/height, all as fractions 0–1) ──────────────────
interface FieldBox { x: number; y: number; w: number; h: number; }

// Sample preview text shown inside each box on the design canvas
const FIELD_SAMPLES: Record<string, string> = {
  name:       "Candidate Name",
  college:    "Institute Name",
  year:       "II Year",
  department: "Computer Science",
  role:       "Intern",
  project:    "Web Development",
  month:      "June",
  date:       "07-07-2026",
};

// Per-field color palette
const FIELD_CFG: Record<string, { border: string; bg: string; text: string; label: string }> = {
  name:       { border: "#7c3aed", bg: "rgba(124,58,237,0.10)",  text: "#7c3aed", label: "NAME" },
  college:    { border: "#4f46e5", bg: "rgba(79,70,229,0.10)",   text: "#4f46e5", label: "COLLEGE" },
  year:       { border: "#0891b2", bg: "rgba(8,145,178,0.10)",   text: "#0891b2", label: "YEAR" },
  department: { border: "#ea580c", bg: "rgba(234,88,12,0.10)",   text: "#ea580c", label: "DEPT" },
  role:       { border: "#db2777", bg: "rgba(219,39,119,0.10)",  text: "#db2777", label: "ROLE" },
  project:    { border: "#d97706", bg: "rgba(217,119,6,0.10)",   text: "#d97706", label: "PROJECT" },
  month:      { border: "#0d9488", bg: "rgba(13,148,136,0.10)",  text: "#0d9488", label: "MONTH" },
  date:       { border: "#2563eb", bg: "rgba(37,99,235,0.10)",   text: "#2563eb", label: "DATE" },
};

export default function AdminDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Profile fields
  const [profileName, setProfileName] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileConfirmPassword, setProfileConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Tab State: "generator" | "history" | "profile"
  const [activeTab, setActiveTab] = useState<"generator" | "history" | "profile">("generator");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // History state
  const [historyCerts, setHistoryCerts] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingHistoryZip, setIsExportingHistoryZip] = useState(false);
  const [historyZipProgress, setHistoryZipProgress] = useState({ done: 0, total: 0 });
  const [selectedCertIds, setSelectedCertIds] = useState<Set<string>>(new Set());
  const [isSendingHistoryEmails, setIsSendingHistoryEmails] = useState(false);
  const [historyEmailProgress, setHistoryEmailProgress] = useState({ done: 0, total: 0 });
  
  // Edit Intern modal states
  const [editingCert, setEditingCert] = useState<any | null>(null);
  const [editInternId, setEditInternId] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Dynamically calculate stats and unique filter values from historyCerts
  const { batchCounts, totalUniqueInterns, uniqueDepts, uniqueDomains, uniqueColleges, uniqueBatches, uniqueProjects } = React.useMemo(() => {
    const internMap = new Map<string, { name: string; email: string; batch: string }>();
    const depts = new Set<string>();
    const domains = new Set<string>();
    const colleges = new Set<string>();
    const batches = new Set<string>();
    const projects = new Set<string>();

    historyCerts.forEach((c) => {
      // Collect raw values for unique filters
      const d = c.intern?.department || c.department;
      if (d) depts.add(d);
      
      const r = c.intern?.role || c.role;
      if (r) domains.add(r);
      
      const col = c.intern?.college || c.college;
      if (col) colleges.add(col);
      
      const b = c.intern?.month || c.month;
      if (b) batches.add(b);

      const p = c.intern?.project || c.project;
      if (p) projects.add(p);

      // Collect for unique intern grouping
      const internId = c.intern_id || `${c.intern?.name || c.name || ''}-${c.intern?.email || ''}`;
      if (!internMap.has(internId)) {
        internMap.set(internId, {
          name: c.intern?.name || c.name || "Unknown",
          email: c.intern?.email || "",
          batch: b || "Unknown Batch",
        });
      }
    });

    const counts: Record<string, number> = {};
    let total = 0;

    internMap.forEach((intern) => {
      const b = intern.batch;
      counts[b] = (counts[b] || 0) + 1;
      total++;
    });

    return {
      batchCounts: counts,
      totalUniqueInterns: total,
      uniqueDepts: Array.from(depts).sort(),
      uniqueDomains: Array.from(domains).sort(),
      uniqueColleges: Array.from(colleges).sort(),
      uniqueBatches: Array.from(batches).sort(),
      uniqueProjects: Array.from(projects).sort(),
    };
  }, [historyCerts]);

  const filteredCerts = React.useMemo(() => {
    return historyCerts.filter((c) => {
      const q = historyQuery.toLowerCase().trim();
      if (q) {
        const name = (c.intern?.name || c.name || "").toLowerCase();
        const college = (c.intern?.college || c.college || "").toLowerCase();
        const code = (c.cert_code || "").toLowerCase();
        const email = (c.intern?.email || "").toLowerCase();
        const matchesQuery = name.includes(q) || college.includes(q) || code.includes(q) || email.includes(q);
        if (!matchesQuery) return false;
      }

      const dept = c.intern?.department || c.department;
      if (selectedDept && dept !== selectedDept) return false;

      const r = c.intern?.role || c.role;
      if (selectedDomain && r !== selectedDomain) return false;

      const proj = c.intern?.project || c.project;
      if (selectedProject && proj !== selectedProject) return false;

      const col = c.intern?.college || c.college;
      if (selectedCollege && col !== selectedCollege) return false;

      const batch = c.intern?.month || c.month;
      if (selectedBatch && batch !== selectedBatch) return false;

      return true;
    });
  }, [historyCerts, historyQuery, selectedDept, selectedDomain, selectedProject, selectedCollege, selectedBatch]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setProfileName(session.user.user_metadata?.full_name || "");
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setProfileName(session.user.user_metadata?.full_name || "");
      }
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthMsg("");
    setAuthSubmitting(true);

    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              full_name: authName || "Admin User",
            },
          },
        });
        if (error) throw error;
        setAuthMsg("Registration successful! Please log in.");
        setAuthMode("login");
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveTab("generator");
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileSubmitting(true);

    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setProfileError("Passwords do not match.");
      setProfileSubmitting(false);
      return;
    }

    try {
      const updates: any = {
        data: { full_name: profileName },
      };
      if (profilePassword) {
        updates.password = profilePassword;
      }
      const { data, error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      setProfileSuccess("Profile updated successfully!");
      setProfilePassword("");
      setProfileConfirmPassword("");
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const fetchHistoryCerts = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    setSelectedCertIds(new Set());
    try {
      const { data, error } = await anonSupabase
        .from("certificates")
        .select("*, intern:interns(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setHistoryCerts(data || []);
    } catch (err: any) {
      console.error(err);
      setHistoryError(err.message || "Failed to load certificates history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || activeTab !== "history") return;

    // Fetch initial data
    fetchHistoryCerts();

    // Subscribe to realtime database changes for certificates
    const certificatesChannel = anonSupabase
      .channel("history-certificates-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "certificates" },
        (payload) => {
          console.log("Realtime change in certificates:", payload);
          fetchHistoryCerts();
        }
      )
      .subscribe();

    // Subscribe to realtime database changes for interns
    const internsChannel = anonSupabase
      .channel("history-interns-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interns" },
        (payload) => {
          console.log("Realtime change in interns:", payload);
          fetchHistoryCerts();
        }
      )
      .subscribe();

    return () => {
      anonSupabase.removeChannel(certificatesChannel);
      anonSupabase.removeChannel(internsChannel);
    };
  }, [session, activeTab, fetchHistoryCerts]);

  const handleSendHistoryEmail = async (internId: string) => {
    if (!internId) return;
    
    // Update local state to sending
    setHistoryCerts((prev) =>
      prev.map((c) => (c.intern_id === internId ? { ...c, intern: { ...c.intern, email_status: "sending" } } : c))
    );

    try {
      const base = backendUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/interns/${internId}/send-email`, {
        method: "POST"
      });
      const data = await res.json();
      
      const nextStatus = res.ok && data.status === "success" ? "sent" : "failed";
      setHistoryCerts((prev) =>
        prev.map((c) => (c.intern_id === internId ? { ...c, intern: { ...c.intern, email_status: nextStatus } } : c))
      );
    } catch (err) {
      console.error(err);
      setHistoryCerts((prev) =>
        prev.map((c) => (c.intern_id === internId ? { ...c, intern: { ...c.intern, email_status: "failed" } } : c))
      );
    }
  };

  const handleSendFilteredEmails = async () => {
    const isSelectedFlow = selectedCertIds.size > 0;
    
    // Filter active certificates that have a valid intern_id
    // If nothing selected: filter out already sent ones (i.e. keep those whose email_status !== 'sent')
    const activeCerts = isSelectedFlow
      ? historyCerts.filter((c) => selectedCertIds.has(c.id) && c.status === "active" && c.intern_id)
      : filteredCerts.filter((c) => c.status === "active" && c.intern_id && c.intern?.email_status !== "sent");

    // Find unique intern IDs
    const uniqueInternIds = Array.from(new Set(activeCerts.map((c) => c.intern_id).filter(Boolean))) as string[];

    if (uniqueInternIds.length === 0) {
      if (isSelectedFlow) {
        alert("No active interns with valid certificates selected to email.");
      } else {
        alert("All matching interns have already received their emails (or no active certificates match the filters).");
      }
      return;
    }

    const confirmMsg = isSelectedFlow
      ? `Are you sure you want to send emails to the ${uniqueInternIds.length} selected intern(s)?`
      : `Are you sure you want to send emails to the ${uniqueInternIds.length} pending/un-sent intern(s)?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSendingHistoryEmails(true);
    setHistoryEmailProgress({ done: 0, total: uniqueInternIds.length });

    for (let i = 0; i < uniqueInternIds.length; i++) {
      const internId = uniqueInternIds[i];
      
      // Update local state to sending
      setHistoryCerts((prev) =>
        prev.map((c) => (c.intern_id === internId ? { ...c, intern: { ...c.intern, email_status: "sending" } } : c))
      );

      try {
        const base = backendUrl.replace(/\/+$/, "");
        const res = await fetch(`${base}/api/interns/${internId}/send-email`, {
          method: "POST"
        });
        const data = await res.json();
        
        const nextStatus = res.ok && data.status === "success" ? "sent" : "failed";
        setHistoryCerts((prev) =>
          prev.map((c) => (c.intern_id === internId ? { ...c, intern: { ...c.intern, email_status: nextStatus } } : c))
        );
      } catch (err) {
        console.error(`Failed to send email to intern ${internId}`, err);
        setHistoryCerts((prev) =>
          prev.map((c) => (c.intern_id === internId ? { ...c, intern: { ...c.intern, email_status: "failed" } } : c))
        );
      }
      
      setHistoryEmailProgress((prev) => ({ ...prev, done: i + 1 }));
    }

    setIsSendingHistoryEmails(false);
    setHistoryEmailProgress({ done: 0, total: 0 });
    alert("Batch email process complete!");
  };

  const handleStartEdit = (cert: any) => {
    if (!cert.intern) {
      alert("This certificate does not have an associated intern record to edit.");
      return;
    }
    const intern = cert.intern;
    setEditingCert(cert);
    setEditInternId(intern.id);
    setEditName(intern.name || "");
    setEditEmail(intern.email || "");
    setEditCollege(intern.college || "");
    setEditDept(intern.department || "");
    setEditRole(intern.role || "");
    setEditProject(intern.project || "");
    setEditMonth(intern.month || "");
    setEditYear(intern.year || "");
    setEditDate(intern.date || "");
    setEditError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEdit(true);
    setEditError("");

    try {
      const base = backendUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/interns/${editInternId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          college: editCollege.trim(),
          department: editDept.trim(),
          role: editRole.trim(),
          project: editProject.trim(),
          month: editMonth.trim(),
          date: editDate.trim(),
          year: editYear.trim(),
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to update record.");
      }

      setEditingCert(null);
      fetchHistoryCerts();
      alert("Intern and certificate records updated successfully!");
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "Failed to save edits.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDownloadFilteredExcel = async () => {
    setIsExportingExcel(true);
    try {
      const params = new URLSearchParams();
      if (selectedCertIds.size > 0) {
        params.append("ids", Array.from(selectedCertIds).join(","));
      } else {
        if (historyQuery.trim()) params.append("query", historyQuery.trim());
        if (selectedDept) params.append("dept", selectedDept);
        if (selectedDomain) params.append("domain", selectedDomain);
        if (selectedProject) params.append("project", selectedProject);
        if (selectedCollege) params.append("college", selectedCollege);
        if (selectedBatch) params.append("batch", selectedBatch);
      }

      const base = backendUrl.replace(/\/+$/, "");
      const downloadUrl = `${base}/api/certificates/export?${params.toString()}`;
      
      window.open(downloadUrl, "_blank");
    } catch (err) {
      console.error("Failed to export excel", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadHistoryZip = async (certsList: any[]) => {
    const certsWithPdf = certsList.filter((c) => c.pdf_url && c.status === "active");
    if (certsWithPdf.length === 0) return;
    
    setIsExportingHistoryZip(true);
    setHistoryZipProgress({ done: 0, total: certsWithPdf.length });
    
    try {
      const zip = new JSZip();
      let zipTitle = "Certificates_History";
      
      const certTypeLabels: Record<string, string> = {
        lor: "Letter of Recommendation",
        experience: "Experience Letter",
        internship: "Internship Certificate"
      };

      for (let i = 0; i < certsWithPdf.length; i++) {
        const cert = certsWithPdf[i];
        if (!cert.pdf_url) continue;
        const url = getResolvedPdfUrl(cert.pdf_url);
        try {
          const res = await fetch(url);
          const blob = await res.arrayBuffer();
          
          const certTitle = certTypeLabels[cert.cert_type] || "Certificate";
          const safeName = (cert.intern?.name || cert.name || `certificate_${i + 1}`).replace(/[^a-zA-Z0-9_\- ]/g, "_");
          zip.file(`${safeName}_(${certTitle}).pdf`, blob);
        } catch (err) {
          console.error("Failed to fetch PDF for zip", err);
        }
        setHistoryZipProgress({ done: i + 1, total: certsWithPdf.length });
      }
      
      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const downloadUrl = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${zipTitle}.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to generate history ZIP", err);
    } finally {
      setIsExportingHistoryZip(false);
      setHistoryZipProgress({ done: 0, total: 0 });
    }
  };

  // App state (1 = upload assets, 2 = generation run)
  const [step, setStep] = useState<1 | 2>(1);
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    if (typeof window === "undefined") return envUrl;
    return localStorage.getItem("cert_generator_backend_url") || envUrl;
  });

  const getResolvedPdfUrl = useCallback((url: string | undefined) => {
    if (!url) return "";
    const markers = ["/api/certificates/", "/certificate/"];
    for (const marker of markers) {
      const index = url.indexOf(marker);
      if (index !== -1) {
        const path = url.substring(index);
        const base = backendUrl.replace(/\/+$/, "");
        return `${base}${path}`;
      }
    }
    return url;
  }, [backendUrl]);
  
  // Files
  const [lorTemplateFile, setLorTemplateFile] = useState<File | null>(null);
  const [experienceTemplateFile, setExperienceTemplateFile] = useState<File | null>(null);
  const [internshipTemplateFile, setInternshipTemplateFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  
  // Batch details
  const [batchId, setBatchId] = useState<string>("");
  const [batchMonth, setBatchMonth] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");

  // Loaded Template ID (used as batch_id)
  const [templateId, setTemplateId] = useState<string>("");
  
  // Generator states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [excelDownloadUrl, setExcelDownloadUrl] = useState<string>("");
  const [generationResults, setGenerationResults] = useState<CertRow[]>([]);
  const [genStats, setGenStats] = useState({ success: 0, failed: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const handleDownloadAllZip = async () => {
    const rows = generationResults.filter((r) => r.pdf_url && r.status === "active");
    if (rows.length === 0) return;
    setIsZipping(true);
    setZipProgress({ done: 0, total: rows.length });
    try {
      const zip = new JSZip();
      let zipTitle = "Certificates";
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.pdf_url) continue;
        const url = getResolvedPdfUrl(row.pdf_url);
        try {
          const res = await fetch(url);
          const blob = await res.arrayBuffer();
          
          // Parse cert title from the PDF filename
          const filename = url.substring(url.lastIndexOf('/') + 1);
          const match = filename.match(/\(([^)]+)\)/);
          const certTitle = match ? match[1].replace(/_/g, ' ') : "Certificate";
          
          if (certTitle !== "Certificate" && zipTitle === "Certificates") {
            zipTitle = certTitle;
          }
          
          const safeName = (row.name || `certificate_${i + 1}`).replace(/[^a-zA-Z0-9_\- ]/g, "_");
          zip.file(`${safeName}_(${certTitle}).pdf`, blob);
        } catch {
          // skip failed fetches silently
        }
        setZipProgress({ done: i + 1, total: rows.length });
      }
      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${zipTitle}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
      setZipProgress({ done: 0, total: 0 });
    }
  };

  const [isSendingEmails, setIsSendingEmails] = useState<boolean>(false);

  const handleSendEmail = async (index: number) => {
    const row = generationResults[index];
    if (!row.intern_id) return;

    // Set row status to sending for all rows with the same intern_id
    setGenerationResults((prev) =>
      prev.map((r) => (r.intern_id === row.intern_id ? { ...r, email_status: "sending" } : r))
    );

    try {
      const base = backendUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/interns/${row.intern_id}/send-email`, {
        method: "POST"
      });
      const data = await res.json();
      
      setGenerationResults((prev) => {
        const nextStatus = res.ok && data.status === "success" ? "sent" : "failed";
        return prev.map((r) => (r.intern_id === row.intern_id ? { ...r, email_status: nextStatus } : r));
      });
    } catch (err) {
      console.error(err);
      setGenerationResults((prev) =>
        prev.map((r) => (r.intern_id === row.intern_id ? { ...r, email_status: "failed" } : r))
      );
    }
  };

  const handleSendAllEmails = async () => {
    // Find unique intern_ids that are pending
    const seen = new Set<string>();
    const pendingIndices: number[] = [];

    generationResults.forEach((row, idx) => {
      if (row.intern_id && row.status === "active" && !seen.has(row.intern_id)) {
        seen.add(row.intern_id);
        if (row.email_status !== "sent") {
          pendingIndices.push(idx);
        }
      }
    });

    if (pendingIndices.length === 0) {
      alert("No pending emails to send.");
      return;
    }

    setIsSendingEmails(true);
    for (let i = 0; i < pendingIndices.length; i++) {
      const idx = pendingIndices[i];
      await handleSendEmail(idx);
    }
    setIsSendingEmails(false);
  };

  // Hero Section Fading Slideshow
  const heroImages = ["/hero-img.jpg", "/hero-1.jpg", "/hero-2.jpg", "/hero-3.jpg"];
  const [currentHeroImageIdx, setCurrentHeroImageIdx] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroImageIdx((prev) => (prev + 1) % heroImages.length);
    }, 4500); // Cross-fade every 4.5 seconds
    return () => clearInterval(timer);
  }, [heroImages.length]);
  
  const saveBackendUrl = (url: string) => {
    setBackendUrl(url);
    localStorage.setItem("cert_generator_backend_url", url);
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  };

  // Step 1: Upload templates and metadata
  const [isUploadingTemplate, setIsUploadingTemplate] = useState<boolean>(false);

  // Processing animation sub-steps state
  const [activeSubStep, setActiveSubStep] = useState<number>(0);

  const PROCESS_STEPS = {
    1: [
      "Uploading LOR, Experience, and Internship templates...",
      "Registering batch metadata in Supabase DB...",
      "Generating unique batch records..."
    ],
    2: [
      "Parsing Excel data sheet...",
      "Creating intern profiles in Supabase...",
      "Resolving certificate requirements (YES/NO columns)...",
      "Registering credentials and scheduling email dispatches...",
      "Completing generation run..."
    ]
  };

  const isProcessing = isUploadingTemplate || isGenerating;
  const processingStage = isUploadingTemplate ? 1 : isGenerating ? 2 : 0;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setActiveSubStep(0);
      const stepsCount = processingStage === 1 ? 3 : 5;
      interval = setInterval(() => {
        setActiveSubStep((prev) => (prev < stepsCount - 1 ? prev + 1 : prev));
      }, 1200);
    } else {
      setActiveSubStep(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, processingStage]);

  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !batchMonth || !issueDate) {
      setErrorMsg("Please fill in all batch details (Batch ID, Month, and Issue Date).");
      return;
    }
    if (!lorTemplateFile && !experienceTemplateFile && !internshipTemplateFile) {
      setErrorMsg("Please upload at least one HTML or PPTX certificate template (LOR, Experience, or Internship).");
      return;
    }

    setIsUploadingTemplate(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("batch_id", batchId.trim());
    formData.append("month", batchMonth.trim());
    formData.append("issue_date", issueDate);
    
    if (lorTemplateFile) formData.append("lor_template", lorTemplateFile);
    if (experienceTemplateFile) formData.append("experience_template", experienceTemplateFile);
    if (internshipTemplateFile) formData.append("internship_template", internshipTemplateFile);

    try {
      const response = await fetch(`${backendUrl}/api/batch/create`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create batch record.");
      }

      const data = await response.json();
      setTemplateId(data.batch_id); // Save batch_id in templateId to maintain compat with Step 2 UI
      
      // Auto-advance to Step 2
      setStep(2);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof TypeError) {
        setErrorMsg("Network error: failed to reach backend. Check that the backend is running and the Backend URL is correct.");
      } else {
        setErrorMsg(getErrorMessage(err) || "An error occurred connecting to the backend server.");
      }
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  // Step 2: Trigger Generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile || !templateId) return;

    setIsGenerating(true);
    setExcelDownloadUrl("");
    setGenerationResults([]);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("batch_id", templateId);
    formData.append("excel_file", excelFile);

    try {
      const response = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to generate certificates");
      }

      const data = await response.json();
      setExcelDownloadUrl(data.excel_download_url);
      setGenerationResults(data.rows);

      // Compute statistics
      const total = data.rows.length;
      const rows = data.rows as CertRow[];
      const success = rows.filter((row) => row.status === "active").length;
      const failed = total - success;
      setGenStats({ success, failed, total });

    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(getErrorMessage(err) || "Certificate generation failed. Verify file parameters.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setLorTemplateFile(null);
    setExperienceTemplateFile(null);
    setInternshipTemplateFile(null);
    setExcelFile(null);
    setBatchId("");
    setBatchMonth("");
    setIssueDate("");
    setTemplateId("");
    setExcelDownloadUrl("");
    setGenerationResults([]);
    setStep(1);
    setErrorMsg("");
  };

  if (!isMounted) {
    return null;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f6]">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-zinc-650">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] p-6 relative overflow-hidden text-zinc-850 font-sans">
        {/* Abstract background blobs for modern vibe */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-violet-650/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] h-[350px] bg-emerald-650/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-[32px] p-8 shadow-[0_15px_50px_rgba(0,0,0,0.05)] relative overflow-hidden">
          <div className="flex flex-col items-center mb-8">
            <div className="relative h-16 w-16 rounded-2xl bg-black shadow-md flex items-center justify-center border border-zinc-800 mb-4 animate-[pulse_4s_infinite]">
              <div className="relative h-12 w-12">
                <Image src="/coptercode-logo-bw.svg" alt="CopterCode Logo" fill className="object-contain" />
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900">CopterCode</h2>
            <p className="text-zinc-500 text-xs mt-1">Intern Certificate Hub — Admin Panel</p>
          </div>

          <div className="flex bg-zinc-100 p-1.5 rounded-xl border border-zinc-200 mb-6">
            <button
              onClick={() => { setAuthMode("login"); setAuthError(""); setAuthMsg(""); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === "login" ? "bg-white text-stone-900 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:text-zinc-850"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthMsg(""); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === "signup" ? "bg-white text-stone-900 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:text-zinc-850"
              }`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3.5 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Full Name</label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5" />
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full text-xs bg-zinc-55 border border-zinc-200 rounded-xl pl-10 pr-4 py-3.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@coptercode.com"
                  className="w-full text-xs bg-zinc-55 border border-zinc-200 rounded-xl pl-10 pr-4 py-3.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Password</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5" />
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs bg-zinc-55 border border-zinc-200 rounded-xl pl-10 pr-4 py-3.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full mt-2 bg-[#5844e9] hover:bg-[#4338ca] disabled:opacity-60 text-white font-extrabold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-xs tracking-wider uppercase cursor-pointer"
            >
              {authSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                authMode === "login" ? "Log In to Panel" : "Register Admin User"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-16 text-stone-850">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#faf9f6]" />

      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          {/* Logo & branding */}
          <div className="flex items-center gap-3.5">
            <div className="relative h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-black shadow-sm flex items-center justify-center">
              <div className="relative h-10 w-10 md:h-12 md:w-12">
                <Image src="/coptercode-logo-bw.svg" alt="CopterCode logo" fill className="object-contain" priority />
              </div>
            </div>
            <span className="font-sans text-xl md:text-2xl font-bold tracking-tight text-[#0f172a]">
              CopterCode
            </span>
          </div>

          {/* Navigation Workspace Switcher Tabs (Desktop only) */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-100 rounded-xl p-1 border border-zinc-200 shadow-sm">
            <button
              onClick={() => setActiveTab("generator")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "generator" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <LayoutDashboard size={14} /> Generator
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "history" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <Database size={14} /> Database History
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "profile" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <User size={14} /> Profile
            </button>
          </div>

          {/* Desktop User Panel / Mobile Menu Button */}
          <div className="flex items-center gap-4">
            {/* Desktop user greeting and logout */}
            <div className="hidden md:flex items-center gap-3 border-l border-zinc-200 pl-4">
              <div className="text-right">
                <span className="block text-[9px] font-bold text-zinc-400 uppercase leading-none">Logged in as</span>
                <span className="block text-xs font-bold text-zinc-750 mt-1">{session.user.user_metadata?.full_name || "Admin"}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-2 border border-zinc-200 rounded-xl bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-650 text-zinc-500 transition-all cursor-pointer shadow-sm"
              >
                <LogOut size={14} />
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              title="Open Menu"
              className="flex md:hidden p-2 border border-zinc-200 rounded-xl bg-white hover:bg-zinc-50 text-zinc-600 transition-all cursor-pointer shadow-sm"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-10">

        {activeTab === "generator" && (
          <>
            {/* Full-width Immersive Hero Section with Smooth Fading Slideshow */}
        <div className="relative mb-12 overflow-hidden rounded-[32px] h-[360px] md:h-[400px] w-full shadow-[0_15px_50px_rgba(0,0,0,0.08)] border-4 border-white">
          {heroImages.map((src, idx) => {
            const isActive = idx === currentHeroImageIdx;
            return (
              <div
                key={src}
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
                style={{
                  backgroundImage: `url('${src}')`,
                  opacity: isActive ? 1 : 0,
                  zIndex: isActive ? 1 : 0
                }}
              />
            );
          })}
        </div>

        {/* Error Toast */}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Action Failed</h4>
              <p className="text-xs text-red-700 mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Active Stage Guidance Note Card */}
        <div id="active-stage-card" className="mb-8 rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Accent vertical border detail */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#12a150]" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            {/* Step badge */}
            <div className="rounded-2xl border border-[#12a150]/20 bg-[#12a150]/10 px-4 py-2 text-center shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#12a150] block">Active Stage</span>
              <span className="text-xl font-bold font-mono text-[#12a150] mt-0.5 block">0{step} / 02</span>
            </div>
            
            {/* Note text */}
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#12a150] animate-pulse" />
                {step === 1 && "Upload Base Certificate Files"}
                {step === 2 && "Compile Batch Certificate Run"}
              </h3>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed max-w-3xl">
                {step === 1 && "Note: Select the base HTML or PPTX certificate templates and the intern details Excel sheet (.xlsx)."}
                {step === 2 && "Note: Verify intern record mappings and run the generator. The platform will automatically locate placeholders (e.g. <<NAME>>, <<COLLEGE>>), redact them, insert details, generate QRs, and compile certificates."}
              </p>
            </div>
          </div>

          {/* Action indicator button/icon on right */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Status</span>
            <div className="flex items-center gap-2 bg-[#12a150] px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(18,161,80,0.15)] select-none">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Ready</span>
            </div>
          </div>
        </div>

        {/* Dynamic Panels */}
        
        {/* STEP 1: ASSETS UPLOAD */}
        {step === 1 && (
          <div className="rounded-[32px] border border-zinc-800 bg-[#030712] p-8 shadow-[0_18px_60px_rgba(0,0,0,0.15)] text-white">
            <h2 className="font-sans text-2xl font-bold text-white mb-6">
              Upload Base <span className="text-[#3b82f6]">Certificate Templates</span>
            </h2>
            <form onSubmit={handleBatchCreate} className="space-y-8">
              
              {/* Three HTML or PPTX Templates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. LOR Template */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    1. Letter of Recommendation (LOR) HTML or PPTX
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                    lorTemplateFile 
                      ? "border-[#3b82f6]/60 bg-[#3b82f6]/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept="text/html,.html,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                      onChange={(e) => setLorTemplateFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${lorTemplateFile ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {lorTemplateFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{lorTemplateFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(lorTemplateFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setLorTemplateFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Upload LOR HTML or PPTX</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop template</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Experience Letter Template */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    2. Experience Letter HTML or PPTX
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                    experienceTemplateFile 
                      ? "border-[#3b82f6]/60 bg-[#3b82f6]/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept="text/html,.html,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                      onChange={(e) => setExperienceTemplateFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${experienceTemplateFile ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {experienceTemplateFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{experienceTemplateFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(experienceTemplateFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setExperienceTemplateFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Upload Experience HTML or PPTX</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop template</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Internship Certificate Template */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    3. Internship Certificate HTML or PPTX
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                    internshipTemplateFile 
                      ? "border-[#3b82f6]/60 bg-[#3b82f6]/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept="text/html,.html,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                      onChange={(e) => setInternshipTemplateFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${internshipTemplateFile ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {internshipTemplateFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{internshipTemplateFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(internshipTemplateFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setInternshipTemplateFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Upload Internship HTML or PPTX</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop template</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Excel and Batch Details Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                
                {/* Excel Upload */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    4. Intern Details Sheet (.xlsx)
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                    excelFile 
                      ? "border-emerald-500/60 bg-emerald-500/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept=".xlsx,.xls"
                      onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${excelFile ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {excelFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[240px]">{excelFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(excelFile.size / 1024).toFixed(1)} KB • Has YES/NO columns</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setExcelFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Drag & drop your Excel sheet here</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Must contain Email and certificate choice columns</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Batch Details Form */}
                <div className="bg-[#0b0f19]/85 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-zinc-400 border-b border-zinc-850 pb-2">
                    5. Batch Release Details
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Batch ID
                      </label>
                      <input 
                        type="text" 
                        required
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        placeholder="e.g. Batch_34_ERP"
                        className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:bg-black transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Month / Year
                      </label>
                      <input 
                        type="text" 
                        required
                        value={batchMonth}
                        onChange={(e) => setBatchMonth(e.target.value)}
                        placeholder="e.g. July 2026"
                        className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:bg-black transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Certificate Issue Date
                    </label>
                    <input 
                      type="date" 
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:bg-black transition-colors"
                    />
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-6 border-t border-zinc-800">
                <button
                  type="submit"
                  disabled={isUploadingTemplate}
                  className={`flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                    !isUploadingTemplate
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg cursor-pointer"
                      : "bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed"
                  }`}
                >
                  {isUploadingTemplate ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                      Uploading templates...
                    </>
                  ) : (
                    <>
                      Create Batch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: EXCEL DETAILS UPLOAD & BATCH GENERATION */}
        {step === 2 && (
          <div className="space-y-8">
            
            {/* Generate Trigger Card */}
            <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
              <h2 className="font-display text-2xl text-stone-900 mb-2">
                Generate Certificates Batch
              </h2>
              <p className="text-xs text-zinc-550 mb-6">
                Template uploaded successfully. Next, run the batch certificate builder to search, redact, and replace placeholders (e.g. &lt;&lt;NAME&gt;&gt;, &lt;&lt;QR&gt;&gt;) in the template.
              </p>

              <form onSubmit={handleGenerate} className="space-y-6">
                <div className="bg-zinc-50 border border-zinc-150 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl text-indigo-650">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-850">Intern Excel Details File</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {excelFile ? `${excelFile.name} (${(excelFile.size / 1024).toFixed(1)} KB)` : "No Excel file selected"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* File reselector */}
                    <div className="relative">
                      <button type="button" className="px-4 py-2 border border-zinc-200 bg-white text-xs font-bold text-zinc-650 rounded-lg hover:bg-zinc-50 transition-colors">
                        Select Different File
                      </button>
                      <input 
                        type="file" 
                        accept=".xlsx,.xls"
                        onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!excelFile || isGenerating}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-extrabold text-xs shadow-md transition-all duration-300 ${
                        excelFile && !isGenerating
                          ? "bg-[#12a150] hover:bg-[#0e8340] text-white cursor-pointer"
                          : "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-zinc-450 border-t-white rounded-full animate-spin" />
                          Processing Batch...
                        </>
                      ) : (
                        <>
                          Run Certificate Builder
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Loading / Results display section */}
            {(isGenerating || generationResults.length > 0) && (
              <div className="space-y-6 rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
                
                {/* Header Stats */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-150">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-800">Batch Processing Results</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {isGenerating ? "Certificates are currently generating..." : "Processing complete."}
                    </p>
                  </div>

                  {!isGenerating && generationResults.length > 0 && (
                    <div className="flex items-center gap-3">
                      {excelDownloadUrl && (
                        <a
                          href={excelDownloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-5 rounded-xl shadow-md text-xs transition-all duration-300"
                        >
                          <Download className="w-4 h-4" /> Download Result Excel Sheet
                        </a>
                      )}

                      {generationResults.some((r) => r.pdf_url && r.status === "active") && (
                        <>
                          <button
                            onClick={handleDownloadAllZip}
                            disabled={isZipping}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl shadow-md text-xs transition-all duration-300 cursor-pointer"
                          >
                            {isZipping ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {zipProgress.total > 0
                                  ? `Packing ${zipProgress.done}/${zipProgress.total}…`
                                  : "Preparing…"}
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" /> Download All PDFs as ZIP
                              </>
                            )}
                          </button>

                          <button
                            onClick={handleSendAllEmails}
                            disabled={isSendingEmails}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl shadow-md text-xs transition-all duration-300 cursor-pointer"
                          >
                            {isSendingEmails ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending Emails…
                              </>
                            ) : (
                              <>
                                <Mail className="w-4 h-4" /> Send Emails to All
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress HUD */}
                {!isGenerating && generationResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl text-center">
                      <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Total Rows</span>
                      <p className="text-2xl font-extrabold text-zinc-800 mt-1">{genStats.total}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                      <span className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Generated</span>
                      <p className="text-2xl font-extrabold text-emerald-700 mt-1">{genStats.success}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center">
                      <span className="text-red-600 text-[10px] font-bold uppercase tracking-wider">Errors</span>
                      <p className="text-2xl font-extrabold text-red-700 mt-1">{genStats.failed}</p>
                    </div>
                  </div>
                )}

                {/* Results Table */}
                <div className="overflow-x-auto border border-zinc-150 rounded-2xl bg-white">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-150 bg-zinc-50 text-zinc-550 text-xs font-bold font-mono">
                        <th className="p-4">Intern Name</th>
                        <th className="p-4">College</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Batch</th>
                        <th className="p-4">Certificate ID</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Email Status</th>
                        <th className="p-4 text-right">PDF File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {isGenerating ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-zinc-500 text-xs">
                            <div className="w-8 h-8 border-2 border-zinc-200 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                            Overlaying PDF fields and uploading certificates...
                          </td>
                        </tr>
                      ) : (
                        generationResults.map((row, idx) => {
                          const isFirstRowForIntern = row.intern_id
                            ? generationResults.findIndex((r) => r.intern_id === row.intern_id) === idx
                            : true;
                          const internRowCount = row.intern_id
                            ? generationResults.filter((r) => r.intern_id === row.intern_id).length
                            : 1;

                          return (
                            <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="p-4 font-bold text-zinc-800">{row.name}</td>
                              <td className="p-4 text-zinc-650">{row.college}</td>
                              <td className="p-4 text-zinc-650">{row.department || "—"}</td>
                              <td className="p-4 font-mono text-zinc-500 text-xs">{row.month || row.year || "—"}</td>
                              <td className="p-4 font-mono text-zinc-700 text-xs">
                                {row.cert_code || <span className="text-zinc-400">—</span>}
                              </td>
                              <td className="p-4">
                                {row.status === "active" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 border border-emerald-150 text-emerald-700 px-2 py-0.5 rounded-full">
                                    Success
                                  </span>
                                ) : (
                                  <span className="inline-flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 border border-red-150 text-red-700 px-2 py-0.5 rounded-full w-max">
                                      Error
                                    </span>
                                    <span className="text-[10px] text-red-600 block max-w-xs truncate">{row.error}</span>
                                  </span>
                                )}
                              </td>
                              {isFirstRowForIntern && (
                                <td className="p-4 align-middle border-l border-r border-zinc-100 bg-zinc-50/20" rowSpan={internRowCount}>
                                  {row.status !== "active" ? (
                                    <span className="text-zinc-400">—</span>
                                  ) : row.email_status === "sending" ? (
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-150 px-2.5 py-1 rounded-lg">
                                      <span className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                      Sending...
                                    </span>
                                  ) : row.email_status === "sent" ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 border border-emerald-150 text-emerald-700 px-2.5 py-1 rounded-lg">
                                      <CheckCircle className="w-3 h-3 text-emerald-650" /> Sent
                                    </span>
                                  ) : row.email_status === "failed" ? (
                                    <div className="inline-flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 border border-red-150 text-red-700 px-2.5 py-1 rounded-lg">
                                        <AlertCircle className="w-3 h-3 text-red-650" /> Failed
                                      </span>
                                      <button
                                        onClick={() => handleSendEmail(idx)}
                                        className="text-[10px] text-zinc-500 hover:text-zinc-700 font-bold underline cursor-pointer"
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleSendEmail(idx)}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-605 hover:text-indigo-805 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
                                    >
                                      <Mail className="w-3 h-3" /> Send Email
                                    </button>
                                  )}
                                </td>
                              )}
                              <td className="p-4 text-right">
                                {row.pdf_url ? (
                                  <div className="inline-flex items-center gap-2">
                                    {/* View in new tab */}
                                    <a
                                      href={getResolvedPdfUrl(row.pdf_url)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open PDF in new tab"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg transition-all duration-150"
                                    >
                                      <LinkIcon className="w-3 h-3" /> View
                                    </a>

                                    {/* Force-download */}
                                    <button
                                      title="Download PDF"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(getResolvedPdfUrl(row.pdf_url));
                                          const blob = await res.blob();
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url;
                                          const safeName = (row.name || "certificate").replace(/[^a-zA-Z0-9_\- ]/g, "_");
                                          a.download = `${safeName}.pdf`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        } catch {
                                          alert("Failed to download PDF. Please try View instead.");
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
                                    >
                                      <Download className="w-3 h-3" /> Download
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-zinc-400 text-xs font-bold">Unsaved</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {!isGenerating && (
                  <div className="pt-4 flex justify-end border-t border-zinc-150">
                    <button
                      onClick={handleReset}
                      className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-3 px-6 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> Start New Batch Session
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>
        )}
          </>
        )}

        {/* Tab 2: History Database */}
        {activeTab === "history" && (
          <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-zinc-150">
              <div>
                <h2 className="font-sans text-2xl font-bold text-zinc-800 flex items-center gap-2">
                  <Database className="text-[#5844e9]" /> Certificates Database
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  View and manage all internship certificates, LORs, and experience letters generated via CopterCode.
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <button
                  onClick={fetchHistoryCerts}
                  disabled={historyLoading}
                  className="px-4 py-2 bg-zinc-105 hover:bg-zinc-200 border border-zinc-250 text-xs font-bold text-zinc-650 rounded-xl transition-all cursor-pointer"
                >
                  Refresh Data
                </button>
              </div>
            </div>

            {/* Analytics Stats Grid */}
            {!historyLoading && historyCerts.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-extrabold text-zinc-450 uppercase tracking-wider mb-4">Internship Analytics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Interns Card */}
                  <div className="bg-gradient-to-br from-[#5844e9] to-[#7f6cf2] rounded-[24px] p-5 text-white shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute right-0 top-0 translate-x-2 -translate-y-2 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <Users size={120} />
                    </div>
                    <div className="z-10">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-100">Total Unique Interns</p>
                      <h4 className="text-3xl font-extrabold mt-1 tracking-tight">{totalUniqueInterns}</h4>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-[10px] text-violet-100 font-medium z-10">
                      <Activity size={12} className="animate-pulse" />
                      <span>Across all active batches</span>
                    </div>
                  </div>

                  {/* Batch Cards */}
                  {Object.entries(batchCounts).map(([batchName, count]) => {
                    const isSelected = selectedBatch === batchName;
                    return (
                      <div
                        key={batchName}
                        onClick={() => setSelectedBatch(isSelected ? "" : batchName)}
                        className={`rounded-[24px] p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden select-none ${
                          isSelected
                            ? "bg-violet-50/50 border-[#5844e9] shadow-[0_4px_20px_rgba(88,68,233,0.08)]"
                            : "bg-white border-zinc-150 hover:border-zinc-350 hover:bg-zinc-50/30 hover:shadow-md"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute right-4 top-4 bg-[#5844e9] text-white p-1 rounded-full">
                            <CheckCircle size={12} />
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-[#5844e9] transition-colors">
                            {batchName}
                          </p>
                          <h4 className="text-3xl font-extrabold mt-1 tracking-tight text-zinc-800">
                            {count}
                          </h4>
                        </div>
                        <div className="mt-4 text-[10px] font-bold text-zinc-400 flex items-center gap-1 group-hover:text-[#5844e9] transition-colors">
                          <span>{isSelected ? "Filter active (click to clear)" : "Click to filter interns"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter/Search Section */}
            <div className="mb-8 bg-zinc-50/30 border border-zinc-150 rounded-[24px] p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Search Input */}
                <div className="flex-1 flex items-center gap-2.5 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 transition-all">
                  <Search size={15} className="text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    placeholder="Search by intern name, college, email, or credential code..."
                    className="flex-1 text-xs bg-transparent outline-none text-zinc-700 placeholder:text-zinc-450"
                  />
                  {historyQuery && (
                    <button onClick={() => setHistoryQuery("")} className="text-zinc-400 hover:text-zinc-650 cursor-pointer">
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                {/* Download Filtered Excel Button */}
                {!historyLoading && historyCerts.length > 0 && (
                  <button
                    onClick={handleDownloadFilteredExcel}
                    disabled={isExportingExcel}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition-all duration-300 cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Download size={14} />
                    {isExportingExcel
                      ? "Exporting..."
                      : selectedCertIds.size > 0
                      ? "Download Selected Excel"
                      : "Download Filtered Excel"}
                  </button>
                )}

                {/* Download Filtered ZIP Button */}
                {!historyLoading && historyCerts.length > 0 && (
                  <button
                    onClick={() => {
                      const targetCerts = selectedCertIds.size > 0
                        ? historyCerts.filter((c) => selectedCertIds.has(c.id))
                        : filteredCerts;
                      handleDownloadHistoryZip(targetCerts);
                    }}
                    disabled={isExportingHistoryZip}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all duration-300 cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isExportingHistoryZip ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{`Zipping ${historyZipProgress.done}/${historyZipProgress.total}...`}</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>
                          {selectedCertIds.size > 0
                            ? "Download Selected ZIP"
                            : "Download Filtered ZIP"}
                        </span>
                      </>
                    )}
                  </button>
                )}

                {/* Send Filtered/Selected Emails Button */}
                {!historyLoading && historyCerts.length > 0 && (
                  <button
                    onClick={handleSendFilteredEmails}
                    disabled={isSendingHistoryEmails}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md transition-all duration-300 cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSendingHistoryEmails ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{`Sending ${historyEmailProgress.done}/${historyEmailProgress.total}...`}</span>
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        <span>Send Email</span>
                      </>
                    )}
                  </button>
                )}

                {/* Clear All Filters Button */}
                {(historyQuery || selectedDept || selectedDomain || selectedCollege || selectedBatch || selectedProject) && (
                  <button
                    onClick={() => {
                      setHistoryQuery("");
                      setSelectedDept("");
                      setSelectedDomain("");
                      setSelectedCollege("");
                      setSelectedBatch("");
                      setSelectedProject("");
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-dashed border-red-200 text-red-650 bg-red-50/30 hover:bg-red-50 hover:border-red-300 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 size={14} />
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Dynamic Dropdowns Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Batch Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Batch</label>
                  <div className="relative">
                    <select
                      value={selectedBatch}
                      onChange={(e) => setSelectedBatch(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 pr-8 appearance-none text-zinc-700 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer"
                    >
                      <option value="">All Batches</option>
                      {uniqueBatches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Department Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Department</label>
                  <div className="relative">
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 pr-8 appearance-none text-zinc-700 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer"
                    >
                      <option value="">All Departments</option>
                      {uniqueDepts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Domain Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Domain / Role</label>
                  <div className="relative">
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 pr-8 appearance-none text-zinc-700 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer"
                    >
                      <option value="">All Domains</option>
                      {uniqueDomains.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Internship & Live Project Area Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Internship & Live Project Area</label>
                  <div className="relative">
                    <select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 pr-8 appearance-none text-zinc-700 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer"
                    >
                      <option value="">All Areas</option>
                      {uniqueProjects.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* College Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">College Name</label>
                  <div className="relative">
                    <select
                      value={selectedCollege}
                      onChange={(e) => setSelectedCollege(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 pr-8 appearance-none text-zinc-700 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer"
                    >
                      <option value="">All Colleges</option>
                      {uniqueColleges.map((colName) => (
                        <option key={colName} value={colName}>{colName}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {historyError && (
              <div className="mb-6 bg-red-50 border border-red-250 p-4 rounded-2xl text-red-850 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-650" />
                <span>{historyError}</span>
              </div>
            )}

            {historyLoading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-2 border-zinc-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-xs font-bold text-zinc-550">Querying Supabase database...</p>
              </div>
            ) : (
              (() => {
                const filtered = filteredCerts;

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center border border-dashed border-zinc-200 rounded-2xl">
                      <p className="text-sm font-bold text-zinc-550">No records found matching &quot;{historyQuery}&quot;</p>
                      <p className="text-xs text-zinc-400 mt-1">Make sure you have generated certificates or try a different query.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-zinc-150 rounded-2xl bg-white shadow-sm">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-zinc-150 bg-zinc-50/50 text-zinc-550 text-xs font-bold font-mono">
                          <th className="p-4 w-10 text-center select-none">
                            <input
                              type="checkbox"
                              checked={filtered.length > 0 && filtered.every((c) => selectedCertIds.has(c.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCertIds(new Set([...selectedCertIds, ...filtered.map((c) => c.id)]));
                                } else {
                                  const next = new Set(selectedCertIds);
                                  filtered.forEach((c) => next.delete(c.id));
                                  setSelectedCertIds(next);
                                }
                              }}
                              className="w-4 h-4 rounded border-zinc-300 text-indigo-650 bg-white focus:ring-indigo-500 focus:ring-2 focus:ring-offset-2 transition-all cursor-pointer"
                            />
                          </th>
                          <th className="p-4">Intern Details</th>
                          <th className="p-4">Credential Code</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Issue Date</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Email Delivery</th>
                          <th className="p-4 text-right">PDF File</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filtered.map((cert, idx) => {
                          const isFirstRowForIntern = cert.intern_id
                            ? filtered.findIndex((c) => c.intern_id === cert.intern_id) === idx
                            : true;
                          const internRowCount = cert.intern_id
                            ? filtered.filter((c) => c.intern_id === cert.intern_id).length
                            : 1;
                          const dateStr = cert.intern?.date || cert.issue_date || (cert.created_at ? new Date(cert.created_at).toLocaleDateString() : "—");
                          const emailVal = cert.intern?.email || "—";
                          const emailStatus = cert.intern?.email_status || "pending";
                          const nameVal = cert.intern?.name || cert.name;
                          const collegeVal = cert.intern?.college || cert.college;
                          const isSelected = selectedCertIds.has(cert.id);
                          
                          return (
                            <tr key={cert.id} className={`transition-colors hover:bg-zinc-50/50 ${isSelected ? "bg-violet-50/20" : ""}`}>
                              {isFirstRowForIntern && (
                                <td 
                                  className="p-4 w-10 text-center select-none align-middle border-l border-zinc-100 bg-zinc-50/10" 
                                  rowSpan={internRowCount}
                                >
                                  <input
                                    type="checkbox"
                                    checked={filtered.filter((c) => c.intern_id === cert.intern_id).every((c) => selectedCertIds.has(c.id))}
                                    onChange={(e) => {
                                      const next = new Set(selectedCertIds);
                                      const internCerts = filtered.filter((c) => c.intern_id === cert.intern_id);
                                      if (e.target.checked) {
                                        internCerts.forEach((c) => next.add(c.id));
                                      } else {
                                        internCerts.forEach((c) => next.delete(c.id));
                                      }
                                      setSelectedCertIds(next);
                                    }}
                                    className="w-4 h-4 rounded border-zinc-300 text-indigo-650 bg-white focus:ring-indigo-500 focus:ring-2 focus:ring-offset-2 transition-all cursor-pointer"
                                  />
                                </td>
                              )}
                              <td className="p-4">
                                <div className="flex items-center gap-1.5 group/name">
                                  <span className="font-bold text-zinc-800">{nameVal}</span>
                                  <button
                                    onClick={() => handleStartEdit(cert)}
                                    title="Edit Intern Details"
                                    className="opacity-0 group-hover/name:opacity-100 p-0.5 text-zinc-400 hover:text-indigo-650 hover:bg-zinc-100 rounded transition-all cursor-pointer shrink-0"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">{collegeVal}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">{emailVal}</div>
                              </td>
                              <td className="p-4 font-mono text-zinc-700 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span>{cert.cert_code}</span>
                                  <button
                                    title="Copy Code"
                                    onClick={() => {
                                      navigator.clipboard.writeText(cert.cert_code || "");
                                      alert("Credential code copied!");
                                    }}
                                    className="p-1 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                  cert.cert_type === "lor"
                                    ? "bg-violet-50 text-violet-750 border border-violet-100"
                                    : cert.cert_type === "experience"
                                      ? "bg-amber-50 text-amber-750 border border-amber-100"
                                      : "bg-emerald-50 text-emerald-750 border border-emerald-100"
                                }`}>
                                  {cert.cert_type || "internship"}
                                </span>
                              </td>
                              <td className="p-4 font-mono text-zinc-550 text-xs">{dateStr}</td>
                              <td className="p-4">
                                {cert.status === "active" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 border border-emerald-150 text-emerald-700 px-2 py-0.5 rounded-full">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 border border-red-150 text-red-700 px-2 py-0.5 rounded-full">
                                      Revoked
                                    </span>
                                    {cert.revoke_reason && (
                                      <span className="text-[10px] text-red-500 italic block max-w-xs truncate">{cert.revoke_reason}</span>
                                    )}
                                  </span>
                                )}
                              </td>
                              {isFirstRowForIntern && (
                                <td className="p-4 align-middle border-l border-r border-zinc-100 bg-zinc-50/20" rowSpan={internRowCount}>
                                  {cert.status !== "active" ? (
                                    <span className="text-zinc-400">—</span>
                                  ) : !cert.intern_id ? (
                                    <span className="text-zinc-400 text-xs italic">No intern link</span>
                                  ) : emailStatus === "sending" ? (
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-150 px-2 py-0.5 rounded-md">
                                      <span className="w-2 h-2 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                      Sending...
                                    </span>
                                  ) : emailStatus === "sent" ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 border border-emerald-150 text-emerald-700 px-2.5 py-1 rounded-lg">
                                      <CheckCircle className="w-3 h-3 text-emerald-650" /> Sent
                                    </span>
                                  ) : emailStatus === "failed" ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 border border-red-150 text-red-700 px-2 py-0.5 rounded-md">
                                        Failed
                                      </span>
                                      <button
                                        onClick={() => handleSendHistoryEmail(cert.intern_id)}
                                        className="text-[10px] text-zinc-500 hover:text-zinc-700 font-bold underline cursor-pointer"
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleSendHistoryEmail(cert.intern_id)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-605 hover:text-indigo-805 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md cursor-pointer"
                                    >
                                      <Mail className="w-3.5 h-3.5" /> Send Mail
                                    </button>
                                  )}
                                </td>
                              )}
                              <td className="p-4 text-right">
                                {cert.pdf_url ? (
                                  <div className="inline-flex items-center gap-2">
                                    <a
                                      href={getResolvedPdfUrl(cert.pdf_url)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-650 hover:text-violet-855 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg transition-all duration-150"
                                    >
                                      <LinkIcon className="w-3 h-3" /> View
                                    </a>
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(getResolvedPdfUrl(cert.pdf_url));
                                          const blob = await res.blob();
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url;
                                          const safeName = (cert.intern?.name || cert.name || "certificate").replace(/[^a-zA-Z0-9_\- ]/g, "_");
                                          a.download = `${safeName}.pdf`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        } catch {
                                          alert("Failed to download PDF.");
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
                                    >
                                      <Download className="w-3 h-3" /> Download
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-zinc-400 text-xs">No PDF</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Edit Intern Modal */}
        {editingCert && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] border border-black/5 p-8 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] animate-[fadeIn_0.2s_ease-out]">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100">
                <div>
                  <h3 className="text-lg font-bold text-zinc-800">Edit Intern & Certificates</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Updating this record will automatically sync changes across all certificates for this intern.
                  </p>
                </div>
                <button
                  onClick={() => setEditingCert(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {editError && (
                <div className="mb-4 bg-red-50 border border-red-200 p-3.5 rounded-xl text-xs text-red-650 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-650" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                    College / Institution
                  </label>
                  <input
                    type="text"
                    required
                    value={editCollege}
                    onChange={(e) => setEditCollege(e.target.value)}
                    className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      required
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Year / Class (e.g. 4th Year)
                    </label>
                    <input
                      type="text"
                      required
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Domain / Role
                    </label>
                    <input
                      type="text"
                      required
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Internship & Live Project Area
                    </label>
                    <input
                      type="text"
                      required
                      value={editProject}
                      onChange={(e) => setEditProject(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Batch / Month (e.g. JUNE-JULY)
                    </label>
                    <input
                      type="text"
                      required
                      value={editMonth}
                      onChange={(e) => setEditMonth(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Issue Date
                    </label>
                    <input
                      type="text"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-750 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setEditingCert(null)}
                    className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2.5 bg-[#5844e9] hover:bg-[#4834d9] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSavingEdit ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Profile Settings */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Update Info Card */}
            <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
              <h2 className="font-sans text-xl font-bold text-stone-900 mb-2 flex items-center gap-2">
                <User className="text-[#5844e9]" /> Admin Information
              </h2>
              <p className="text-xs text-zinc-500 mb-6">
                Update your display name. This name is used to greet you in the panel interface.
              </p>

              {profileSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-bounce">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="mb-4 bg-red-50 border border-red-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-650" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleProfileUpdate} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value={session.user.email}
                    className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Admin Display Name"
                    className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:outline-none focus:border-violet-500 focus:bg-zinc-50 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={profileSubmitting}
                    className="bg-[#5844e9] hover:bg-[#4338ca] disabled:opacity-60 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {profileSubmitting ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Card */}
            <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
              <h2 className="font-sans text-xl font-bold text-stone-900 mb-2 flex items-center gap-2">
                <KeyRound className="text-[#5844e9]" /> Change Security Password
              </h2>
              <p className="text-xs text-zinc-500 mb-6">
                Update your credentials. Once saved, you must log back in with the new password on future visits.
              </p>

              <form onSubmit={handleProfileUpdate} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                    New Security Password
                  </label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="•••••••• (Min 6 characters)"
                    className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:outline-none focus:border-violet-500 focus:bg-zinc-50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={profileConfirmPassword}
                    onChange={(e) => setProfileConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:outline-none focus:border-violet-500 focus:bg-zinc-50 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={profileSubmitting || !profilePassword}
                    className="bg-[#5844e9] hover:bg-[#4338ca] disabled:opacity-60 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {profileSubmitting ? "Updating Password..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Premium Process Stage Overlay Loader */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md transition-all duration-300">
          <div className="max-w-md w-full mx-6 bg-white border border-[#5844e9]/15 rounded-3xl p-8 shadow-[0_30px_100px_rgba(0,0,0,0.06)] flex flex-col items-center text-center relative overflow-hidden">
            
            {/* Ambient decorative light glow inside loader */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#5844e9]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-[#10b981]/5 rounded-full blur-2xl pointer-events-none" />

            {/* Spinning Nested Rings Animation */}
            <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
              {/* Outer Glow Ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-[#5844e9]/20 animate-[spin_12s_linear_infinite]" />
              
              {/* Mid Ring */}
              <div className="absolute inset-2 rounded-full border-2 border-violet-100 border-t-violet-600 animate-[spin_1.5s_linear_infinite]" />
              
              {/* Inner Reverse Ring */}
              <div className="absolute inset-4 rounded-full border border-dashed border-[#10b981]/30 animate-[spin_6s_linear_infinite_reverse]" />
              
              {/* Core Icon */}
              <div className="absolute w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                {processingStage === 1 && <Upload className="w-5 h-5 text-violet-600 animate-bounce" />}
                {processingStage === 2 && <Settings className="w-5 h-5 text-emerald-600 animate-spin" />}
              </div>
            </div>

            {/* Stage Title */}
            <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#4338ca] bg-[#5844e9]/8 px-3 py-1 rounded-full border border-[#5844e9]/15 mb-3">
              {processingStage === 1 && "Stage 01 — Parsing Template"}
              {processingStage === 2 && "Stage 02 — Compiling Certificates"}
            </span>
            
            <h3 className="font-sans text-lg text-stone-900 font-bold mb-5">
              {processingStage === 1 && "Analyzing Base Document"}
              {processingStage === 2 && "Building Batch Run"}
            </h3>

            {/* Sequential Processing Steps Checklist */}
            <div className="w-full text-left space-y-3 bg-zinc-50 border border-zinc-150 p-5 rounded-2xl">
              {(processingStage === 1 ? PROCESS_STEPS[1] : PROCESS_STEPS[2]).map((stepText: string, idx: number) => {
                const isCompleted = idx < activeSubStep;
                const isActive = idx === activeSubStep;
                return (
                  <div key={idx} className="flex items-center gap-3 transition-all duration-300">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                      isCompleted 
                        ? "bg-emerald-500 border-emerald-500 text-white" 
                        : isActive 
                          ? "border-violet-500 text-violet-500 bg-violet-50" 
                          : "border-zinc-200 text-zinc-300 bg-white"
                    }`}>
                      {isCompleted ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                      ) : null}
                    </div>
                    <span className={`text-xs font-semibold ${
                      isCompleted 
                        ? "text-zinc-400 line-through decoration-zinc-300" 
                        : isActive 
                          ? "text-zinc-800 font-bold" 
                          : "text-zinc-400"
                    }`}>
                      {stepText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer (Side Menu) */}
      <div className={`fixed inset-0 z-[9999] transition-all duration-300 ${isMobileMenuOpen ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"}`}>
        {/* Backdrop overlay */}
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Drawer content container */}
        <div className={`absolute top-0 right-0 h-full w-[280px] sm:w-[320px] bg-white shadow-2xl p-6 flex flex-col justify-between transition-transform duration-300 ease-out transform ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}>
          <div>
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-6 border-b border-zinc-100 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="relative h-10 w-10 rounded-xl bg-black flex items-center justify-center">
                  <div className="relative h-8 w-8">
                    <Image src="/coptercode-logo-bw.svg" alt="CopterCode logo" fill className="object-contain" />
                  </div>
                </div>
                <span className="font-sans text-lg font-bold tracking-tight text-[#0f172a]">
                  CopterCode
                </span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Vertical Switcher Tabs */}
            <nav className="space-y-2">
              <button
                onClick={() => {
                  setActiveTab("generator");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "generator"
                    ? "bg-[#5844e9]/8 text-[#5844e9] border border-[#5844e9]/10 shadow-[inset_0_1px_2px_rgba(88,68,233,0.05)]"
                    : "text-stone-600 hover:text-stone-900 hover:bg-zinc-50 border border-transparent"
                }`}
              >
                <LayoutDashboard size={16} /> Generator
              </button>
              <button
                onClick={() => {
                  setActiveTab("history");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "bg-[#5844e9]/8 text-[#5844e9] border border-[#5844e9]/10 shadow-[inset_0_1px_2px_rgba(88,68,233,0.05)]"
                    : "text-stone-600 hover:text-stone-900 hover:bg-zinc-50 border border-transparent"
                }`}
              >
                <Database size={16} /> Database History
              </button>
              <button
                onClick={() => {
                  setActiveTab("profile");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-[#5844e9]/8 text-[#5844e9] border border-[#5844e9]/10 shadow-[inset_0_1px_2px_rgba(88,68,233,0.05)]"
                    : "text-stone-600 hover:text-stone-900 hover:bg-zinc-50 border border-transparent"
                }`}
              >
                <User size={16} /> Profile
              </button>
            </nav>
          </div>

          {/* Drawer Footer / Account details */}
          <div className="pt-6 border-t border-zinc-100">
            <div className="mb-4">
              <span className="block text-[9px] font-bold text-zinc-400 uppercase leading-none">Logged in as</span>
              <span className="block text-xs font-bold text-zinc-750 mt-1 truncate">{session.user.user_metadata?.full_name || "Admin"}</span>
              <span className="block text-[10px] text-zinc-400 mt-0.5 truncate">{session.user.email}</span>
            </div>
            <button
              onClick={() => {
                handleLogout();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-zinc-200 hover:border-red-200 hover:bg-red-50 hover:text-red-650 text-zinc-500 rounded-xl transition-all cursor-pointer text-xs font-bold shadow-sm"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
