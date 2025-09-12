"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bus, Menu, X, LogOut, User2, Ticket } from "lucide-react";
import { myAppHook } from "../context/AppProvider";

const Navbar: React.FC = () => {
    const { user, token, logout } = myAppHook() as any;
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const dashboardHref = useMemo(() => {
        if (!user) return "/auth";
        return user.role === "personnel" ? "/dashboard/personnel" : "/dashboard/passenger";
    }, [user]);

    const NavLink = ({
                         href,
                         children,
                         onClick,
                     }: {
        href: string;
        children: React.ReactNode;
        onClick?: () => void;
    }) => {
        const active =
            href === "/"
                ? pathname === "/"
                : pathname.startsWith(href.replace("/#seferler", "/"));
        return (
            <Link
                href={href}
                onClick={onClick}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "text-indigo-700 bg-indigo-50" : "text-indigo-900 hover:bg-indigo-50"
                }`}
            >
                {children}
            </Link>
        );
    };

    const AuthButtons = () =>
        token ? (
            <div className="flex items-center gap-2">
                <Link
                    href={dashboardHref}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={() => setOpen(false)}
                >
                    <Ticket size={18} />
                    Panel
                </Link>
                <button
                    onClick={() => {
                        setOpen(false);
                        logout();
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-indigo-900 hover:bg-indigo-50"
                >
                    <LogOut size={18} />
                    Çıkış
                </button>
            </div>
        ) : (
            <div className="flex items-center gap-2">
                <Link
                    href="/auth?mode=login"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={() => setOpen(false)}
                >
                    <User2 size={18} />
                    Giriş Yap
                </Link>

            </div>
        );

    return (
        <header className="sticky top-0 z-40">
            <nav className="border-b bg-white backdrop-blur supports-[backdrop-filter]:bg-white">
                <div className="container mx-auto px-4">
                    <div className="h-16 flex items-center justify-between">
                        {/* Brand */}
                        <Link href="/" className="flex items-center gap-2 group">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow">
                <Bus size={18} />
              </span>
                            <span className="text-lg font-extrabold tracking-tight text-indigo-900 group-hover:text-indigo-700">
                BusX
              </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-2">
                            <NavLink href="/">Ana Sayfa</NavLink>
                            <NavLink href="/#seferler">Seferler</NavLink>
                        </div>

                        <div className="hidden md:flex">
                            <AuthButtons />
                        </div>

                        <button
                            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl text-indigo-900 hover:bg-indigo-50"
                            aria-label="Menüyü aç/kapat"
                            onClick={() => setOpen((s) => !s)}
                        >
                            {open ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>

                {open && (
                    <div className="md:hidden border-t bg-white">
                        <div className="container mx-auto px-4 py-3 flex flex-col gap-2">
                            <NavLink href="/" onClick={() => setOpen(false)}>
                                Ana Sayfa
                            </NavLink>
                            <NavLink href="/#seferler" onClick={() => setOpen(false)}>
                                Seferler
                            </NavLink>

                            <div className="pt-2 border-t">
                                <AuthButtons />
                            </div>
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
};

export default Navbar;
