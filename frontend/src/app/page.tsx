"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import TripFilters, {
    CoreFilters,
    AdvancedFilters,
    Terminal,
    Company,
} from "@/components/TripFilters";
import TripList from "@/components/TripList";
import Footer from "@/components/Footer";
import PurchaseModal from "@/components/PurchaseModal";
import { api } from "./lib/api";

/* ---------------- Types ---------------- */
type Trip = {
    id: number;
    trip?: string;
    company_name?: string;
    terminal_from: string;
    terminal_to: string;
    departure_time: string;
    arrival_time?: string | null;
    cost: number | string;
    is_active: boolean | number;
    bus_type?: string | null;
    seat_map?: { layout?: "2+1" | "2+2"; rows?: number } | null;
};

type ApiListProducts = { products: Trip[]; meta?: { current_page?: number; last_page?: number } };
type ApiListData = { data: Trip[]; meta?: { current_page?: number; last_page?: number } };
type ApiList = ApiListProducts | ApiListData | Trip[] | Record<string, any>;

/* ---------------- Utils ---------------- */
const toDate = (s?: string) => {
    if (!s) return null;
    const n = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d;
};
const asBool = (v: any) => v === true || v === 1 || v === "1";
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const priceNum = (v: unknown) =>
    Number(String(v ?? 0).replace(/[^\d.,-]/g, "").replace(",", ".") || 0);

function hasProducts(x: any): x is ApiListProducts {
    return x && Array.isArray(x.products);
}
function hasDataArr(x: any): x is ApiListData {
    return x && Array.isArray(x.data);
}

/* ---------------- Component ---------------- */
export default function HomePage() {
    // Filters
    const [core, setCore] = useState<CoreFilters>({
        tripType: "oneway",
        from: "",
        to: "",
        date: "",
    });
    const [adv, setAdv] = useState<AdvancedFilters>({ sortBy: "" });

    // Data
    const [rows, setRows] = useState<Trip[]>([]);
    const [terminals, setTerminals] = useState<Terminal[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

    // Paging
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState<number | null>(null);
    const [hasServerPaging, setHasServerPaging] = useState(false);
    const pageSize = 10;
    const store = useRef<Trip[]>([]); // client-side paging deposu

    // UI
    const [buyId, setBuyId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    // Initial lookups + first load
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [tRes, cRes] = await Promise.all([
                    api.get("/public/terminals", { public: true }),
                    api.get("/public/companies", { public: true }),
                ]);
                const t = await api.json<any>(tRes);
                const c = await api.json<any>(cRes);
                if (!mounted) return;
                setTerminals(Array.isArray(t) ? (t as Terminal[]) : t?.terminals || []);
                setCompanies(Array.isArray(c) ? (c as Company[]) : c?.companies || []);
                await reload(true);
            } catch (e: any) {
                if (!mounted) return;
                setErr(e?.message || "Veriler yüklenemedi.");
            }
        })();
        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const buildParams = useCallback(() => {
        const p: Record<string, any> = { page, per_page: pageSize };
        if (core.from) p.from = core.from;
        if (core.to) p.to = core.to;
        if (/^\d{4}-\d{2}-\d{2}$/.test(core.date || "")) p.date = core.date;

        // Advanced (opsiyonel)
        if (adv.company) p.company = adv.company;
        if (adv.busLayout) p.bus_layout = adv.busLayout;
        if (adv.minPrice) p.min_price = Number(adv.minPrice) || undefined;
        if (adv.maxPrice) p.max_price = Number(adv.maxPrice) || undefined;
        if (adv.depStart) p.dep_start = adv.depStart;
        if (adv.depEnd) p.dep_end = adv.depEnd;
        if (adv.arrStart) p.arr_start = adv.arrStart;
        if (adv.arrEnd) p.arr_end = adv.arrEnd;
        if (adv.sortBy) p.sort_by = adv.sortBy;

        return p;
    }, [core, adv, page]);

    async function reload(replace: boolean) {
        setLoading(true);
        setErr("");
        try {
            const params = { ...(replace ? { page: 1 } : {}), ...buildParams() };
            const res = await api.get("/public/products", { params, public: true });
            const data: ApiList = await api.json(res);

            let list: Trip[] = [];
            if (hasProducts(data)) list = data.products;
            else if (hasDataArr(data)) list = data.data;
            else if (Array.isArray(data)) list = data as Trip[];

            list = list.filter((t) => asBool(t.is_active));

            const meta = hasProducts(data) || hasDataArr(data) ? data.meta || {} : {};
            const serverPaged =
                typeof (meta as any).current_page !== "undefined" ||
                typeof (meta as any).last_page !== "undefined";

            setHasServerPaging(serverPaged);

            if (serverPaged) {
                const cur = Number((meta as any).current_page || 1);
                const lp = (meta as any).last_page != null ? Number((meta as any).last_page) : null;
                setPage(cur);
                setLastPage(lp);
                setRows(replace ? list : [...rows, ...list]);
            } else {
                if (replace) {
                    store.current = list;
                    setRows(list.slice(0, pageSize));
                    setPage(1);
                    setLastPage(Math.max(1, Math.ceil(list.length / pageSize)));
                } else {
                    const next = Math.min((page + 1) * pageSize, store.current.length);
                    setRows(store.current.slice(0, next));
                    setPage((p) => p + 1);
                }
            }
        } catch (e: any) {
            setErr(e?.message || "Seferler alınamadı.");
        } finally {
            setLoading(false);
        }
    }

    // Client-side filter/sort
    const filtered = useMemo(() => {
        const list = rows.slice();

        const hhmm = (d?: Date | null) =>
            d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
        const inRange = (v: string, s?: string, e?: string) =>
            (!s && !e) || (!!v && (!s || v >= s) && (!e || v <= e));

        let out = list.filter((t) => {
            if (core.from && t.terminal_from !== core.from) return false;
            if (core.to && t.terminal_to !== core.to) return false;
            if (core.date && !String(t.departure_time || "").startsWith(core.date)) return false;

            const d = toDate(t.departure_time);
            const a = toDate(t.arrival_time || "");
            if (!inRange(hhmm(d), adv.depStart, adv.depEnd)) return false;
            if (!inRange(hhmm(a), adv.arrStart, adv.arrEnd)) return false;

            const p = priceNum(t.cost);
            if (adv.minPrice && p < Number(adv.minPrice)) return false;
            if (adv.maxPrice && p > Number(adv.maxPrice)) return false;

            const layout = (t.bus_type || t.seat_map?.layout || "") as string;
            if (adv.busLayout && layout !== adv.busLayout) return false;

            if (adv.company && t.company_name !== adv.company) return false;

            return true;
        });

        if (adv.sortBy) {
            out.sort((a, b) => {
                if (adv.sortBy === "price_asc") return priceNum(a.cost) - priceNum(b.cost);
                if (adv.sortBy === "price_desc") return priceNum(b.cost) - priceNum(a.cost);
                if (adv.sortBy === "time_asc")
                    return (toDate(a.departure_time)?.getTime() || 0) - (toDate(b.departure_time)?.getTime() || 0);
                if (adv.sortBy === "time_desc")
                    return (toDate(b.departure_time)?.getTime() || 0) - (toDate(a.departure_time)?.getTime() || 0);
                return 0;
            });
        }
        return out;
    }, [rows, core, adv]);

    // "closing soon" flags
    const closingSoon = useMemo(() => {
        const now = Date.now();
        const cutoff = 60 * 60 * 1000;
        const s = new Set<number>();
        for (const r of filtered) {
            const d = toDate(r.departure_time);
            if (!d) continue;
            const diff = d.getTime() - now;
            if (diff > 0 && diff <= cutoff) s.add(r.id);
        }
        return s;
    }, [filtered]);

    // Date shift (±1)
    const shift = async (delta: number) => {
        if (!core.date) return;
        const base = new Date(core.date + "T00:00:00");
        base.setDate(base.getDate() + delta);
        const nextDate = base.toISOString().slice(0, 10);
        setCore((s) => ({ ...s, date: nextDate }));
        setRows([]);
        setPage(1);
        await reload(true);
    };

    // Pagination handlers (void)
    const handlePrev = () => {
        if (page <= 1) return;
        if (hasServerPaging) {
            setRows([]);
            setPage((p) => clamp(p - 1, 1, Math.max(1, lastPage ?? 1)));
            void reload(true);
        } else {
            const next = Math.max((page - 1) * pageSize, pageSize);
            setRows(store.current.slice(0, next));
            setPage((p) => Math.max(1, p - 1));
        }
    };
    const handleNext = () => {
        if (hasServerPaging) {
            setPage((p) => p + 1);
            void reload(false);
        } else {
            const next = Math.min((page + 1) * pageSize, store.current.length);
            setRows(store.current.slice(0, next));
            setPage((p) => p + 1);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-black">
            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-200 blur-3xl opacity-50" />
                <div className="container mx-auto px-4 py-8 md:py-14">
                    <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-indigo-900">
                                Otobüs biletinizi online alın
                            </h1>
                            <p className="mt-4 text-lg text-indigo-900/70">
                                Tek ekranda arayın, karşılaştırın, güvenle satın alın.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <a
                                    href="/auth"
                                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow hover:bg-indigo-700"
                                    aria-label="Giriş Yap veya Üye Ol"
                                >
                                    Giriş Yap / Üye Ol
                                </a>
                                <a
                                    href="#seferler"
                                    className="inline-flex items-center gap-2 bg-white text-indigo-700 px-5 py-3 rounded-xl shadow border border-indigo-100 hover:bg-indigo-50"
                                >
                                    Seferleri Gör
                                </a>
                            </div>
                            {err && (
                                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                                    {err}
                                </div>
                            )}
                        </div>
                        <div className="relative mx-auto">
                            <Image
                                src="/otobus.jpg"
                                alt="Otobüs"
                                width={640}
                                height={420}
                                priority
                                sizes="(max-width:768px) 100vw, 640px"
                                style={{ height: "auto" }}
                            />
                            <div className="absolute -bottom-4 -right-4 bg-white px-4 py-3 rounded-xl shadow border text-sm">
                                <div className="font-semibold">Anında onay</div>
                                <div className="text-gray-500">PNR kodunuzu hemen alın</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Filters */}
            <section className="container mx-auto px-4">
                <TripFilters
                    core={core}
                    onCoreChange={(p) => setCore((s) => ({ ...s, ...p }))}
                    adv={adv}
                    onAdvChange={(p) => setAdv((s) => ({ ...s, ...p }))}
                    terminals={terminals}
                    companies={companies}
                    onRefresh={() => {
                        setRows([]);
                        setPage(1);
                        void reload(true);
                    }}
                    onPrevDay={() => void shift(-1)}
                    onNextDay={() => void shift(1)}
                />
            </section>

            {/* List */}
            <section id="seferler" className="container mx-auto px-4 py-6">
                <TripList
                    rows={filtered}
                    closingSoon={closingSoon}
                    page={page}
                    lastPage={lastPage}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    onBuy={(id) => setBuyId(id)}
                />
            </section>

            {/* Purchase */}
            {buyId !== null && (
                <PurchaseModal id={buyId} onClose={() => setBuyId(null)} onPurchased={() => setBuyId(null)} />
            )}

            <Footer />
        </div>
    );
}
