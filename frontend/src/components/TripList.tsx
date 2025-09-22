"use client";
type Trip = {
    id:number; trip?:string; company_name?:string;
    terminal_from:string; terminal_to:string;
    departure_time:string; cost:number|string;
    bus_type?:string|null; seat_map?:{layout?:"2+1"|"2+2"}|null;
};

const TRYc = new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
const toDate=(s:string)=>{ const n=s.includes("T")?s:s.replace(" ","T"); const d=new Date(n); return isNaN(d.getTime())?null:d; };
const fmt=(s:string)=>{ const d=toDate(s); return d?d.toLocaleString():s; };

export default function TripList({
                                     rows, closingSoon, page, lastPage,
                                     onPrev, onNext, onBuy,
                                 }:{ rows:Trip[]; closingSoon:Set<number>; page:number; lastPage:number|null;
    onPrev:()=>void; onNext:()=>void; onBuy:(id:number)=>void }) {

    const canNext = lastPage===null ? true : page < lastPage;

    return (
        <div className="rounded-2xl border bg-white p-4 shadow overflow-x-auto">
            <table className="hidden md:table min-w-[980px] w-full text-sm">
                <thead>
                <tr className="text-left text-indigo-900/60">
                    <th className="py-2">Firma</th><th>Sefer</th><th>Kalkış</th><th>Varış</th><th>Tarih/Saat</th><th>Ücret</th><th>Düzen</th><th className="text-right">İşlem</th>
                </tr>
                </thead>
                <tbody>
                {rows.map(r=>{
                    const soon = closingSoon.has(r.id);
                    return (
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.company_name||"-"}</td>
                            <td className="font-medium">{r.trip||"-"}</td>
                            <td>{r.terminal_from}</td>
                            <td>{r.terminal_to}</td>
                            <td>
                                <div className="flex items-center gap-2">
                                    <span>{fmt(r.departure_time)}</span>
                                    {soon && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border">Kapanmak Üzere</span>}
                                </div>
                            </td>
                            <td>{TRYc.format(Number(r.cost||0))}</td>
                            <td>{(r.bus_type||r.seat_map?.layout||"-") as string}</td>
                            <td className="text-right">
                                <button className={`px-3 py-1 rounded-lg border ${soon?"opacity-50 cursor-not-allowed":""}`} onClick={()=>onBuy(r.id)} disabled={soon}>Satın Al</button>
                            </td>
                        </tr>
                    );
                })}
                {!rows.length && <tr><td colSpan={8} className="py-8 text-center text-gray-500">Kayıt yok.</td></tr>}
                </tbody>
            </table>

            <div className="md:hidden space-y-3">
                {rows.map(r=>{
                    const soon = closingSoon.has(r.id);
                    return (
                        <div key={r.id} className="rounded-2xl border bg-white p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">{r.trip ?? "-"}</div>
                                <span className="text-xs px-2 py-1 rounded-lg border">{r.company_name ?? "-"}</span>
                            </div>
                            <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
                                <div className="text-indigo-900/60">Güzergâh</div><div>{r.terminal_from} → {r.terminal_to}</div>
                                <div className="text-indigo-900/60">Kalkış</div><div>{fmt(r.departure_time)}</div>
                                <div className="text-indigo-900/60">Ücret</div><div>{TRYc.format(Number(r.cost||0))}</div>
                                <div className="text-indigo-900/60">Düzen</div><div>{(r.bus_type||r.seat_map?.layout||"-") as string}</div>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button className={`px-3 py-2 rounded-lg border ${soon?"opacity-50 cursor-not-allowed":""}`} onClick={()=>onBuy(r.id)} disabled={soon}>Satın Al</button>
                            </div>
                        </div>
                    );
                })}
                {!rows.length && <div className="py-6 text-center text-gray-500">Kayıt yok.</div>}
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">Sayfa {page}{lastPage?` / ${lastPage}`:""}</div>
                <div className="flex gap-2">
                    <button className="px-3 py-2 rounded-lg border disabled:opacity-50" disabled={page<=1} onClick={onPrev}>Geri</button>
                    <button className="px-3 py-2 rounded-lg border disabled:opacity-50" disabled={!canNext} onClick={onNext}>Daha Fazla Yükle</button>
                </div>
            </div>
        </div>
    );
}
