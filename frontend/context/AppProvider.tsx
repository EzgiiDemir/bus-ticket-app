"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";

/* ------------ Türler ------------ */
type Role = "passenger" | "personnel" | "admin";
type User = {
    id: number;
    name: string;
    email: string;
    role: Role;
    role_status?: "pending" | "active" | "rejected";
    company_id?: number | null;
};
type AuthResp = { status?: boolean; message?: string; token?: string; user?: User };

interface AppProviderType {
    isLoading: boolean;
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (
        name: string,
        email: string,
        password: string,
        password_confirmation: string,
        role: Role,
        company_id?: number
    ) => Promise<void>;
    logout: () => void;
}

/* ------------ Sabitler ------------ */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
axios.defaults.baseURL = API_BASE;

/* ------------ Regex ------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PWD_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\S]{8,}$/;

/* ------------ Yardımcılar ------------ */
const normEmail = (v: string) => v.trim().toLowerCase();
function safeJson<T>(s?: string | null): T | null {
    if (!s) return null;
    try { return JSON.parse(s) as T; } catch { return null; }
}
function pickErrMsg(err: unknown, fallback = "İşlem hatası") {
    const e = err as AxiosError<any>;
    return e?.response?.data?.message || e?.message || fallback;
}

/* ------------ Bağlam ------------ */
const AppContext = createContext<AppProviderType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const isUnmounted = useRef(false);

    const setAuthHeader = (t?: string) => {
        if (t) axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
        else delete axios.defaults.headers.common["Authorization"];
    };

    const goByRole = (u: User) => {
        if (u.role === "admin") router.push("/dashboard/admin");
        else if (u.role === "personnel") router.push("/dashboard/personnel");
        else router.push("/dashboard/passenger");
    };

    /* ---- Interceptorlar ---- */
    useEffect(() => {
        const reqId = axios.interceptors.request.use((config) => {
            // headers objesini yeniden atamadan mutasyona uğrat
            (config.headers as any) = config.headers || {};
            (config.headers as any)["Accept"] = "application/json";
            return config;
        });
        const resId = axios.interceptors.response.use(
            (r) => r,
            (err) => {
                const status = err?.response?.status;
                if (status === 401 || status === 419) {
                    Cookies.remove("authToken");
                    Cookies.remove("authUser");
                    setToken(null);
                    setUser(null);
                    setAuthHeader(undefined);
                    if (typeof window !== "undefined" && !location.pathname.startsWith("/auth")) router.push("/auth");
                }
                return Promise.reject(err);
            }
        );
        return () => {
            axios.interceptors.request.eject(reqId);
            axios.interceptors.response.eject(resId);
        };
    }, [router]);

    /* ---- Başlangıç ---- */
    useEffect(() => {
        (async () => {
            const t = Cookies.get("authToken");
            const u = safeJson<User>(Cookies.get("authUser"));
            if (!t) { setIsLoading(false); return; }

            setToken(t);
            setAuthHeader(t);
            if (u) setUser(u);

            try {
                const { data } = await axios.get<User>("/profile");
                setUser(data);
                Cookies.set("authUser", JSON.stringify(data), { expires: 7, sameSite: "lax" });
            } catch {
                Cookies.remove("authToken");
                Cookies.remove("authUser");
                setToken(null);
                setUser(null);
                setAuthHeader(undefined);
            } finally {
                if (!isUnmounted.current) setIsLoading(false);
            }
        })();
        return () => { isUnmounted.current = true; };
    }, []);

    /* ---- Login ---- */
    const login = async (email: string, password: string) => {
        const em = normEmail(email);
        if (!EMAIL_RE.test(em)) { toast.error("Geçerli e-posta girin."); return; }
        if (!PWD_RE.test(password)) { toast.error("Şifre en az 8 karakter ve harf+rakam içermeli."); return; }

        setIsLoading(true);
        try {
            Cookies.remove("authToken"); Cookies.remove("authUser");
            setAuthHeader(undefined);

            const { data } = await axios.post<AuthResp>("/login", { email: em, password });
            if (!data?.token || !data?.user) { toast.error(data?.message || "Giriş başarısız."); return; }

            if (data.user.role === "personnel" && data.user.role_status === "pending") {
                toast.error("Personel başvurunuz onay bekliyor."); return;
            }

            setToken(data.token);
            setUser(data.user);
            setAuthHeader(data.token);
            Cookies.set("authToken", data.token, { expires: 7, sameSite: "lax" });
            Cookies.set("authUser", JSON.stringify(data.user), { expires: 7, sameSite: "lax" });
            toast.success("Giriş başarılı.");
            goByRole(data.user);
        } catch (err) {
            toast.error(pickErrMsg(err, "Giriş hatası"));
        } finally {
            setIsLoading(false);
        }
    };

    /* ---- Register ---- */
    const register = async (
        name: string,
        email: string,
        password: string,
        password_confirmation: string,
        role: Role,
        company_id?: number
    ) => {
        const nm = (name || "").trim();
        const em = normEmail(email);
        if (nm.length < 2) { toast.error("Ad Soyad en az 2 karakter olmalı."); return; }
        if (!EMAIL_RE.test(em)) { toast.error("Geçerli e-posta girin."); return; }
        if (!PWD_RE.test(password)) { toast.error("Şifre en az 8 karakter ve harf+rakam içermeli."); return; }
        if (password !== password_confirmation) { toast.error("Şifreler eşleşmiyor."); return; }
        if (!["passenger", "personnel", "admin"].includes(role)) { toast.error("Geçerli rol seçin."); return; }
        if (role === "personnel" && !company_id) { toast.error("Personel için firma zorunlu."); return; }

        setIsLoading(true);
        try {
            await axios.post("/register", { name: nm, email: em, password, password_confirmation, role, company_id });

            if (role === "personnel") toast.success("Kayıt alındı. Personel onayı bekleniyor.");
            else toast.success("Kayıt başarılı. Lütfen giriş yapın.");

            router.push("/auth?mode=login");
        } catch (err: any) {
            const payload = err?.response?.data;
            if (err?.response?.status === 422 && payload?.errors) {
                const first = Object.values(payload.errors)[0] as string[] | string;
                const msg = Array.isArray(first) ? first[0] : first;
                toast.error(msg || "Doğrulama hatası.");
            } else if (err?.response?.status === 403 && String(payload?.message || "").includes("Personel")) {
                toast.error("Personel başvurunuz onay bekliyor. Onay sonrası giriş yapın.");
                router.push("/auth?mode=login");
            } else {
                toast.error(pickErrMsg(err, "Kayıt hatası"));
            }
        } finally {
            setIsLoading(false);
        }
    };

    /* ---- Logout ---- */
    const logout = () => {
        setToken(null);
        setUser(null);
        Cookies.remove("authToken");
        Cookies.remove("authUser");
        setAuthHeader(undefined);
        axios.post?.("/logout").catch(() => {});
        toast.success("Çıkış yapıldı.");
        router.push("/auth");
    };

    return (
        <AppContext.Provider value={{ isLoading, user, token, login, register, logout }}>
            {children}
            {isLoading && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
            )}
        </AppContext.Provider>
    );
}

export const myAppHook = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp must be used within <AppProvider>");
    return ctx;
};
