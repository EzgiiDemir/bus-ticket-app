"use client";
import { useMemo, useState } from "react";

export type CoreFilters = {
    tripType: "oneway" | "roundtrip";
    from: string;
    to: string;
    date: string; // YYYY-MM-DD
};

export type AdvancedFilters = {
    depStart?: string;
    depEnd?: string;
    arrStart?: string;
    arrEnd?: string;
    minPrice?: string;
    maxPrice?: string;
    busLayout?: "" | "2+1" | "2+2";
    company?: string;
    sortBy?: "" | "price_asc" | "price_desc" | "time_asc" | "time_desc";
};

export type Terminal = { id: number; name: string; city: string; code: string };
export type Company = { id: number; name: string; code: string };

export default function TripFilters({
                                        core,
                                        onCoreChange,
                                        adv,
                                        onAdvChange,
                                        terminals,
                                        companies,
                                        onRefresh,
                                        onPrevDay,
                                        onNextDay,
                                    }: {
    core: CoreFilters;
    onCoreChange: (p: Partial<CoreFilters>) => void;
    adv: AdvancedFilters;
    onAdvChange: (p: Partial<AdvancedFilters>) => void;
    terminals: Terminal[];
    companies: Company[];
    onRefresh: () => void;
    onPrevDay: () => void;
    onNextDay: () => void;
}) {
    const [open, setOpen] = useState(false);

    // ---- validation helpers ----
    const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const isValidDate = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(core.date), [core.date]);
    const navDisabled = !isValidDate || !core.date;

    const safeCoreChange = (patch: Partial<CoreFilters>) => {
        const next = { ...core, ...patch };
        next.from = (next.from || "").trim();
        next.to = (next.to || "").trim();
        next.date = (next.date || "").trim();

        if (patch.from !== undefined && next.from && next.from === next.to) next.to = "";
        if (patch.to !== undefined && next.to && next.to === next.from) next.from = "";

        if (patch.date !== undefined && next.date && !/^\d{4}-\d{2}-\d{2}$/.test(next.date)) next.date = "";

        onCoreChange(next);
    };

    const clearAdv = () =>
        onAdvChange({
            depStart: "",
            depEnd: "",
            arrStart: "",
            arrEnd: "",
            minPrice: "",
            maxPrice: "",
            busLayout: "",
            company: "",
            sortBy: "",
        });

    const swapFromTo = () => {
        if (!core.from && !core.to) return;
        onCoreChange({ from: core.to, to: core.from });
    };

    return (
        <>
            {/* BAR: mobilde dikey, md+ yatay */}
            <div className="rounded-2xl bg-white p-4 shadow grid gap-3 md:grid-cols-[auto,1fr,auto] md:items-center">
                {/* Yolculuk tipi */}
                <div className="flex w-full gap-2" role="group" aria-label="Yolculuk tipi">
                    <button
                        type="button"
                        className={`w-1/2 md:w-auto px-3 py-2 rounded-lg border ${core.tripType === "oneway" ? "bg-indigo-600 text-white" : ""}`}
                        onClick={() => safeCoreChange({ tripType: "oneway" })}
                        aria-pressed={core.tripType === "oneway"}
                    >
                        Tek Yön
                    </button>
                    <button
                        type="button"
                        className={`w-1/2 md:w-auto px-3 py-2 rounded-lg border ${core.tripType === "roundtrip" ? "bg-indigo-600 text-white" : ""}`}
                        onClick={() => safeCoreChange({ tripType: "roundtrip" })}
                        aria-pressed={core.tripType === "roundtrip"}
                    >
                        Gidiş-Dönüş
                    </button>
                </div>

                {/* From / To / Date: mobilde 2 sütun, md+ yatay */}
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                    <label className="sr-only" htmlFor="fromSel">Nereden</label>
                    <select
                        id="fromSel"
                        className="col-span-2 md:col-span-1 w-full rounded-lg border px-3 py-2"
                        value={core.from}
                        onChange={(e) => safeCoreChange({ from: e.target.value })}
                        aria-label="Nereden"
                    >
                        <option value="">Nereden</option>
                        {terminals.map((t) => (
                            <option key={t.id} value={t.name}>
                                {t.city} — {t.name}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        className="flex md:inline-flex items-center justify-center px-2 py-2 rounded-lg border"
                        onClick={swapFromTo}
                        title="Kalkış ↔ Varış değiştir"
                        aria-label="Kalkış ve varış yerlerini değiştir"
                    >
                        ↔
                    </button>

                    <label className="sr-only" htmlFor="toSel">Nereye</label>
                    <select
                        id="toSel"
                        className="w-full rounded-lg border px-3 py-2"
                        value={core.to}
                        onChange={(e) => safeCoreChange({ to: e.target.value })}
                        aria-label="Nereye"
                    >
                        <option value="">Nereye</option>
                        {terminals.map((t) => (
                            <option key={t.id} value={t.name} disabled={t.name === core.from}>
                                {t.city} — {t.name}
                            </option>
                        ))}
                    </select>

                    <label className="sr-only" htmlFor="dateInp">Tarih</label>
                    <input
                        id="dateInp"
                        type="date"
                        className="col-span-2 md:col-span-1 w-full rounded-lg border px-3 py-2"
                        value={core.date}
                        onChange={(e) => safeCoreChange({ date: e.target.value })}
                        min={todayStr}
                        aria-invalid={!!core.date && !isValidDate}
                    />
                </div>

                {/* Aksiyonlar: mobilde sticky alt bar değil; üstte sığmazsa sarar */}
                <div className="flex flex-wrap md:justify-end gap-2">
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border w-full sm:w-auto"
                        onClick={() => setOpen(true)}
                        aria-expanded={open}
                        aria-controls="filters-panel"
                    >
                        Filtre Detayı
                    </button>
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border w-full sm:w-auto"
                        disabled={navDisabled}
                        onClick={onPrevDay}
                    >
                        Önceki Gün
                    </button>
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border w-full sm:w-auto"
                        disabled={navDisabled}
                        onClick={onNextDay}
                    >
                        Sonraki Gün
                    </button>
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border w-full sm:w-auto"
                        onClick={onRefresh}
                    >
                        Yenile
                    </button>
                </div>
            </div>

            {/* DETAY PANELİ: mobil tam ekran sağdan kayar, md+ max-w-md */}
            {open && (
                <div className="fixed inset-0 z-50">
                    <button
                        className="absolute inset-0 bg-black/30"
                        aria-label="Kapat"
                        onClick={() => setOpen(false)}
                    />
                    <div
                        id="filters-panel"
                        className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-white shadow-xl p-4 overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Filtre Detayı"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">Filtre Detayı</h3>
                            <button className="px-3 py-1 rounded-lg border" onClick={() => setOpen(false)}>
                                Kapat
                            </button>
                        </div>

                        <p className="text-xs text-indigo-900/60 mb-4">Boş bıraktıkların uygulanmaz.</p>

                        <div className="space-y-6">
                            {/* Kalkış saati */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Kalkış Saati Aralığı</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Başlangıç</label>
                                        <input
                                            type="time"
                                            className="w-full rounded-lg border px-2 py-2"
                                            value={adv.depStart || ""}
                                            onChange={(e) => onAdvChange({ depStart: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Bitiş</label>
                                        <input
                                            type="time"
                                            className="w-full rounded-lg border px-2 py-2"
                                            value={adv.depEnd || ""}
                                            onChange={(e) => onAdvChange({ depEnd: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Varış saati */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Varış Saati Aralığı</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Başlangıç</label>
                                        <input
                                            type="time"
                                            className="w-full rounded-lg border px-2 py-2"
                                            value={adv.arrStart || ""}
                                            onChange={(e) => onAdvChange({ arrStart: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Bitiş</label>
                                        <input
                                            type="time"
                                            className="w-full rounded-lg border px-2 py-2"
                                            value={adv.arrEnd || ""}
                                            onChange={(e) => onAdvChange({ arrEnd: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Fiyat */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Bilet Ücreti (₺)</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">En az</label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            className="w-full rounded-lg border px-3 py-2"
                                            placeholder="0"
                                            value={adv.minPrice || ""}
                                            onChange={(e) => onAdvChange({ minPrice: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">En çok</label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            className="w-full rounded-lg border px-3 py-2"
                                            placeholder="1000"
                                            value={adv.maxPrice || ""}
                                            onChange={(e) => onAdvChange({ maxPrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Düzen / Firma */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Otobüs Düzeni ve Firma</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Otobüs Düzeni</label>
                                        <select
                                            className="w-full rounded-lg border px-3 py-2"
                                            value={adv.busLayout || ""}
                                            onChange={(e) => onAdvChange({ busLayout: e.target.value as AdvancedFilters["busLayout"] })}
                                        >
                                            <option value="">Tümü</option>
                                            <option value="2+1">2+1</option>
                                            <option value="2+2">2+2</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-900/70 mb-1">Firma</label>
                                        <select
                                            className="w-full rounded-lg border px-3 py-2"
                                            value={adv.company || ""}
                                            onChange={(e) => onAdvChange({ company: e.target.value })}
                                        >
                                            <option value="">Tüm Firmalar</option>
                                            {companies.map((c) => (
                                                <option key={c.id} value={c.name}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Sıralama */}
                            <section>
                                <div className="text-sm font-semibold mb-2">Sıralama</div>
                                <select
                                    className="w-full rounded-lg border px-3 py-2"
                                    value={adv.sortBy || ""}
                                    onChange={(e) => onAdvChange({ sortBy: e.target.value as NonNullable<AdvancedFilters["sortBy"]> })}
                                >
                                    <option value="">Varsayılan</option>
                                    <option value="price_asc">En ucuz önce</option>
                                    <option value="price_desc">En pahalı önce</option>
                                    <option value="time_asc">En erken kalkış</option>
                                    <option value="time_desc">En geç kalkış</option>
                                </select>
                            </section>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                                <button className="px-3 py-2 rounded-lg border w-full sm:w-auto" type="button" onClick={clearAdv} title="Tüm detay filtrelerini temizle">
                                    Temizle
                                </button>
                                <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white w-full sm:w-auto" onClick={() => setOpen(false)}>
                                    Filtreleri Uygula
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
