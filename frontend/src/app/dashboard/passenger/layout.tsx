'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {Bus, LayoutDashboard, ClipboardList, Search, Users, X, Menu} from 'lucide-react';

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname();
    const [open, setOpen] = useState(false);

    const Item = ({ href, label, Icon }: any) => (
        <Link
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border ${
                path === href ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-gray-50 text-indigo-900/80'
            }`}
        >
            <Icon size={18} /> {label}
        </Link>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Topbar (mobile) */}
            <div className="flex items-center justify-between lg:hidden bg-white border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="h-9 w-9 grid place-items-center rounded-xl bg-indigo-600 text-white">
                        <Bus size={18} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-indigo-900">Yolcu Paneli</div>
                        <div className="text-xs text-indigo-900/60">Kişisel Alan</div>
                    </div>
                </div>
                <button onClick={()=>setOpen(!open)} className="p-2 rounded-md  text-indigo-900/80">
                    {open? <X size={20}/> : <Menu size={20}/>}
                </button>
            </div>

            <div className="grid lg:grid-cols-[260px_1fr]">
                {/* Sidebar */}
                <aside className={`border-r bg-white p-4 lg:min-h-screen ${open ? 'block' : 'hidden lg:block'}`}>
                    <div className="hidden lg:flex items-center gap-2 mb-4">
                        <div className="h-9 w-9 grid place-items-center rounded-xl bg-indigo-600 text-white">
                            <Bus size={18} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-indigo-900">Yolcu Paneli</div>
                            <div className="text-xs text-indigo-900/60">Kişisel Alan</div>
                        </div>
                    </div>
                    <nav className="space-y-2">
                        <Item href="/dashboard/passenger" label="Genel Bakış" Icon={LayoutDashboard} />
                        <Item href="/dashboard/passenger/trips" label="Sefer Ara" Icon={Search} />
                        <Item href="/dashboard/passenger/orders" label="Siparişlerim" Icon={ClipboardList} />
                        <Item href="/dashboard/passenger/profile" label="Profilim" Icon={Users} />

                    </nav>
                </aside>

                {/* Content */}
                <main className="p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
