import Dashboard from "@/components/Dashboard";
import { loadRows } from "@/lib/sheet";

// ไม่ cache: ประมวลผลใหม่จาก Google Sheet ทุก request
export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const data = await loadRows();
    return <Dashboard {...data} />;
  } catch (e) {
    return (
      <main className="wrap">
        <h1>เกิดข้อผิดพลาด</h1>
        <p>{e instanceof Error ? e.message : "ไม่ทราบสาเหตุ"}</p>
      </main>
    );
  }
}
