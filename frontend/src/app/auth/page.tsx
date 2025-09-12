"use client";

import React, { useEffect, useMemo, useState, FormEvent, ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { myAppHook } from "../../../context/AppProvider";
import { Bus, Eye, EyeOff, User2, Shield } from "lucide-react";

type Role = "passenger" | "personnel";
type FormData = {
    name?: string;
    email: string;
    password: string;
    password_confirmation?: string;
    role: Role;
};

export default function Auth() {
    const { login, register, isLoading } = myAppHook() as any;
    const params = useSearchParams();
    const initialIsLogin = useMemo(() => params.get("mode") !== "register", [params]);

    const [isLogin, setIsLogin] = useState<boolean>(initialIsLogin);
    useEffect(() => setIsLogin(initialIsLogin), [initialIsLogin]);

    const [showPwd, setShowPwd] = useState(false);
    const [showPwd2, setShowPwd2] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        role: "passenger",
    });

    const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target as any;
        setFormData((s) => ({ ...s, [name]: value }));
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isLogin) {
            await login(formData.email, formData.password);
            return;
        }
        await register(
            formData.name ?? "",
            formData.email,
            formData.password,
            formData.password_confirmation ?? "",
            formData.role
        );
        setIsLogin(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center">
            <div className="container mx-auto px-4">
                <div className="mx-auto grid max-w-5xl grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="relative hidden lg:block">
                        <div className="sticky top-10 rounded-3xl border bg-white/80 backdrop-blur p-8 shadow-xl">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow">
                                <Bus size={22} />
                            </div>
                            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-indigo-900">
                                BusX’e hoş geldiniz
                            </h1>
                            <p className="mt-3 text-indigo-900/70 leading-relaxed">
                                Türkiye’nin dört bir yanındaki otobüs seferlerini keşfedin, hesabınızı oluşturun ve
                                biletinizi saniyeler içinde satın alın. Güvenli ödeme, anında PNR.
                            </p>

                            <ul className="mt-6 space-y-3 text-sm text-indigo-900/80">
                                <li className="flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    Kolay ve hızlı satın alma
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    Geniş sefer ağı, gerçek zamanlı liste
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    Güvenli ödeme ve PNR takibi
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="lg:pl-4">
                        <div className="rounded-3xl border bg-white/80 backdrop-blur p-6 md:p-8 shadow-xl">
                            <div className="flex items-center gap-2 rounded-2xl bg-indigo-50 p-1">
                                <button
                                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                        isLogin ? "bg-white text-indigo-700 shadow" : "text-indigo-900/70 hover:text-indigo-900"
                                    }`}
                                    onClick={() => setIsLogin(true)}
                                    type="button"
                                >
                                    Giriş Yap
                                </button>
                                <button
                                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                        !isLogin ? "bg-white text-indigo-700 shadow" : "text-indigo-900/70 hover:text-indigo-900"
                                    }`}
                                    onClick={() => setIsLogin(false)}
                                    type="button"
                                >
                                    Kayıt Ol
                                </button>
                            </div>

                            <div className="mt-6">
                                <h2 className="text-xl font-bold text-indigo-900">
                                    {isLogin ? "Hesabınıza giriş yapın" : "Yeni hesap oluşturun"}
                                </h2>
                                <p className="text-sm text-indigo-900/60 mt-1">
                                    {isLogin
                                        ? "E-postanız ve şifrenizle devam edin."
                                        : "Bilgilerinizi doldurun; rolünüze göre panelinize yönlendirelim."}
                                </p>
                            </div>

                            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                                {!isLogin && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-indigo-900 mb-1">Ad Soyad</label>
                                            <input
                                                name="name"
                                                type="text"
                                                value={formData.name}
                                                onChange={onChange}
                                                placeholder="Örn. Ezgi Demir"
                                                autoComplete="name"
                                                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-indigo-900 mb-1">Rol</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData((s) => ({ ...s, role: "passenger" }))}
                                                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                                                        formData.role === "passenger"
                                                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                            : "hover:bg-gray-50 text-indigo-900/80"
                                                    }`}
                                                >
                                                    Yolcu
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData((s) => ({ ...s, role: "personnel" }))}
                                                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                                                        formData.role === "personnel"
                                                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                            : "hover:bg-gray-50 text-indigo-900/80"
                                                    }`}
                                                >
                                                    Personel
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-indigo-900 mb-1">E-posta</label>
                                    <input
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={onChange}
                                        placeholder="ornek@eposta.com"
                                        autoComplete="email"
                                        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-indigo-900 mb-1">Şifre</label>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPwd ? "text" : "password"}
                                            value={formData.password}
                                            onChange={onChange}
                                            placeholder="••••••••"
                                            autoComplete={isLogin ? "current-password" : "new-password"}
                                            className="w-full rounded-xl border px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-indigo-200"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPwd((s) => !s)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100"
                                            aria-label="Şifreyi göster/gizle"
                                        >
                                            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {!isLogin && (
                                    <div>
                                        <label className="block text-sm font-medium text-indigo-900 mb-1">Şifre (Tekrar)</label>
                                        <div className="relative">
                                            <input
                                                name="password_confirmation"
                                                type={showPwd2 ? "text" : "password"}
                                                value={formData.password_confirmation}
                                                onChange={onChange}
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                className="w-full rounded-xl border px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-indigo-200"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPwd2((s) => !s)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100"
                                                aria-label="Şifreyi göster/gizle"
                                            >
                                                {showPwd2 ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full rounded-xl bg-indigo-600 text-white font-semibold py-3 hover:bg-indigo-700 disabled:opacity-60"
                                >
                                    {isLoading ? "İşleniyor..." : isLogin ? "Giriş Yap" : "Kayıt Ol"}
                                </button>
                            </form>

                            <div className="mt-6 text-center text-sm">
                                {isLogin ? (
                                    <p className="text-indigo-900/70">
                                        Hesabınız yok mu?{" "}
                                        <button
                                            type="button"
                                            className="font-semibold text-indigo-700 hover:underline"
                                            onClick={() => setIsLogin(false)}
                                        >
                                            Kayıt Ol
                                        </button>
                                    </p>
                                ) : (
                                    <p className="text-indigo-900/70">
                                        Zaten üye misiniz?{" "}
                                        <button
                                            type="button"
                                            className="font-semibold text-indigo-700 hover:underline"
                                            onClick={() => setIsLogin(true)}
                                        >
                                            Giriş Yap
                                        </button>
                                    </p>
                                )}
                            </div>
                        </div>

                        <p className="mt-6 text-center text-xs text-indigo-900/50">
                            Bu site reCAPTCHA ile korunmuyor; verileriniz uygulama politikalarımıza göre işlenir.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
