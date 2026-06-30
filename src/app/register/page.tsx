"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type FormState } from "@/lib/actions";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-800">Kayıt Ol</h1>
        <p className="mt-1 text-sm text-slate-500">Genius avantajlarından yararlanmaya başlayın.</p>
        <form action={action} className="mt-6 space-y-4">
          <input
            name="fullName"
            placeholder="Ad Soyad"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          <input
            name="email"
            type="email"
            placeholder="E-posta"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          <input
            name="phone"
            placeholder="Telefon (opsiyonel)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          <input
            name="password"
            type="password"
            placeholder="Şifre (en az 6 karakter)"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          {state.error && <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{state.error}</div>}
          <button
            disabled={pending}
            className="w-full rounded-lg bg-amber-400 px-4 py-2.5 font-semibold text-[#003580] hover:bg-amber-300 disabled:opacity-60"
          >
            {pending ? "Kayıt olunuyor…" : "Hesap Oluştur"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="font-semibold text-[#0071c2] hover:underline">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  );
}
