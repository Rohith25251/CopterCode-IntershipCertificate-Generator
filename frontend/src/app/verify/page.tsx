"use client";

import React, { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  Calendar, 
  Building, 
  GraduationCap, 
  FileDown, 
  ExternalLink,
  Sparkles,
  Briefcase
} from "lucide-react";

interface Certificate {
  cert_code: string;
  name: string;
  college: string;
  batch: string;
  department?: string;
  role?: string;
  issue_date?: string;
  expiry_date?: string;
  status: string;
  pdf_url: string;
  created_at: string;
  revoked_at?: string;
  revoke_reason?: string;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  
  const [loading, setLoading] = useState<boolean>(true);
  const [certificate, setCertificate] = useState<any | null>(null);
  const [error, setError] = useState<"not_found" | "revoked" | "expired" | "unknown" | null>(null);

  useEffect(() => {
    async function fetchCertificate() {
      if (!id) {
        setLoading(false);
        setError("not_found");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch from Supabase certificates table with interns details
        const { data, error: dbError } = await supabase
          .from("certificates")
          .select("*, interns(*)")
          .eq("cert_code", id.trim())
          .maybeSingle();

        if (dbError) {
          console.error("DB Error:", dbError);
          setError("unknown");
          return;
        }

        if (!data) {
          setError("not_found");
          return;
        }

        const cert: Certificate = data;

        // Check if certificate has been explicitly revoked
        if (cert.status === "revoked") {
          setError("revoked");
          setCertificate(cert); // Load metadata anyway to show details
          return;
        }

        // Check if certificate is expired (if expiry_date is set in DB)
        if (cert.expiry_date) {
          const expiry = new Date(cert.expiry_date);
          if (expiry < new Date()) {
            setError("expired");
            setCertificate(cert);
            return;
          }
        }

        setCertificate(cert);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("unknown");
      } finally {
        setLoading(false);
      }
    }

    fetchCertificate();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-zinc-500">Verifying credential integrity...</p>
      </div>
    );
  }

  // Helper to format date strings
  const formatStrDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  // Resolve display cert fields early
  const displayCert = (() => {
    if (!certificate) return null;
    const internObj = Array.isArray(certificate.interns) ? certificate.interns[0] : certificate.interns;
    return {
      cert_code: certificate.cert_code,
      name: internObj?.name || certificate.name,
      college: internObj?.college || certificate.college,
      year: internObj?.year || certificate.batch || certificate.year,
      department: internObj?.department || certificate.department,
      role: internObj?.role || certificate.role,
      project: internObj?.project || certificate.project,
      month: internObj?.month || certificate.month,
      issue_date: formatStrDate(certificate.issue_date || internObj?.date || certificate.created_at),
      expiry_date: formatStrDate(certificate.expiry_date)
    };
  })();

  // Certificate not found
  if (error === "not_found" && !certificate) {
    return (
      <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-3xl p-8 text-center shadow-lg">
        <div className="inline-flex p-4 rounded-full bg-red-50 border border-red-150 text-red-605 mb-6">
          <ShieldX className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-black text-zinc-900">Certificate Not Found</h2>
        <p className="text-xs text-zinc-655 mt-2 leading-relaxed">
          The credential code specified does not match any certificate in our records. Please verify the URL or barcode scanner query.
        </p>
        <div className="mt-6 pt-6 border-t border-zinc-150">
          <span className="text-[10px] font-mono font-bold bg-zinc-50 text-zinc-600 px-3 py-1.5 rounded border border-zinc-200">
            QUERY ID: {id || "MISSING"}
          </span>
        </div>
      </div>
    );
  }

  // Certificate explicitly revoked
  if (error === "revoked" && certificate) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-red-200 rounded-3xl p-8 text-center shadow-lg">
        <div className="inline-flex p-4 rounded-full bg-red-50 border border-red-200 text-red-650 mb-6">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-black text-red-650">Credential Revoked</h2>
        <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
          This certificate (code: <span className="font-mono text-zinc-800 font-bold">{certificate.cert_code}</span>) has been explicitly revoked by the issuer and is no longer valid.
        </p>

        {/* Metadata display */}
        <div className="mt-6 bg-zinc-50 border border-zinc-150 p-5 rounded-2xl text-left space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Candidate Name</span>
              <span className="text-sm font-bold text-zinc-800">{displayCert?.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Institution</span>
              <span className="text-sm font-bold text-zinc-800">{displayCert?.college}</span>
            </div>
            {displayCert?.department && (
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Department</span>
                <span className="text-sm font-bold text-zinc-800">{displayCert.department}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Certificate expired
  if (error === "expired" && certificate) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-amber-200 rounded-3xl p-8 text-center shadow-lg">
        <div className="inline-flex p-4 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mb-6">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-black text-amber-700">Credential Expired</h2>
        <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
          This certificate (code: <span className="font-mono text-zinc-800 font-bold">{certificate.cert_code}</span>) has passed its valid lifetime duration of <span className="font-bold text-amber-700">{new Date(certificate.expiry_date!).toLocaleDateString()}</span>.
        </p>

        {/* Metadata display */}
        <div className="mt-6 bg-zinc-50 border border-zinc-150 p-5 rounded-2xl text-left space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Candidate Name</span>
              <span className="text-sm font-bold text-zinc-800">{displayCert?.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Institution</span>
              <span className="text-sm font-bold text-zinc-800">{displayCert?.college}</span>
            </div>
            {displayCert?.department && (
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Department</span>
                <span className="text-sm font-bold text-zinc-800">{displayCert.department}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error === "unknown") {
    return (
      <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-3xl p-8 text-center shadow-lg">
        <div className="inline-flex p-4 rounded-full bg-red-50 border border-red-150 text-red-650 mb-6">
          <ShieldX className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-black text-zinc-900">Verification Error</h2>
        <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
          An error occurred while connecting to our database. Please verify your connection status and reload the lookup request.
        </p>
      </div>
    );
  }

  // Active / Valid Certificate
  if (certificate && displayCert) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Verification Success Badge */}
        <div className="bg-white border border-emerald-500/30 rounded-3xl p-6 md:p-8 shadow-lg relative overflow-hidden">
          {/* Subtle green ambient light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-2xl text-emerald-650 shrink-0">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold tracking-wider bg-emerald-50 border border-emerald-150 text-emerald-700 px-2.5 py-0.5 rounded-full uppercase">
                  Verified Credential
                </span>
                <h2 className="text-xl md:text-2xl font-black text-zinc-900 mt-1.5">
                  Valid Certificate
                </h2>
                <p className="text-xs text-zinc-550 mt-0.5 font-mono">
                  Certificate Code: <span className="text-zinc-850 font-bold">{certificate.cert_code}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a 
                href={certificate.pdf_url}
                download
                className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs px-4 py-2.5 rounded-xl border border-zinc-200 shadow-sm transition-colors"
              >
                <FileDown className="w-4 h-4" /> Download PDF
              </a>
              <a 
                href={certificate.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all duration-300"
              >
                <ExternalLink className="w-4 h-4" /> Open In Tab
              </a>
            </div>
          </div>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Certificate fields details */}
          <div className="md:col-span-5 bg-white border border-zinc-200 rounded-3xl p-6 shadow-lg space-y-5">
            <h3 className="text-sm font-black text-zinc-500 border-b border-zinc-150 pb-3 uppercase tracking-wider">
              Credential Attributes
            </h3>

            {/* Candidate Name */}
            <div className="flex gap-3">
              <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Candidate Name</span>
                <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.name}</span>
              </div>
            </div>

            {/* Institution */}
            <div className="flex gap-3">
              <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Institution</span>
                <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.college}</span>
              </div>
            </div>

            {/* Year */}
            {displayCert.year && (
              <div className="flex gap-3">
                <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Year</span>
                  <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.year}</span>
                </div>
              </div>
            )}

            {/* Department */}
            {displayCert.department && (
              <div className="flex gap-3">
                <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Department</span>
                  <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.department}</span>
                </div>
              </div>
            )}

            {/* Domain */}
            {displayCert.role && (
              <div className="flex gap-3">
                <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Domain</span>
                  <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.role}</span>
                </div>
              </div>
            )}

            {/* Internship & Live Project Area */}
            {displayCert.project && (
              <div className="flex gap-3">
                <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Internship & Live Project Area</span>
                  <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.project}</span>
                </div>
              </div>
            )}

            {/* Batch */}
            {displayCert.month && (
              <div className="flex gap-3">
                <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Batch</span>
                  <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.month}</span>
                </div>
              </div>
            )}

            {/* Date of Issue */}
            <div className="flex gap-3">
              <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Date of Issue</span>
                <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.issue_date}</span>
              </div>
            </div>

            {/* Expiry Date */}
            {displayCert.expiry_date && (
              <div className="flex gap-3">
                <div className="bg-zinc-100 p-2 rounded-xl text-zinc-650 shrink-0 h-10 w-10 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Expiry Date</span>
                  <span className="text-sm font-bold text-zinc-800 leading-tight block">{displayCert.expiry_date}</span>
                </div>
              </div>
            )}

          </div>

          {/* PDF Live Embed */}
          <div className="md:col-span-7 bg-white border border-zinc-200 rounded-3xl p-6 shadow-lg flex flex-col min-h-[400px]">
            <h3 className="text-sm font-black text-zinc-500 border-b border-zinc-150 pb-3 mb-4 uppercase tracking-wider">
              Document Preview
            </h3>
            
            <div className="flex-1 w-full bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-200 relative group">
              <iframe 
                src={`${certificate.pdf_url}#toolbar=0`} 
                className="w-full h-full border-0 absolute inset-0"
                title="Certificate PDF Viewer"
              />
            </div>
          </div>

        </div>

      </div>
    );
  }

  return null;
}

export default function VerifyPage() {
  return (
    <div className="relative min-h-screen bg-[#faf9f6] text-zinc-800 font-sans pt-28 pb-16 px-6">
      {/* Cohesive Header */}
      <header className="absolute top-0 left-0 right-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-3.5">
            <div className="relative h-14 w-14 rounded-2xl bg-black shadow-sm flex items-center justify-center">
              <div className="relative h-12 w-12">
                <Image src="/coptercode-logo.svg" alt="CopterCode logo" fill className="object-contain" priority />
              </div>
            </div>
            <span className="font-sans text-2xl font-bold tracking-tight text-[#0f172a]">
              CopterCode
            </span>
          </div>
        </div>
      </header>

      {/* Background patterns */}
      <div className="absolute inset-0 bg-[#faf9f6] pointer-events-none -z-10" />

      <div className="max-w-3xl mx-auto mb-10 text-center">
        <div className="inline-flex gap-2 items-center bg-white border border-zinc-200 px-4 py-1.5 rounded-2xl mb-4 shadow-sm">
          <Sparkles className="w-4 h-4 text-violet-650" />
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">CopterCode Certificate Registry</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-800 via-indigo-950 to-zinc-700">
          Credential Verification
        </h1>
        <p className="text-xs text-zinc-500 mt-2">
          Verify academic, project, and internship certificate codes securely.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-12 h-12 border-2 border-zinc-200 border-t-violet-500 rounded-full animate-spin mb-4" />
          <p className="text-xs text-zinc-500 font-bold">Initializing verification engine...</p>
        </div>
      }>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
