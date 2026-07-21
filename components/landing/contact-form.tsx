"use client";
import { useState } from "react";

type FormState = {
  name: string;
  email: string;
  message: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  message: "",
};

export function ContactForm() {
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (submitted) setSubmitted(false);
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (!formData.name.trim()) {
      setError("Please provide your name.");
      return;
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "We could not process your request.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not process your request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.06em] text-[rgba(245,242,236,0.55)]" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Your name"
          className="w-full border-b border-[rgba(245,242,236,0.16)] bg-transparent px-0 py-2 text-[15px] text-[var(--cream)] outline-none transition focus:border-[var(--brass)]"
        />
      </div>

      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.06em] text-[rgba(245,242,236,0.55)]" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@company.com"
          className="w-full border-b border-[rgba(245,242,236,0.16)] bg-transparent px-0 py-2 text-[15px] text-[var(--cream)] outline-none transition focus:border-[var(--brass)]"
        />
      </div>

      <div>
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.06em] text-[rgba(245,242,236,0.55)]" htmlFor="message">
          What would you like to discuss?
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Tell us a bit about your business or inquiry"
          className="h-[88px] w-full resize-none border-b border-[rgba(245,242,236,0.16)] bg-transparent px-0 py-2 text-[15px] text-[var(--cream)] outline-none transition focus:border-[var(--brass)]"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-sm border border-transparent bg-[var(--brass)] px-6 py-3 font-mono text-[12px] uppercase tracking-[0.04em] text-[var(--ink)] transition hover:bg-[#C7A667] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Sending..." : "Request a Consultation"}
      </button>

      {submitted ? (
        <p className="text-sm text-[#C7A667]">
          Thanks — we’ve granted your access and you’ll receive an email shortly.
        </p>
      ) : null}

      {error ? <p className="text-sm text-[#f2b2b2]">{error}</p> : null}
    </form>
  );
}
