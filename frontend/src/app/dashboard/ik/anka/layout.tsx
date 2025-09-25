// app/dashboard/ik/anka/layout.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bus, LayoutDashboard, Users, Building2, CheckCircle2, Menu, X, User, type LucideIcon } from 'lucide-react';
import { myAppHook } from '../../../../../context/AppProvider';

type NavItem = { href: string; label: string; Icon: LucideIcon };

const NAV: NavItem[] = [
    { href: '/dashboard/ik/anka', label: 'Dashboard', Icon: LayoutDashboard },
    { href: '/dashboard/ik/anka/approvals', label: 'Onaylar', Icon: CheckCircle2 },
    { href: '/dashboard/ik/anka/Company', label: 'Firmam', Icon: Building2 },
    { href: '/dashboard/ik/anka/trips', label: 'Seferler', Icon: Bus },
    { href: '/dashboard/ik/anka/customers', label: 'Müşteriler', Icon: Users },
    { href: '/dashboard/ik/anka/personnel', label: 'Personeller', Icon: Users },
    { href: '/dashboard/ik/anka/account', label: 'Hesabım', Icon: User },
];

function Guard({ children }: { children: React.ReactNode }) {
    const { isLoading, token, user } = myAppHook() as any;
    const isAnka =
        (user?.company?.code || '').toLowerCase() === 'anka' ||
        /(^|\s)anka(\s|$)/i.test(user?.company?.name || '');

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;
    if (user?.role !== 'company_approver') return <div className="p-6">Yetkisiz.</div>;
    if (!isAnka) return <div className="p-6">Bu bölüm Anka İK içindir.</div>;
    return <>{children}</>;
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const isActive = (href: string) => path === href || path.startsWith(href + '/');

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const Item = ({ href, label, Icon }: NavItem) => (
        <Link
            href={href}
            onClick={() => setOpen(false)}
            aria-current={isActive(href) ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border transition
        ${isActive(href) ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-gray-50 text-indigo-900/80'}`}
        >
            <Icon size={18} /> {label}
        </Link>
    );

    return (
        <Guard>
            <div className="min-h-screen bg-gray-50">
                {/* Mobile navbar */}
                <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b bg-white">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 grid place-items-center rounded-xl bg-indigo-600 text-white"><Bus size={18} /></div>
                        <div className="text-sm font-semibold text-indigo-900">Anka Paneli</div>
                    </div>
                    <button
                        aria-label="Menüyü aç/kapat"
                        aria-expanded={open}
                        aria-controls="mobile-sidebar"
                        onClick={() => setOpen(o => !o)}
                        className="p-2 rounded-lg text-indigo-900"
                    >
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </header>

                <div className="grid lg:grid-cols-[260px_1fr]">
                    {/* Sidebar desktop */}
                    <aside className="hidden lg:block border-r bg-white lg:minh-screen">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-9 w-9 grid place-items-center rounded-xl bg-indigo-600 text-white"><Bus size={18} /></div>
                                <div>
                                    <div className="text-sm font-semibold text-indigo-900">Anka Paneli</div>
                                    <div className="text-xs text-indigo-900/60">Şirket verileri</div>
                                </div>
                            </div>
                            <nav className="space-y-2">{NAV.map(i => <Item key={i.href} {...i} />)}</nav>
                        </div>
                    </aside>

                    {/* Content */}
                    <main className="p-4 lg:p-6">{children}</main>
                </div>

                {/* Mobile slide-in */}
                <div className={`lg:hidden ${open ? 'fixed inset-0 z-50' : 'hidden'}`} role="dialog" aria-modal="true">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
                    <div
                        id="mobile-sidebar"
                        className={`absolute inset-y-0 left-0 w-72 bg-white border-r p-4 transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="h-9 w-9 grid place-items-center rounded-xl bg-indigo-600 text-white"><Bus size={18} /></div>
                                <div className="text-sm font-semibold text-indigo-900">Anka Paneli</div>
                            </div>
                            <button className="p-2 rounded-lg border" onClick={() => setOpen(false)} aria-label="Menüyü kapat">
                                <X size={18} />
                            </button>
                        </div>
                        <nav className="space-y-2">{NAV.map(i => <Item key={i.href} {...i} />)}</nav>
                    </div>
                </div>
            </div>
        </Guard>
    );
}
