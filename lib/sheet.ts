import Papa from "papaparse";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type Row = { year: number; district: string; villages: number; patients: number };
export type Loaded = { rows: Row[]; source: "google-sheet" | "local-csv"; fetchedAt: string };

const num = (v: unknown) => Number(String(v ?? "").replace(/,/g, "").trim());

/** ดึง CSV สดจาก Google Sheet ทุกครั้งที่มีคนเปิดหน้า (on the fly) */
export async function loadRows(): Promise<Loaded> {
  const id = process.env.GOOGLE_SHEET_ID?.trim();
  const gid = process.env.GOOGLE_SHEET_GID?.trim();
  let text: string;
  let source: Loaded["source"];

  if (id) {
    // ถ้าไม่ระบุ gid จะได้แท็บแรกของไฟล์
    const url =
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv` + (gid ? `&gid=${gid}` : "");
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    const body = await res.text();
    if (!res.ok || body.trimStart().startsWith("<")) {
      throw new Error(
        `อ่าน Google Sheet ไม่ได้ (สถานะ ${res.status}) — URL ที่เรียก: ${url} — ตรวจ ID/gid และสิทธิ์แชร์`
      );
    }
    text = body;
    source = "google-sheet";
  } else {
    text = await readFile(path.join(process.cwd(), "public", "data.csv"), "utf8");
    source = "local-csv";
  }

  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: true });
  const rows: Row[] = parsed.data
    .slice(1)
    .map((r) => ({ year: num(r[0]), district: String(r[1] ?? "").trim(), villages: num(r[2]), patients: num(r[3]) }))
    .filter((r) => Number.isFinite(r.year) && r.year > 0 && r.district && Number.isFinite(r.patients));

  return { rows, source, fetchedAt: new Date().toISOString() };
}