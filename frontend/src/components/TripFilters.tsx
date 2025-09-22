"use client";
import { useState } from "react";

export type CoreFilters = { tripType:"oneway"|"roundtrip"; from:string; to:string; date:string };
export type AdvancedFilters = {
    depStart?:string; depEnd?:string; arrStart?:string; arrEnd?:string;
    minPrice?:string; maxPrice?:string; busLayout?:""|"2+1"|"2+2"; company?:string; sortBy?:""|"price_asc"|"price_desc"|"time_asc"|"time_desc";
};
export type Terminal = { id:number; name:string; city:string; code:string };
export type Company  = { id:number; name:string; code:string };

export default function TripFilters({
                                        core,onCoreChange, adv,onAdvChange,
                                        terminals, companies,
                                        onRefresh, onPrevDay, onNextDay,
                                    }:{ core:CoreFilters; onCoreChange:(p:Partial<CoreFilters>)=>void;
    adv:AdvancedFilters; onAdvChange:(p:Partial<AdvancedFilters>)=>void;
    terminals:Terminal[]; companies:Company[];
    onRefresh:()=>void; onPrevDay:()=>void; onNextDay:()=>void }) {

    const [open,setOpen] = useState(false);

    return (
        <>
            <div className="rounded-2xl border bg-white p-4 shadow flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <button className={`px-3 py-2 rounded-lg border ${core.tripType==="oneway"?"bg-indigo-600 text-white":""}`} onClick={()=>onCoreChange({tripType:"oneway"})}>Tek Yön</button>
                    <button className={`px-3 py-2 rounded-lg border ${core.tripType==="roundtrip"?"bg-indigo-600 text-white":""}`} onClick={()=>onCoreChange({tripType:"roundtrip"})}>Gidiş-Dönüş</button>
                </div>

                <select className="rounded-lg border px-3 py-2" value={core.from} onChange={e=>onCoreChange({from:e.target.value})}>
                    <option value="">Nereden</option>
                    {terminals.map(t=> <option key={t.id} value={t.name}>{t.city} — {t.name}</option>)}
                </select>

                <select className="rounded-lg border px-3 py-2" value={core.to} onChange={e=>onCoreChange({to:e.target.value})}>
                    <option value="">Nereye</option>
                    {terminals.map(t=> <option key={t.id} value={t.name}>{t.city} — {t.name}</option>)}
                </select>

                <input type="date" className="rounded-lg border px-3 py-2" value={core.date} onChange={e=>onCoreChange({date:e.target.value})} />

                <button className="ml-auto px-3 py-2 rounded-lg border" onClick={()=>setOpen(true)}>Filtre Detayı</button>
                <button className="px-3 py-2 rounded-lg border" disabled={!core.date} onClick={onPrevDay}>Önceki Gün</button>
                <button className="px-3 py-2 rounded-lg border" disabled={!core.date} onClick={onNextDay}>Sonraki Gün</button>
                <button className="px-3 py-2 rounded-lg border" onClick={onRefresh}>Yenile</button>
            </div>

            {/* DETAY PANELİ (YAN SAĞ) */}
            {open && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30" onClick={()=>setOpen(false)} />
                    <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">Filtre Detayı</h3>
                            <button className="px-3 py-1 rounded-lg border" onClick={()=>setOpen(false)}>Kapat</button>
                        </div>

                        <p className="text-xs text-indigo-900/60 mb-4">Boş bıraktıkların uygulanmaz.</p>

                        <div className="space-y-6">
                            {/* Kalkış saati */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Kalkış Saati Aralığı</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Başlangıç</label>
                                        <input type="time" className="w-full rounded-lg border px-2 py-2"
                                               value={adv.depStart || ""} onChange={e=>onAdvChange({depStart:e.target.value})}/>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Bitiş</label>
                                        <input type="time" className="w-full rounded-lg border px-2 py-2"
                                               value={adv.depEnd || ""} onChange={e=>onAdvChange({depEnd:e.target.value})}/>
                                    </div>
                                </div>
                            </section>

                            {/* Varış saati */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Varış Saati Aralığı</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Başlangıç</label>
                                        <input type="time" className="w-full rounded-lg border px-2 py-2"
                                               value={adv.arrStart || ""} onChange={e=>onAdvChange({arrStart:e.target.value})}/>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Bitiş</label>
                                        <input type="time" className="w-full rounded-lg border px-2 py-2"
                                               value={adv.arrEnd || ""} onChange={e=>onAdvChange({arrEnd:e.target.value})}/>
                                    </div>
                                </div>
                            </section>

                            {/* Fiyat */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Bilet Ücreti (₺)</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">En az</label>
                                        <input type="number" min={0} className="w-full rounded-lg border px-3 py-2"
                                               placeholder="0" value={adv.minPrice || ""}
                                               onChange={e=>onAdvChange({minPrice:e.target.value})}/>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">En çok</label>
                                        <input type="number" min={0} className="w-full rounded-lg border px-3 py-2"
                                               placeholder="1000" value={adv.maxPrice || ""}
                                               onChange={e=>onAdvChange({maxPrice:e.target.value})}/>
                                    </div>
                                </div>
                            </section>

                            {/* Düzen / Firma */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Otobüs Düzeni ve Firma</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Otobüs Düzeni</label>
                                        <select className="w-full rounded-lg border px-3 py-2"
                                                value={adv.busLayout || ""} onChange={e=>onAdvChange({busLayout:e.target.value as any})}>
                                            <option value="">Tümü</option>
                                            <option value="2+1">2+1</option>
                                            <option value="2+2">2+2</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Firma</label>
                                        <select className="w-full rounded-lg border px-3 py-2"
                                                value={adv.company || ""} onChange={e=>onAdvChange({company:e.target.value})}>
                                            <option value="">Tüm Firmalar</option>
                                            {companies.map(c=> <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Sıralama */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Sıralama</div>
                                <select className="w-full rounded-lg border px-3 py-2"
                                        value={adv.sortBy || ""} onChange={e=>onAdvChange({sortBy:e.target.value as any})}>
                                    <option value="">Varsayılan</option>
                                    <option value="price_asc">En ucuz önce</option>
                                    <option value="price_desc">En pahalı önce</option>
                                    <option value="time_asc">En erken kalkış</option>
                                    <option value="time_desc">En geç kalkış</option>
                                </select>
                            </section>

                            <button className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white" onClick={()=>setOpen(false)}>
                                Filtreleri Uygula
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}
