import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { emptyOfficeContact, getOfficeContact, type OfficeContact } from "@/lib/office-config.functions";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function waLink(whatsapp: string, message: string): string {
  let digits = onlyDigits(whatsapp);
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Contatos configurados do escritório, exibidos ao cliente. */
export function OfficeContactCta({
  message = "Olá! Fiz a simulação da Reforma Tributária e gostaria de falar sobre o diagnóstico completo.",
  variant = "card",
}: {
  message?: string;
  variant?: "card" | "inline";
}) {
  const load = useServerFn(getOfficeContact);
  const [contact, setContact] = useState<OfficeContact>(emptyOfficeContact());

  useEffect(() => {
    void load()
      .then(setContact)
      .catch(() => setContact(emptyOfficeContact()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasWhats = contact.whatsapp.trim().length > 0;
  const hasEmail = contact.email_contato.trim().length > 0;
  const hasPhone = contact.telefone.trim().length > 0;
  if (!hasWhats && !hasEmail && !hasPhone) return null;

  const buttons = (
    <div className="flex flex-wrap gap-3">
      {hasWhats ? (
        <a
          href={waLink(contact.whatsapp, message)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground transition-colors hover:opacity-90"
        >
          Falar no WhatsApp
        </a>
      ) : null}
      {hasEmail ? (
        <a
          href={`mailto:${contact.email_contato}?subject=${encodeURIComponent(
            "Reforma Tributária — diagnóstico completo",
          )}&body=${encodeURIComponent(message)}`}
          className="inline-flex items-center justify-center rounded-md border border-input bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Enviar e-mail
        </a>
      ) : null}
      {hasPhone && !hasWhats ? (
        <a
          href={`tel:${onlyDigits(contact.telefone)}`}
          className="inline-flex items-center justify-center rounded-md border border-input bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Ligar para {contact.telefone}
        </a>
      ) : null}
    </div>
  );

  if (variant === "inline") return buttons;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold">Fale com o escritório</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {contact.nome
          ? `${contact.nome} pode conduzir o diagnóstico completo com base nos seus documentos fiscais.`
          : "Converse com a equipe para avançar no diagnóstico completo."}
      </p>
      <div className="mt-4">{buttons}</div>
      {contact.site.trim() ? (
        <a
          href={contact.site}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-navy underline"
        >
          {contact.site}
        </a>
      ) : null}
    </section>
  );
}
