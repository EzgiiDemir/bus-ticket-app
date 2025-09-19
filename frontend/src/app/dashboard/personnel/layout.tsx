'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bus, LayoutDashboard, ClipboardList, Users, Building2 } from 'lucide-react';


export default function PersonnelLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname();
    const Item = ({ href, label, Icon }: any) => (
        <Link href={href} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border
${path===href? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-gray-50 text-indigo-900/80'}`}>
            <Icon size={18}/> {label}
        </Link>
    );
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="grid lg:grid-cols-[260px_1fr]">
                <aside className="border-r bg-white p-4 lg:min-h-screen">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-9 w-9 grid place-items-center rounded-xl bg-indigo-600 text-white"><Bus size={18}/></div>
                        <div>
                            <div className="text-sm font-semibold text-indigo-900">Personel Paneli</div>
                            <div className="text-xs text-indigo-900/60">Company Scoped</div>
                        </div>
                    </div>
                    <nav className="space-y-2">
                        <Item href="/dashboard/personnel" label="Genel Bakış" Icon={LayoutDashboard} />
                        <Item href="/dashboard/personnel/trips" label="Seferler" Icon={Bus} />
                        <Item href="/dashboard/personnel/orders" label="Siparişler" Icon={ClipboardList} />
                        <Item href="/dashboard/personnel/customers" label="Müşteriler" Icon={Users} />
                        <Item href="/dashboard/personnel/company" label="Şirket" Icon={Building2} />
                    </nav>
                </aside>
                <main className="p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}