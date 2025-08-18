import React, { useEffect, useMemo, useRef, useState } from "react";

// Single-file React app. Tailwind is available. // Purpose: turn barcode scans into rows with almost zero typing. // Features // - HID scanners work as keyboards. This listens for fast key bursts ending with Enter. // - Parses common payloads: key=value pairs, prefix tags SLD/BLK/CNT/CS, plain IDs. // - Adds a row with timestamp, lets you tag IssueType and Notes. // - Dedupe toggle, sound cue, CSV export, persistent localStorage. // - Works offline. No server. Drop this into a static host and go.

export default function App() { const [rows, setRows] = useState(() => { try { const saved = localStorage.getItem("qc_rows_v1"); return saved ? JSON.parse(saved) : []; } catch { return []; } }); const [issueTypes, setIssueTypes] = useState(() => { const def = [ "Label_Mismatch", "Unreadable_Barcode", "Coverslip_Missing", "Block_Count_Error", "Slide_Broken", "Container_Leak", "Specimen_ID_Missing", "Other" ]; try { const saved = localStorage.getItem("qc_issue_types_v1"); return saved ? JSON.parse(saved) : def; } catch { return def; } }); const [buffer, setBuffer] = useState(""); const [autoFocus, setAutoFocus] = useState(true); const [dedupe, setDedupe] = useState(true); const [beep, setBeep] = useState(true); const [operator, setOperator] = useState(""); const inputRef = useRef<HTMLInputElement>(null); const lastKeyTime = useRef<number>(0);

useEffect(() => { localStorage.setItem("qc_rows_v1", JSON.stringify(rows)); }, [rows]);

useEffect(() => { localStorage.setItem("qc_issue_types_v1", JSON.stringify(issueTypes)); }, [issueTypes]);

useEffect(() => { if (autoFocus && inputRef.current) inputRef.current.focus(); }, [autoFocus]);

// Global key listener to catch scanner bursts without focusing a field useEffect(() => { const handler = (e: KeyboardEvent) => { // Ignore when typing in inputs/textareas to avoid fighting manual edits const tag = (e.target as HTMLElement)?.tagName?.toLowerCase(); if (tag === "input" || tag === "textarea") return;

const now = Date.now();
  const gap = now - (lastKeyTime.current || 0);
  lastKeyTime.current = now;
  if (gap > 150) {
    // new burst
    setBuffer("");
  }
  if (e.key === "Enter") {
    if (buffer.trim().length) handleScan(buffer.trim());
    setBuffer("");
    return;
  }
  if (e.key.length === 1) setBuffer(prev => prev + e.key);
};
window.addEventListener("keydown", handler);
return () => window.removeEventListener("keydown", handler);

}, [buffer]);

function playBeep(ok = true) { if (!beep) return; try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = ok ? "triangle" : "square"; o.frequency.value = ok ? 880 : 220; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.05, ctx.currentTime); o.start(); o.stop(ctx.currentTime + 0.12); } catch {} }

function parsePayload(s: string) { const out: any = { raw: s };

// Try key=value pairs like "case=25-12345-1&slide=A1"
if (/[&=]/.test(s)) {
  const parts = s.split(/[&]/);
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (!k) continue;
    out[k.trim().toLowerCase()] = v ? decodeURIComponent(v.trim()) : "";
  }
}

// Try CSV key:value pairs
if (/:/.test(s) && /,/.test(s)) {
  s.split(",").forEach(t => {
    const [k, v] = t.split(":");
    if (k && v) out[k.trim().toLowerCase()] = v.trim();
  });
}

// Prefix tags
// Examples: SLD:24-12345-A1, BLK:24-12345-B03, CNT:XYZ123, CS:24-12345
const m = s.match(/^(SLD|BLK|CNT|CS|CASE)[:#\- ]?(.*)$/i);
if (m) {
  const tag = m[1].toUpperCase();
  const val = m[2].trim();
  if (tag === "SLD") out.slideid = val;
  if (tag === "BLK") out.blockid = val;
  if (tag === "CNT") out.containerid = val;
  if (tag === "CASE" || tag === "CS") out.caseid = val;
}

// Fallback: try to infer by simple heuristics
if (!out.caseid && /\d{2}-\d{5}/.test(s)) {
  out.caseid = (s.match(/\d{2}-\d{5}[A-Z0-9\-]*/)?.[0] || "").trim();
}

// If nothing identified, treat as container or slide catch-all
if (!out.caseid && !out.slideid && !out.blockid && !out.containerid) {
  out.containerid = s;
}
return out;

}

function handleScan(scan: string) { const data = parsePayload(scan); const ts = new Date().toISOString(); const base = { Timestamp: ts, Operator: operator || "", CaseID: data.caseid || "", SlideID: data.slideid || "", BlockID: data.blockid || "", ContainerID: data.containerid || "", IssueType: "", Notes: "", Raw: data.raw };

// Dedupe by exact tuple of Case/Slide/Block/Container when dedupe is on
if (dedupe) {
  const key = (r: any) => [r.CaseID, r.SlideID, r.BlockID, r.ContainerID].join("|");
  const exists = rows.some(r => key(r) === key(base));
  if (exists) {
    playBeep(false);
    return;
  }
}

setRows(prev => [base, ...prev]);
playBeep(true);

}

function handleManualSubmit(e: React.FormEvent) { e.preventDefault(); if (!inputRef.current) return; const val = inputRef.current.value.trim(); if (val) handleScan(val); inputRef.current.value = ""; inputRef.current.focus(); }

function updateRow(idx: number, field: string, value: string) { setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))); }

function deleteRow(idx: number) { setRows(prev => prev.filter((_, i) => i !== idx)); }

function clearAll() { if (!confirm("This clears all rows. You sure?")) return; setRows([]); }

function exportCSV() { const headers = [ "Timestamp", "Operator", "CaseID", "SlideID", "BlockID", "ContainerID", "IssueType", "Notes", "Raw" ]; const csv = [headers.join(",")] .concat( rows.map(r => headers .map(h => { const v = (r as any)[h] ?? ""; const s = String(v).replaceAll('"', '""'); return '"' + s + '"'; }) .join(",") ) ) .join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); const a = document.createElement("a"); const url = URL.createObjectURL(blob); a.href = url; a.download = qc_scan_export_${new Date().toISOString().slice(0,10)}.csv; a.click(); URL.revokeObjectURL(url); }

const total = rows.length;

return ( <div className="min-h-screen bg-gray-950 text-gray-100 p-6"> <div className="max-w-6xl mx-auto space-y-6"> <header className="flex items-center justify-between"> <h1 className="text-2xl font-bold tracking-tight">Rapid QC Capture</h1> <div className="flex items-center gap-3"> <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-gray-200 text-gray-900 hover:bg-white shadow">Export CSV</button> <button onClick={clearAll} className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600">Clear All</button> </div> </header>

<section className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl p-4 bg-gray-900 shadow">
        <h2 className="font-semibold mb-3">Scanner input</h2>
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <input ref={inputRef} placeholder="Scan barcode or paste here, then Enter" className="w-full px-3 py-2 rounded-xl bg-gray-800 outline-none" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={autoFocus} onChange={e => setAutoFocus(e.target.checked)} /> Autofocus</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={dedupe} onChange={e => setDedupe(e.target.checked)} /> Dedupe</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={beep} onChange={e => setBeep(e.target.checked)} /> Beep</label>
            <div className="flex items-center gap-2"><span>Operator</span><input value={operator} onChange={e => setOperator(e.target.value)} className="flex-1 px-2 py-1 rounded bg-gray-800" placeholder="Initials"/></div>
          </div>
          <p className="text-xs text-gray-400">You can also scan without focusing this box. Fast key bursts are captured globally.</p>
        </form>
      </div>

      <div className="rounded-2xl p-4 bg-gray-900 shadow">
        <h2 className="font-semibold mb-3">Issue types</h2>
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {issueTypes.map((it, i) => (
              <span key={i} className="px-2 py-1 rounded-xl bg-gray-800 text-xs">{it}</span>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input id="newIssue" placeholder="Add new type" className="px-3 py-2 rounded-xl bg-gray-800 flex-1"/>
            <button className="px-3 py-2 rounded-xl bg-gray-200 text-gray-900" onClick={() => {
              const el = document.getElementById("newIssue") as HTMLInputElement | null;
              if (!el) return;
              const v = el.value.trim();
              if (!v) return;
              setIssueTypes(prev => Array.from(new Set([...

prev, v]))); el.value = ""; }}>Add</button> </div> </div> </div> </section>

<section className="rounded-2xl p-4 bg-gray-900 shadow">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Captured rows <span className="text-gray-400 text-sm">{total}</span></h2>
        <span className="text-xs text-gray-400">Newest first</span>
      </div>
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="text-left">
              {[
                "Timestamp","Operator","CaseID","SlideID","BlockID","ContainerID","IssueType","Notes","Raw",""
              ].map(h => (
                <th key={h} className="p-2 border-b border-gray-800">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="odd:bg-gray-950">
                <td className="p-2 align-top">{r.Timestamp}</td>
                <td className="p-2 align-top">{r.Operator}</td>
                <td className="p-2 align-top">{r.CaseID}</td>
                <td className="p-2 align-top">{r.SlideID}</td>
                <td className="p-2 align-top">{r.BlockID}</td>
                <td className="p-2 align-top">{r.ContainerID}</td>
                <td className="p-2 align-top w-40">
                  <select value={r.IssueType} onChange={e => updateRow(idx, "IssueType", e.target.value)} className="w-full bg-gray-800 rounded px-2 py-1">
                    <option value=""></option>
                    {issueTypes.map((it, i) => <option key={i} value={it}>{it}</option>)}
                  </select>
                </td>
                <td className="p-2 align-top w-80">
                  <textarea value={r.Notes} onChange={e => updateRow(idx, "Notes", e.target.value)} className="w-full bg-gray-800 rounded px-2 py-1 h-16"/>
                </td>
                <td className="p-2 align-top text-xs text-gray-400 max-w-[18rem] break-words">{r.Raw}</td>
                <td className="p-2 align-top">
                  <button onClick={() => deleteRow(idx)} className="px-3 py-1 rounded bg-red-500 hover:bg-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className="text-xs text-gray-400 space-y-2">
      <p>Parsing rules: accepts key=value pairs, CSV key:value, prefixed SLD/BLK/CNT/CASE, or plain strings. Heuristic extracts YY-##### patterns into CaseID.</p>
      <p>Recommended barcode content: <code>case=25-12345&slide=A1</code> or <code>SLD:25-12345-A1</code>. Keep it boring. Your future self will thank you.</p>
    </section>
  </div>
</div>

); }
