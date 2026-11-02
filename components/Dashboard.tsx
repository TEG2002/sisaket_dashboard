"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Loaded, Row } from "@/lib/sheet";

const TEAL_MAIN = "#0d9488";
const TEAL_DARK = "#0f766e";
const TEAL_LIGHT = "#14b8a6";
const AMBER_MAIN = "#f59e0b";
const MUTED = "#64748b";

const fmt = (n: number) => n.toLocaleString("th-TH");
const sum = (rows: Row[], k: "patients" | "villages") => rows.reduce((a, r) => a + r[k], 0);

export default function Dashboard({ rows, source, fetchedAt }: Loaded) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [searchDistrict, setSearchDistrict] = useState("");
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  // Initialize theme
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort(), [rows]);
  const districts = useMemo(
    () => [...new Set(rows.map((r) => r.district))].sort((a, b) => a.localeCompare(b, "th")),
    [rows]
  );

  const [year, setYear] = useState<number | "all">("all");
  const [district, setDistrict] = useState<string>("all");

  const byDistrictScope = useMemo(
    () => rows.filter((r) => district === "all" || r.district === district),
    [rows, district]
  );

  const scoped = useMemo(
    () => byDistrictScope.filter((r) => year === "all" || r.year === year),
    [byDistrictScope, year]
  );

  // KPIs
  const totalPatients = sum(scoped, "patients");
  const totalVillages = sum(scoped, "villages");
  const grandTotalPatients = sum(rows, "patients");
  const activeDistricts = new Set(scoped.filter((r) => r.patients > 0).map((r) => r.district)).size;
  const avgPerVillage = totalVillages ? (totalPatients / totalVillages).toFixed(1) : "–";
  const pctOfProvince = grandTotalPatients > 0 ? ((totalPatients / grandTotalPatients) * 100).toFixed(1) : "100";

  // Trend data
  const trend = useMemo(() => {
    return years.map((y) => {
      const rs = byDistrictScope.filter((r) => r.year === y);
      return {
        year: String(y),
        patients: sum(rs, "patients"),
        villages: sum(rs, "villages"),
      };
    });
  }, [years, byDistrictScope]);

  // District rankings
  const ranking = useMemo(() => {
    const m = new Map<string, number>();
    rows
      .filter((r) => year === "all" || r.year === year)
      .forEach((r) => m.set(r.district, (m.get(r.district) ?? 0) + r.patients));

    return [...m]
      .map(([name, patients]) => ({ name, patients }))
      .sort((a, b) => b.patients - a.patients);
  }, [rows, year]);

  const displayedRanking = useMemo(() => {
    return showAllRanks ? ranking : ranking.slice(0, 10);
  }, [ranking, showAllRanks]);

  // Matrix
  const matrix = useMemo(() => {
    const max = Math.max(...rows.map((r) => r.patients), 1);
    const lines = districts.map((d) => ({
      d,
      cells: years.map((y) => rows.find((r) => r.district === d && r.year === y)),
      total: sum(rows.filter((r) => r.district === d), "patients"),
    }));
    return { max, lines };
  }, [rows, districts, years]);

  // Filtered Matrix for search
  const filteredMatrixLines = useMemo(() => {
    if (!searchDistrict.trim()) return matrix.lines;
    const q = searchDistrict.trim().toLowerCase();
    return matrix.lines.filter((line) => line.d.toLowerCase().includes(q));
  }, [matrix.lines, searchDistrict]);

  // Total for each year in matrix
  const yearTotals = useMemo(() => {
    return years.map((y) => {
      const rs = rows.filter((r) => r.year === y);
      return sum(rs, "patients");
    });
  }, [years, rows]);

  // Incomplete years check
  const missing = useMemo(() => {
    return years
      .map((y) => ({ y, n: new Set(rows.filter((r) => r.year === y).map((r) => r.district)).size }))
      .filter((x) => x.n < districts.length);
  }, [years, rows, districts]);

  // CSV export
  const handleExportCSV = () => {
    const header = ["ปี", "อำเภอ", "หมู่บ้าน/ชุมชน", "ผู้ป่วยเข้ารับบำบัด"];
    const csvContent = [
      header.join(","),
      ...scoped.map((r) => [r.year, `"${r.district}"`, r.villages, r.patients].join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sisaket_treatment_${year}_${district}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setYear("all");
    setDistrict("all");
  };

  return (
    <main className="dashboard-wrap">
      {/* Top Navigation Bar */}
      <header className="top-nav">
        <div className="brand-row">
          <div className="brand-identity">
            <div className="brand-emblem" title="จังหวัดศรีสะเกษ">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                <path d="M12 5v14" />
              </svg>
            </div>
            <div className="brand-title">
              <h1>ข้อมูลผู้ป่วยเข้ารับการบำบัด จังหวัดศรีสะเกษ</h1>
              <div className="brand-meta">
                <span className="meta-badge">
                  <span className="pulse-dot" />
                  {source === "google-sheet" ? "Google Sheet สด" : "CSV ข้อมูลท้องถิ่น"}
                </span>
                <span className="meta-badge amber">
                  พ.ศ. {years[0]} – {years[years.length - 1]}
                </span>
                <span>
                  อัปเดต: {new Date(fetchedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" })}
                </span>
              </div>
            </div>
          </div>

          <div className="brand-actions">
            <button className="action-btn" onClick={handleRefresh} disabled={isRefreshing} title="ดึงข้อมูลล่าสุด">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }}
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              รีเฟรช
            </button>

            <button className="action-btn" onClick={handleExportCSV} title="ดาวน์โหลดเป็นไฟล์ CSV">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              ส่งออก CSV
            </button>

            <button className="action-btn" onClick={toggleTheme} title="สลับโหมดมืด/สว่าง">
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Filter Toolbar Cockpit */}
        <div className="filter-cockpit">
          <div className="filter-group">
            <span className="filter-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              ปี พ.ศ.
            </span>
            <div className="year-chips">
              <button
                className={`chip-btn ${year === "all" ? "active" : ""}`}
                onClick={() => setYear("all")}
              >
                ทั้งหมด
              </button>
              {years.map((y) => (
                <button
                  key={y}
                  className={`chip-btn ${year === y ? "active" : ""}`}
                  onClick={() => setYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              อำเภอ
            </span>
            <div className="district-select-wrap">
              <select
                className="district-select"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="all">ทุกอำเภอ ({districts.length} อำเภอ)</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="select-arrow">▼</span>
            </div>

            {(year !== "all" || district !== "all") && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {district !== "all" && (
                  <span className="active-filter-badge">
                    อำเภอ: {district}
                    <button className="clear-chip-btn" onClick={() => setDistrict("all")} title="ล้างตัวกรองอำเภอ">
                      ×
                    </button>
                  </span>
                )}
                {year !== "all" && (
                  <span className="active-filter-badge">
                    ปี {year}
                    <button className="clear-chip-btn" onClick={() => setYear("all")} title="ล้างตัวกรองปี">
                      ×
                    </button>
                  </span>
                )}
                <button className="action-btn" style={{ padding: "4px 8px", fontSize: "0.78rem" }} onClick={resetFilters}>
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Warning Notice Banner */}
      {missing.length > 0 && !isAlertDismissed && (
        <div className="alert-banner">
          <div className="alert-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <strong>ข้อสังเกตความสมบูรณ์ของข้อมูล:</strong>{" "}
            {missing.map((m) => `ปี ${m.y} บันทึกข้อมูล ${m.n} จากทั้งหมด ${districts.length} อำเภอ`).join(", ")} —
            สถิติรวมของปีดังกล่าวอาจต่ำกว่าความเป็นจริงในพื้นที่
          </div>
          <button
            onClick={() => setIsAlertDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.7 }}
            title="ปิดการแจ้งเตือน"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Highlights Cards */}
      <section className="kpis-grid">
        <div className="kpi-card hero">
          <div className="kpi-header">
            <span className="kpi-label">ผู้ป่วยเข้ารับการบำบัด</span>
            <div className="kpi-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
          </div>
          <div className="kpi-value">{fmt(totalPatients)}</div>
          <div className="kpi-subtext">
            <span>ราย</span>
            {district !== "all" && <span>· คิดเป็น {pctOfProvince}% ของทั้งจังหวัด</span>}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">หมู่บ้าน / ชุมชน</span>
            <div className="kpi-icon-wrap amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
          </div>
          <div className="kpi-value">{fmt(totalVillages)}</div>
          <div className="kpi-subtext">พื้นที่ดำเนินงานชุมชนบำบัด</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">อำเภอที่รายงานข้อมูล</span>
            <div className="kpi-icon-wrap blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          </div>
          <div className="kpi-value">
            {activeDistricts} <span style={{ fontSize: "1.1rem", fontWeight: 400, color: MUTED }}>/ {districts.length}</span>
          </div>
          <div className="kpi-subtext">อำเภอที่มีสถิติผู้เข้ารับบำบัด</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">เฉลี่ยต่อหมู่บ้าน</span>
            <div className="kpi-icon-wrap indigo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="kpi-value">{avgPerVillage}</div>
          <div className="kpi-subtext">ราย / ชุมชนที่ดำเนินงาน</div>
        </div>
      </section>

      {/* Visual Analytics Grid */}
      <section className="charts-grid">
        {/* Trend Chart */}
        <article className="content-card">
          <div className="card-title-row">
            <div className="card-title-wrap">
              <h2>แนวโน้มรายปี {district !== "all" ? `· ${district}` : "· ภาพรวมทั้งจังหวัด"}</h2>
              <div className="card-subtitle">เปรียบเทียบจำนวนผู้ป่วยและจำนวนชุมชนตามปีงบประมาณ</div>
            </div>
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 15, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL_LIGHT} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={TEAL_DARK} stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: MUTED, fontSize: 13 }} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="custom-tooltip">
                          <div className="tooltip-title">ปี พ.ศ. {label}</div>
                          <div className="tooltip-row">
                            <span style={{ color: TEAL_LIGHT }}>● ผู้ป่วยเข้ารับบำบัด:</span>
                            <span className="tooltip-val">{fmt(Number(payload[0].value))} ราย</span>
                          </div>
                          <div className="tooltip-row">
                            <span style={{ color: AMBER_MAIN }}>● หมู่บ้าน/ชุมชน:</span>
                            <span className="tooltip-val" style={{ color: AMBER_MAIN }}>
                              {fmt(Number(payload[1].value))} แห่ง
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="l" dataKey="patients" name="ผู้ป่วย (ราย)" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                <Line
                  yAxisId="r"
                  dataKey="villages"
                  name="หมู่บ้าน/ชุมชน"
                  stroke={AMBER_MAIN}
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#fff", stroke: AMBER_MAIN, strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-legend-custom">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: TEAL_MAIN }} />
              ผู้ป่วยเข้ารับบำบัด (แกนซ้าย)
            </span>
            <span className="legend-item">
              <span className="legend-swatch line" style={{ background: AMBER_MAIN }} />
              หมู่บ้าน/ชุมชน (แกนขวา)
            </span>
          </div>
        </article>

        {/* Ranking Chart */}
        <article className="content-card">
          <div className="card-title-row">
            <div className="card-title-wrap">
              <h2>อันดับอำเภอ {year === "all" ? "(รวมทุกปี)" : `(ปี พ.ศ. ${year})`}</h2>
              <div className="card-subtitle">เรียงลำดับจำนวนผู้ป่วยเข้ารับการบำบัดสูงสุด</div>
            </div>
            <button
              className="action-btn"
              style={{ padding: "4px 10px", fontSize: "0.8rem" }}
              onClick={() => setShowAllRanks(!showAllRanks)}
            >
              {showAllRanks ? "แสดงเฉพาะ Top 10" : `ดูครบทุกอำเภอ (${ranking.length})`}
            </button>
          </div>

          <div style={{ width: "100%", height: Math.max(320, displayedRanking.length * 28) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayedRanking}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: MUTED, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.16)]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={105}
                  tick={{ fill: "var(--text-main)", fontSize: 13, fontWeight: 500 }}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as { name: string; patients: number };
                      const rankIndex = ranking.findIndex((x) => x.name === item.name) + 1;
                      return (
                        <div className="custom-tooltip">
                          <div className="tooltip-title">
                            อันดับที่ {rankIndex} · อำเภอ{item.name}
                          </div>
                          <div className="tooltip-row">
                            <span>ผู้ป่วยสะสม:</span>
                            <span className="tooltip-val">{fmt(item.patients)} ราย</span>
                          </div>
                          <div style={{ marginTop: "6px", fontSize: "0.74rem", color: "#94a3b8" }}>
                            คลิกเพื่อกรองข้อมูลเฉพาะอำเภอนี้
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="patients"
                  name="ผู้ป่วย (ราย)"
                  radius={[0, 6, 6, 0]}
                  onClick={(d) => setDistrict(d.name === district ? "all" : d.name)}
                >
                  <LabelList
                    dataKey="patients"
                    position="right"
                    formatter={(v: unknown) => `${fmt(Number(v))} ราย`}
                    fill="var(--text-muted)"
                    fontSize={11}
                    fontWeight={500}
                    offset={8}
                  />
                  {displayedRanking.map((r, i) => {
                    const isSelected = district === r.name;
                    const isGlobal = district === "all";
                    let fill = TEAL_MAIN;
                    if (isSelected) fill = "#059669";
                    else if (!isGlobal) fill = "#94a3b8";
                    else if (i === 0) fill = TEAL_DARK;
                    return <Cell key={r.name} fill={fill} cursor="pointer" />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-legend-custom" style={{ justifyContent: "space-between" }}>
            <span>💡 คลิกที่แท่งกราฟเพื่อดูเจาะลึกเฉพาะอำเภอนั้น</span>
            {district !== "all" && (
              <span style={{ color: "#059669", fontWeight: 600 }}>กำลังเลือก: {district}</span>
            )}
          </div>
        </article>
      </section>

      {/* Heatmap Matrix Table */}
      <section className="content-card">
        <div className="table-toolbar">
          <div className="card-title-wrap">
            <h2>ตารางสถิติเปรียบเทียบ อำเภอ × ปี พ.ศ. (จำนวนผู้ป่วย)</h2>
            <div className="card-subtitle">
              แสดงความหนาแน่นผู้ป่วยและสถิติสะสมแยกตามปี (คลิกที่แถวเพื่อเลือกอำเภอ)
            </div>
          </div>

          <div className="table-search-wrap">
            <svg
              className="search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              className="table-search-input"
              placeholder="ค้นหาชื่ออำเภอ..."
              value={searchDistrict}
              onChange={(e) => setSearchDistrict(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="styled-table">
            <thead>
              <tr>
                <th style={{ width: "220px" }}>อำเภอ</th>
                {years.map((y) => (
                  <th key={y} style={{ textAlign: "right" }}>
                    พ.ศ. {y}
                  </th>
                ))}
                <th style={{ textAlign: "right", background: "var(--slate-200)" }}>รวมสะสม</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatrixLines.length === 0 ? (
                <tr>
                  <td colSpan={years.length + 2} className="empty-state">
                    ไม่พบข้อมูลอำเภอที่ตรงกับ &ldquo;{searchDistrict}&rdquo;
                  </td>
                </tr>
              ) : (
                filteredMatrixLines.map(({ d, cells, total }) => {
                  const isSel = d === district;
                  return (
                    <tr
                      key={d}
                      className={isSel ? "selected" : ""}
                      onClick={() => setDistrict(isSel ? "all" : d)}
                    >
                      <td>
                        <strong>{d}</strong>
                        {isSel && (
                          <span
                            style={{
                              marginLeft: "8px",
                              fontSize: "0.72rem",
                              background: TEAL_MAIN,
                              color: "#fff",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            เลือกอยู่
                          </span>
                        )}
                      </td>
                      {cells.map((c, i) => {
                        if (!c) {
                          return (
                            <td key={i} className="num" style={{ color: "var(--text-light)" }}>
                              –
                            </td>
                          );
                        }

                        const ratio = c.patients / matrix.max;
                        const bgIntensity = Math.min(0.9, Math.max(0.08, ratio * 1.1));
                        const isHigh = ratio > 0.42;

                        return (
                          <td key={i} className="num">
                            <span
                              className="heatmap-cell"
                              style={{
                                background: `rgba(13, 148, 136, ${bgIntensity})`,
                                color: isHigh ? "#ffffff" : "var(--text-main)",
                              }}
                            >
                              {fmt(c.patients)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="num" style={{ fontWeight: 700, color: TEAL_DARK }}>
                        {fmt(total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>รวมทั้งจังหวัด ({filteredMatrixLines.length} อำเภอ)</td>
                {yearTotals.map((tot, idx) => (
                  <td key={idx} className="num" style={{ color: TEAL_DARK }}>
                    {fmt(tot)}
                  </td>
                ))}
                <td className="num" style={{ color: TEAL_DARK, fontSize: "1.05rem" }}>
                  {fmt(grandTotalPatients)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div>
          © ศูนย์ข้อมูลสารสนเทศสุขภาพและบำบัดฟื้นฟู จังหวัดศรีสะเกษ · ข้อมูลเพื่อการบริหารและวางแผนเชิงนโยบาย
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <span>จำนวน {districts.length} อำเภอ</span>
          <span>•</span>
          <span>สถิติ พ.ศ. {years[0]} – {years[years.length - 1]}</span>
        </div>
      </footer>
    </main>
  );
}
