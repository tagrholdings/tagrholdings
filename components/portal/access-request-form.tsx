"use client";

import { useState } from "react";
import Link from "next/link";

export function AccessRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Por favor, informe um e-mail válido.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message: "Solicitação de acesso seguro ao Operating Playbook via portal.",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível enviar o link no momento.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link no momento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a1220] px-4 py-12 text-[#f7f4ec]">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[#2a3a56] bg-[#0e1a2e] p-8 shadow-2xl md:p-10">
        {/* Glow effect */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c9a03e]/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c9a03e] animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#e3c877]">
              TAGR Holdings · Private Portal
            </span>
          </div>

          <h1 className="mt-4 font-serif text-[1.85rem] font-semibold tracking-tight text-[#f7f4ec]">
            Receba seu link seguro de acesso
          </h1>

          <p className="mt-3 text-[14.5px] leading-relaxed text-[#a9b6cf]">
            Para garantir a privacidade e segurança do nosso <strong>Operating Playbook</strong>, enviamos um link direto e exclusivo para o seu e-mail. Digite seus dados abaixo para recebê-lo.
          </p>

          {submitted ? (
            <div className="mt-8 rounded-lg border border-[#5a7d5a]/40 bg-[#5a7d5a]/10 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#5a7d5a]/20 text-[#9bc79b]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="mt-3 font-serif text-lg font-medium text-[#f7f4ec]">E-mail enviado com sucesso!</h3>
              <p className="mt-2 text-sm text-[#c7d2e6]">
                Enviamos o seu link de acesso seguro para <strong className="text-[#e3c877]">{email}</strong>. Verifique sua caixa de entrada (e a pasta de spam).
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-6 text-xs uppercase tracking-wider text-[#a9863a] underline hover:text-[#e3c877]"
              >
                Enviar para outro e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[#8fa0bf]">
                  Seu nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full rounded-md border border-[#2a3a56] bg-[#0a1220] px-4 py-2.5 text-sm text-[#f7f4ec] placeholder-[#5f6f92] outline-none transition focus:border-[#c9a03e] focus:ring-1 focus:ring-[#c9a03e]"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[#8fa0bf]">
                  Seu e-mail corporativo *
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com"
                  className="w-full rounded-md border border-[#2a3a56] bg-[#0a1220] px-4 py-2.5 text-sm text-[#f7f4ec] placeholder-[#5f6f92] outline-none transition focus:border-[#c9a03e] focus:ring-1 focus:ring-[#c9a03e]"
                />
              </div>

              {error && (
                <div className="rounded-md border border-[#a84b3f]/40 bg-[#a84b3f]/10 p-3 text-xs text-[#d98a7c]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#c9a03e] px-5 py-3 font-mono text-xs uppercase tracking-wider font-semibold text-[#0a1220] transition hover:bg-[#e3c877] disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-[#0a1220]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <span>Enviar Link de Acesso Seguro</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 border-t border-[#2a3a56]/60 pt-6 text-center text-xs text-[#5f6f92]">
            Deseja retornar ao site principal?{" "}
            <Link href="/" className="font-semibold text-[#c7d2e6] hover:text-[#e3c877] underline">
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
