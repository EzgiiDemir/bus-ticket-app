"use client";

import React, { useEffect, useMemo, useState, FormEvent, ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { myAppHook } from "../../../context/AppProvider";
import { Bus, Eye, EyeOff } from "lucide-react";
import { BASE } from "./../lib/api";

type Role = "passenger" | "personnel";
type FormData = {
    name?: string;
    email: string;
    password: string;
    password_confirmation?: string;
    role: Role;
    company_id?: number;
};

type Errors = Partial<Record<keyof FormData | "base", string>>;

const EMAIL_RE =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
// En az 8 karakter, en az bir harf ve bir rakam
const PWD_RE =
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\S]{8,}$/;

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

    const [errors, setErrors] = useState<Errors>({});
    const [companies, setCompanies] = useState<{ id: number; name: string; code: string }[]>([]);

    useEffect(() => {
        fetch(`${BASE}/public/companies`)
            .then((r) => r.json())
            .then(setCompanies)
            .catch(() => {});
    }, []);

    const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target as any;
        const v =
            name === "company_id" ? (value ? Number(value) : undefined) : name === "email" ? value.trim() : value;
        setFormData((s) => ({ ...s, [name]: v }));
        // Alan bazlı anlık doğrulama
        setErrors((prev) => {
            const next = { ...prev };
            delete next[name as keyof Errors];
            return next;
        });
    };

    const validate = (data: FormData, isLoginMode: boolean): Errors => {
        const e: Errors = {};
        if (!isLoginMode) {
            if (!data.name || data.name.trim().length < 2) e.name = "Ad Soyad en az 2 karakter olmalı.";
            if (data.role !== "passenger" && data.role !== "personnel") e.role = "Geçerli bir rol seçin.";
            if (data.role === "personnel" && !data.company_id) e.company_id = "Firma seçimi zorunludur.";
            if (!data.password_confirmation) e.password_confirmation = "Şifre tekrar zorunlu.";
            if (data.password && data.password_confirmation && data.password !== data.password_confirmation)
                e.password_confirmation = "Şifreler eşleşmiyor.";
        }
        if (!data.email || !EMAIL_RE.test(data.email)) e.email = "Geçerli bir e-posta girin.";
        if (!data.password || !PWD_RE.test(data.password))
            e.password = "Şifre en az 8 karakter olmalı ve en az bir harf ile bir rakam içermeli.";
        return e;
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed: FormData = {
            ...formData,
            name: formData.name?.trim(),
            email: formData.email.trim().toLowerCase(),
        };
        const v = validate(trimmed, isLogin);
        setErrors(v);
        if (Object.keys(v).length > 0) return;

        try {
            if (isLogin) {
                await login(trimmed.email, trimmed.password);
                return;
            }
            await register(
                trimmed.name ?? "",
                trimmed.email,
                trimmed.password,
                trimmed.password_confirmation ?? "",
                trimmed.role,
                trimmed.company_id
            );
            setIsLogin(true);
        } catch (err: any) {
            // Laravel 422 formatı: { message, errors: { field: [msg] } }
            const srv: Errors = {};
            const payload = err?.response?.data;
            if (payload?.errors && typeof payload.errors === "object") {
                Object.entries(payload.errors).forEach(([k, msgs]) => {
                    const first = Array.isArray(msgs) ? msgs[0] : String(msgs);
                    srv[k as keyof Errors] = first;
                });
            } else if (payload?.message) {
                srv.base = payload.message;
            } else {
                srv.base = "İşlem sırasında beklenmeyen bir hata oluştu.";
            }
            setErrors(srv);
        }
    };

    const fieldCls = (hasErr: boolean) =>
        `w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 ${
            hasErr ? "border-red-500" : "border-gray-300"
        }`;

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center text-indigo-900">
            <div className="container mx-auto px-4">
                <div className="mx-auto grid max-w-5xl grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="relative hidden lg:block">
                        <div className="sticky top-10 rounded-3xl border bg-white/80 backdrop-blur p-8 shadow-xl">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow">
                                <Bus size={22} />
                            </div>
                            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-indigo-900">BusX’e hoş geldiniz</h1>
                            <p className="mt-3 text-indigo-900/70 leading-relaxed">
                                Türkiye’nin dört bir yanındaki otobüs seferlerini keşfedin, hesabınızı oluşturun ve biletinizi
                                saniyeler içinde satın alın. Güvenli ödeme, anında PNR.
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
                                    onClick={() => {
                                        setErrors({});
                                        setIsLogin(true);
                                    }}
                                    type="button"
                                >
                                    Giriş Yap
                                </button>
                                <button
                                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                        !isLogin ? "bg-white text-indigo-700 shadow" : "text-indigo-900/70 hover:text-indigo-900"
                                    }`}
                                    onClick={() => {
                                        setErrors({});
                                        setIsLogin(false);
                                    }}
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
                                    {isLogin ? "E-posta ve şifrenizle devam edin." : "Bilgilerinizi girin, rolünüze göre yönlendirelim."}
                                </p>
                            </div>

                            {/* HTML5 doğrulamaları devrede: pattern, required, minLength. */}
                            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                                {errors.base && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        {errors.base}
                                    </div>
                                )}

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
                                                minLength={2}
                                                required
                                                aria-invalid={!!errors.name}
                                                aria-describedby="name-err"
                                                className={fieldCls(!!errors.name)}
                                            />
                                            {errors.name && (
                                                <p id="name-err" className="mt-1 text-xs text-red-600">
                                                    {errors.name}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-indigo-900 mb-1">Rol</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData((s) => ({ ...s, role: "passenger", company_id: undefined }))}
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
                                            {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role}</p>}
                                        </div>
                                    </>
                                )}

                                {!isLogin && formData.role === "personnel" && (
                                    <div>
                                        <label className="block text-sm font-medium text-indigo-900 mb-1">Bağlı Olduğunuz Firma</label>
                                        <select
                                            name="company_id"
                                            value={formData.company_id ?? ""}
                                            onChange={onChange}
                                            required
                                            aria-invalid={!!errors.company_id}
                                            aria-describedby="company-err"
                                            className={fieldCls(!!errors.company_id)}
                                        >
                                            <option value="">Seçiniz</option>
                                            {companies.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} ({c.code})
                                                </option>
                                            ))}
                                        </select>
                                        {errors.company_id && (
                                            <p id="company-err" className="mt-1 text-xs text-red-600">
                                                {errors.company_id}
                                            </p>
                                        )}
                                    </div>
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
                                        required
                                        pattern={EMAIL_RE.source}
                                        aria-invalid={!!errors.email}
                                        aria-describedby="email-err"
                                        className={fieldCls(!!errors.email)}
                                    />
                                    {errors.email && (
                                        <p id="email-err" className="mt-1 text-xs text-red-600">
                                            {errors.email}
                                        </p>
                                    )}
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
                                            required
                                            pattern={PWD_RE.source}
                                            aria-invalid={!!errors.password}
                                            aria-describedby="pwd-err"
                                            className={`${fieldCls(!!errors.password)} pr-10`}
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
                                    {errors.password && (
                                        <p id="pwd-err" className="mt-1 text-xs text-red-600">
                                            {errors.password}
                                        </p>
                                    )}
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
                                                required
                                                aria-invalid={!!errors.password_confirmation}
                                                aria-describedby="pwd2-err"
                                                className={`${fieldCls(!!errors.password_confirmation)} pr-10`}
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
                                        {errors.password_confirmation && (
                                            <p id="pwd2-err" className="mt-1 text-xs text-red-600">
                                                {errors.password_confirmation}
                                            </p>
                                        )}
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
                                            onClick={() => {
                                                setErrors({});
                                                setIsLogin(false);
                                            }}
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
                                            onClick={() => {
                                                setErrors({});
                                                setIsLogin(true);
                                            }}
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
