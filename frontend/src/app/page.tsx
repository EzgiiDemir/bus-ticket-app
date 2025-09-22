"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import TripFilters, { CoreFilters, AdvancedFilters, Terminal, Company } from "@/components/TripFilters";
import TripList from "@/components/TripList";
import Footer from "@/components/Footer";
import PurchaseModal from "@/components/PurchaseModal";
import { api } from "./lib/api";

type Trip = {
    id:number; trip?:string; company_name?:string; terminal_from:string; terminal_to:string;
    departure_time:string; arrival_time?:string|null; cost:number|string; is_active:boolean|number;
    bus_type?:string|null; seat_map?:{layout?:"2+1"|"2+2"; rows?:number}|null;
};
type ApiList = { products:Trip[]; meta?:{ current_page?:number; last_page?:number } } | any;

const toDate=(s?:string)=>{ if(!s) return null; const n=s.includes("T")?s:s.replace(" ","T"); const d=new Date(n); return isNaN(d.getTime())?null:d; };

export default function HomePage(){
    const [core,setCore] = useState<CoreFilters>({ tripType:"oneway", from:"", to:"", date:"" });
    const [adv,setAdv] = useState<AdvancedFilters>({ sortBy:"" });

    const [rows,setRows] = useState<Trip[]>([]);
    const [page,setPage] = useState(1);
    const [lastPage,setLastPage] = useState<number|null>(null);
    const [hasServerPaging,setHasServerPaging] = useState(false);
    const [terminals,setTerminals] = useState<Terminal[]>([]);
    const [companies,setCompanies] = useState<Company[]>([]);
    const [buyId,setBuyId] = useState<number|null>(null);

    const pageSize=10;
    const store=useRef<Trip[]>([]);

    useEffect(()=>{ (async()=>{
        const [tRes,cRes] = await Promise.all([
            api.get("/public/terminals", { public:true }),
            api.get("/public/companies", { public:true }),
        ]);
        setTerminals(await api.json<Terminal[]>(tRes));
        setCompanies(await api.json<Company[]>(cRes));
        await reload(true);
    })().catch(()=>{}); },[]);

    async function reload(replace:boolean){
        const params:any = { page: replace?1:page, per_page: pageSize, from: core.from, to: core.to, date: core.date };
        const res = await api.get("/public/products", { params, public:true });
        const data:ApiList = await api.json(res);
        const list:Trip[] = (data?.products||[]).filter((t: { is_active: any; })=>Boolean(t.is_active));
        const meta = data?.meta||{};
        const serverPaged = meta.current_page!==undefined || meta.last_page!==undefined;
        setHasServerPaging(serverPaged);

        if(serverPaged){
            setPage(meta.current_page || 1);
            setLastPage(meta.last_page ?? null);
            setRows(replace? list : [...rows, ...list]);
        }else{
            if(replace){ store.current=list; setRows(list.slice(0,pageSize)); setPage(1); setLastPage(Math.ceil(list.length/pageSize)); }
            else{ const next = Math.min((page+1)*pageSize, store.current.length); setRows(store.current.slice(0,next)); setPage(p=>p+1); }
        }
    }

    const filtered = useMemo(()=>{
        const list = rows.slice();
        const hhmm=(d?:Date|null)=> d?`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`:"";
        const inRange=(v:string,s?:string,e?:string)=> (!s && !e) || (!!v && (!s || v>=s) && (!e || v<=e));
        const price=(v:any)=> Number(String(v).replace(/[^\d.,]/g,"").replace(",",".")||0);

        let out = list.filter(t=>{
            if(core.from && t.terminal_from!==core.from) return false;
            if(core.to && t.terminal_to!==core.to) return false;
            if(core.date && !String(t.departure_time||"").startsWith(core.date)) return false;

            const d=toDate(t.departure_time); const a=toDate(t.arrival_time||"");
            if(!inRange(hhmm(d||undefined), adv.depStart, adv.depEnd)) return false;
            if(!inRange(hhmm(a||undefined), adv.arrStart, adv.arrEnd)) return false;

            const p=price(t.cost);
            if(adv.minPrice && p<Number(adv.minPrice)) return false;
            if(adv.maxPrice && p>Number(adv.maxPrice)) return false;

            const layout=(t.bus_type||t.seat_map?.layout||"") as string;
            if(adv.busLayout && layout!==adv.busLayout) return false;

            if(adv.company && t.company_name!==adv.company) return false;
            return true;
        });

        if(adv.sortBy){
            out.sort((a,b)=>{
                if(adv.sortBy==="price_asc") return Number(a.cost)-Number(b.cost);
                if(adv.sortBy==="price_desc") return Number(b.cost)-Number(a.cost);
                if(adv.sortBy==="time_asc") return (toDate(a.departure_time)?.getTime()||0)-(toDate(b.departure_time)?.getTime()||0);
                if(adv.sortBy==="time_desc") return (toDate(b.departure_time)?.getTime()||0)-(toDate(a.departure_time)?.getTime()||0);
                return 0;
            });
        }
        return out;
    },[rows,core,adv]);

    const closingSoon = useMemo(()=>{
        const now=Date.now(), cutoff=60*60*1000;
        const s=new Set<number>();
        for(const r of filtered){ const d=toDate(r.departure_time); if(!d) continue; const diff=d.getTime()-now; if(diff>0 && diff<=cutoff) s.add(r.id); }
        return s;
    },[filtered]);

    const shift = async (delta:number)=>{
        if(!core.date) return;
        const base = new Date(core.date+"T00:00:00"); base.setDate(base.getDate()+delta);
        setCore({...core, date: base.toISOString().slice(0,10)});
        setRows([]); setPage(1); await reload(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-black">
            <section className="relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-200 blur-3xl opacity-50" />
                <div className="container mx-auto px-4 py-8 md:py-14">
                    <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-indigo-900">Otobüs biletinizi online alın</h1>
                            <p className="mt-4 text-lg text-indigo-900/70">Tek ekranda arayın, karşılaştırın, güvenle satın alın.</p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <a href="/auth" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow hover:bg-indigo-700">Giriş Yap / Üye Ol</a>
                                <a href="#seferler" className="inline-flex items-center gap-2 bg-white text-indigo-700 px-5 py-3 rounded-xl shadow border border-indigo-100 hover:bg-indigo-50">Seferleri Gör</a>
                            </div>
                        </div>
                        <div className="relative mx-auto">
                            <Image src="/otobus.jpg" alt="Otobüs" width={640} height={420} priority sizes="(max-width:768px) 100vw, 640px" style={{height:"auto"}} />
                            <div className="absolute -bottom-4 -right-4 bg-white px-4 py-3 rounded-xl shadow border text-sm">
                                <div className="font-semibold">Anında onay</div>
                                <div className="text-gray-500">PNR kodunuzu hemen alın</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-4">
                <TripFilters
                    core={core} onCoreChange={p=>setCore({...core,...p})}
                    adv={adv}  onAdvChange={p=>setAdv({...adv,...p})}
                    terminals={terminals} companies={companies}
                    onRefresh={()=>{ setRows([]); setPage(1); void reload(true); }}
                    onPrevDay={()=>void shift(-1)} onNextDay={()=>void shift(1)}
                />
            </section>

            <section id="seferler" className="container mx-auto px-4 py-6">
                <TripList
                    rows={filtered} closingSoon={closingSoon} page={page} lastPage={lastPage}
                    onPrev={()=>{
                        if(page<=1) return;
                        if(hasServerPaging){ setRows([]); setPage(p=>p-1); void reload(true); }
                        else{ const next=(page-1)*pageSize; setRows(store.current.slice(0,next)); setPage(p=>Math.max(1,p-1)); }
                    }}
                    onNext={()=>{
                        if(hasServerPaging){ setPage(p=>p+1); void reload(false); }
                        else{ const next = Math.min((page+1)*pageSize, store.current.length); setRows(store.current.slice(0,next)); setPage(p=>p+1); }
                    }}
                    onBuy={(id)=>setBuyId(id)}
                />
            </section>

            {buyId!==null && <PurchaseModal id={buyId} onClose={()=>setBuyId(null)} onPurchased={()=>setBuyId(null)} />}

            <Footer/>
        </div>
    );
}
