'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bus, LayoutDashboard, ClipboardList, Users, Building2, CheckCircle2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
                            <div className="text-sm font-semibold text-indigo-900">Admin Paneli</div>
                            <div className="text-xs text-indigo-900/60">Tüm veriler</div>
                        </div>
                    </div>
                    <nav className="space-y-2">
                        <Item href="/dashboard/admin" label="Dashboard" Icon={LayoutDashboard} />
                        <Item href="/dashboard/admin/personnel" label="Personnel" Icon={Users} />
                        <Item href="/dashboard/admin/companies" label="Companies" Icon={Building2} />
                        <Item href="/dashboard/admin/customers" label="Customers" Icon={Users} />
                        <Item href="/dashboard/admin/trips" label="Trips" Icon={Bus} />
                        <Item href="/dashboard/admin/approvals" label="Approvals" Icon={CheckCircle2} />
                    </nav>
                </aside>
                <main className="p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
