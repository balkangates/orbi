"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type FormState } from "@/lib/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-800">Giriş Yap</h1>
        <p className="mt-1 text-sm text-slate-500">Orbi City hesabınıza erişin.</p>
        <form action={action} className="mt-6 space-y-4">
          <input
            name="email"
            type="email"
            placeholder="E-posta"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          <input
            name="password"
            type="password"
            placeholder="Şifre"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          {state.error && <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{state.error}</div>}
          <button
            disabled={pending}
            className="w-full rounded-lg bg-[#003580] px-4 py-2.5 font-semibold text-white hover:bg-[#00224f] disabled:opacity-60"
          >
            {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Hesabın yok mu?{" "}
          <Link href="/register" className="font-semibold text-[#0071c2] hover:underline">
            Kayıt ol
          </Link>
        </p>
        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <div className="font-semibold text-slate-600">Demo hesaplar:</div>
          <div>👤 guest@orbicity.com / guest123</div>
          <div>🛠️ admin@orbicity.com / admin123</div>
        </div>
      </div>
    </div>
  );
}
