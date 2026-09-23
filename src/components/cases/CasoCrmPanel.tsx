import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button, Field, Notice, Select, TextInput } from "@/components/simulator/ui";
import { withAuthRetry } from "@/lib/auth-retry";
import type { CaseRecord } from "@/lib/cases.functions";
import {
  addCaseContact,
  addCaseInteraction,
  deleteCaseContact,
  deleteCaseInteraction,
  getCaseCrm,
  updateCaseCommercial,
  FEE_MODEL_LABELS,
  INTERACTION_LABELS,
  STATUS_LABELS,
  type CaseContact,
  type CaseInteraction,
  type CommercialStatus,
  type FeeModel,
  type InteractionKind,
} from "@/lib/crm.functions";
import { ALERT_CLASSES, caseAlert } from "@/lib/crm/alerts";
import { brl } from "@/lib/tax/calc";

type Aba = "comercial" | "contatos" | "timeline";

function soDigitos(v: string | null): string {
  return (v ?? "").replace(/\D/g, "");
}

export function CasoCrmPanel({
  caseItem,
  onUpdated,
}: {
  caseItem: CaseRecord;
  onUpdated: (patch: Partial<CaseRecord>) => void;
}) {
  const carregar = useServerFn(getCaseCrm);
  const salvarComercial = useServerFn(updateCaseCommercial);
  const novoContato = useServerFn(addCaseContact);
  const removerContato = useServerFn(deleteCaseContact);
  const novaInteracao = useServerFn(addCaseInteraction);
  const removerInteracao = useServerFn(deleteCaseInteraction);

  const [aba, setAba] = useState<Aba>("comercial");
  const [contatos, setContatos] = useState<CaseContact[]>([]);
  const [interacoes, setInteracoes] = useState<CaseInteraction[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const [dealValue, setDealValue] = useState(String(caseItem.deal_value ?? 0));
  const [feeModel, setFeeModel] = useState<FeeModel>((caseItem.fee_model as FeeModel) ?? "fixo");
  const [prob, setProb] = useState(String(caseItem.win_probability ?? 0));
  const [status, setStatus] = useState<CommercialStatus>(
    (caseItem.commercial_status as CommercialStatus) ?? "ativo",
  );
  const [motivo, setMotivo] = useState(caseItem.lost_reason ?? "");
  const [acaoTitulo, setAcaoTitulo] = useState(caseItem.next_action_title ?? "");
  const [acaoData, setAcaoData] = useState(
    caseItem.next_action_date ? caseItem.next_action_date.slice(0, 10) : "",
  );

  const [cNome, setCNome] = useState("");
  const [cCargo, setCCargo] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cFone, setCFone] = useState("");
  const [cPrincipal, setCPrincipal] = useState(false);

  const [iTipo, setITipo] = useState<InteractionKind>("reuniao");
  const [iTitulo, setITitulo] = useState("");
  const [iTexto, setITexto] = useState("");
  const [iData, setIData] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await withAuthRetry(() => carregar({ data: { caseId: caseItem.id } }));
        if (!vivo || !res.ok) return;
        setContatos(res.contacts);
        setInteracoes(res.interactions);
      } catch {
        if (vivo) setErro("Não foi possível carregar contatos e histórico deste caso.");
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseItem.id]);

  const alerta = caseAlert(caseItem);

  const handleSalvarComercial = async () => {
    setSalvando(true);
    setErro("");
    try {
      const payload = {
        id: caseItem.id,
        dealValue: Number(dealValue.replace(",", ".")) || 0,
        feeModel,
        winProbability: Number(prob) || 0,
        commercialStatus: status,
        lostReason: status === "perdido" ? motivo.trim() || null : null,
        nextActionTitle: acaoTitulo.trim() || null,
        nextActionDate: acaoData ? new Date(`${acaoData}T12:00:00`).toISOString() : null,
      };
      const res = await withAuthRetry(() => salvarComercial({ data: payload }));
      if (!res.ok) throw new Error("fail");
      onUpdated({
        deal_value: payload.dealValue,
        fee_model: payload.feeModel,
        win_probability: payload.winProbability,
        commercial_status: payload.commercialStatus,
        lost_reason: payload.lostReason,
        next_action_title: payload.nextActionTitle,
        next_action_date: payload.nextActionDate,
      });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch {
      setErro("Não foi possível salvar os dados comerciais.");
    } finally {
      setSalvando(false);
    }
  };

  const handleNovoContato = async () => {
    if (!cNome.trim()) return;
    try {
      const res = await withAuthRetry(() =>
        novoContato({
          data: {
            caseId: caseItem.id,
            name: cNome,
            role: cCargo || null,
            email: cEmail || null,
            phone: cFone || null,
            isPrimary: cPrincipal,
          },
        }),
      );
      if (!res.ok) throw new Error("fail");
      setContatos((prev) => {
        const base = cPrincipal ? prev.map((c) => ({ ...c, is_primary: false })) : prev;
        return [...base, res.contact].sort(
          (a, b) => Number(b.is_primary) - Number(a.is_primary),
        );
      });
      if (cPrincipal || contatos.length === 0) {
        onUpdated({ primary_contact_name: cNome, primary_contact_phone: cFone || null });
      }
      onUpdated({ contacts_count: contatos.length + 1 });
      setCNome("");
      setCCargo("");
      setCEmail("");
      setCFone("");
      setCPrincipal(false);
    } catch {
      setErro("Não foi possível adicionar o contato.");
    }
  };

  const handleRemoverContato = async (id: string) => {
    try {
      await withAuthRetry(() => removerContato({ data: { id } }));
      setContatos((prev) => prev.filter((c) => c.id !== id));
      onUpdated({ contacts_count: Math.max(0, contatos.length - 1) });
    } catch {
      setErro("Não foi possível remover o contato.");
    }
  };

  const handleNovaInteracao = async () => {
    if (!iTitulo.trim()) return;
    try {
      const res = await withAuthRetry(() =>
        novaInteracao({
          data: {
            caseId: caseItem.id,
            kind: iTipo,
            title: iTitulo,
            body: iTexto || null,
            happenedAt: iData ? new Date(`${iData}T12:00:00`).toISOString() : null,
            authorName: null,
          },
        }),
      );
      if (!res.ok) throw new Error("fail");
      setInteracoes((prev) => [res.interaction, ...prev]);
      onUpdated({ last_interaction_at: res.interaction.happened_at });
      setITitulo("");
      setITexto("");
    } catch {
      setErro("Não foi possível registrar a interação.");
    }
  };

  const handleRemoverInteracao = async (id: string) => {
    try {
      await withAuthRetry(() => removerInteracao({ data: { id } }));
      setInteracoes((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setErro("Não foi possível remover o registro.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["comercial", "contatos", "timeline"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              aba === k ? "bg-navy text-navy-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
            }`}
          >
            {k === "comercial"
              ? "Dados comerciais"
              : k === "contatos"
                ? `Contatos (${contatos.length})`
                : `Linha do tempo (${interacoes.length})`}
          </button>
        ))}
        <span
          className={`ml-auto rounded-full border px-2.5 py-1 text-xs font-semibold ${ALERT_CLASSES[alerta.tone]}`}
        >
          {alerta.label}
        </span>
      </div>

      {erro ? <Notice tone="warning">{erro}</Notice> : null}

      {aba === "comercial" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Honorários estimados (R$)">
              <TextInput
                inputMode="decimal"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                placeholder="0,00"
              />
            </Field>
            <Field label="Modelo de cobrança">
              <Select value={feeModel} onChange={(e) => setFeeModel(e.target.value as FeeModel)}>
                {(Object.keys(FEE_MODEL_LABELS) as FeeModel[]).map((k) => (
                  <option key={k} value={k}>
                    {FEE_MODEL_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Chance de fechamento (%)">
              <TextInput
                inputMode="numeric"
                value={prob}
                onChange={(e) => setProb(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Situação">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as CommercialStatus)}
              >
                {(Object.keys(STATUS_LABELS) as CommercialStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {status === "perdido" ? (
            <Field label="Motivo da perda">
              <TextInput
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Preço, concorrência, sem prioridade..."
              />
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Próxima ação">
              <TextInput
                value={acaoTitulo}
                onChange={(e) => setAcaoTitulo(e.target.value)}
                placeholder="Ex.: apresentar diagnóstico ao CFO"
              />
            </Field>
            <Field label="Data da próxima ação">
              <TextInput
                type="date"
                value={acaoData}
                onChange={(e) => setAcaoData(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={salvando} onClick={() => void handleSalvarComercial()}>
              {salvando ? "Salvando..." : "Salvar dados comerciais"}
            </Button>
            {salvo ? <span className="text-sm text-success">Dados salvos.</span> : null}
            <span className="text-sm text-muted-foreground">
              Valor ponderado:{" "}
              {brl(((Number(dealValue.replace(",", ".")) || 0) * (Number(prob) || 0)) / 100)}
            </span>
          </div>
        </section>
      ) : null}

      {aba === "contatos" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          {contatos.length === 0 ? (
            <Notice>Nenhum interlocutor cadastrado neste caso.</Notice>
          ) : (
            <ul className="space-y-2">
              {contatos.map((c) => {
                const fone = soDigitos(c.phone);
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {c.name}
                        {c.is_primary ? (
                          <span className="ml-2 rounded-full bg-navy px-2 py-0.5 text-[11px] font-semibold text-navy-foreground">
                            Principal
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[c.role, c.email, c.phone].filter(Boolean).join(" · ") || "Sem detalhes"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {fone ? (
                        <a
                          href={`https://wa.me/55${fone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
                        >
                          E-mail
                        </a>
                      ) : null}
                      <Button variant="ghost" onClick={() => void handleRemoverContato(c.id)}>
                        Remover
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nome">
              <TextInput value={cNome} onChange={(e) => setCNome(e.target.value)} placeholder="Nome do interlocutor" />
            </Field>
            <Field label="Cargo">
              <TextInput value={cCargo} onChange={(e) => setCCargo(e.target.value)} placeholder="Sócio, CFO, contador..." />
            </Field>
            <Field label="E-mail">
              <TextInput value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="email@empresa.com.br" />
            </Field>
            <Field label="Telefone / WhatsApp">
              <TextInput value={cFone} onChange={(e) => setCFone(e.target.value)} placeholder="(85) 99999-0000" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-navy,#1e3a5f)]"
                checked={cPrincipal}
                onChange={(e) => setCPrincipal(e.target.checked)}
              />
              Contato principal
            </label>
            <Button onClick={() => void handleNovoContato()}>Adicionar contato</Button>
          </div>
        </section>
      ) : null}

      {aba === "timeline" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tipo">
              <Select value={iTipo} onChange={(e) => setITipo(e.target.value as InteractionKind)}>
                {(Object.keys(INTERACTION_LABELS) as InteractionKind[]).map((k) => (
                  <option key={k} value={k}>
                    {INTERACTION_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assunto">
              <TextInput
                value={iTitulo}
                onChange={(e) => setITitulo(e.target.value)}
                placeholder="Ex.: reunião de apresentação do diagnóstico"
              />
            </Field>
            <Field label="Data">
              <TextInput type="date" value={iData} onChange={(e) => setIData(e.target.value)} />
            </Field>
          </div>
          <Field label="Anotações">
            <textarea
              value={iTexto}
              onChange={(e) => setITexto(e.target.value)}
              rows={3}
              placeholder="Pontos discutidos, objeções, combinados..."
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </Field>
          <Button onClick={() => void handleNovaInteracao()}>Registrar interação</Button>

          {interacoes.length === 0 ? (
            <Notice>Nenhuma interação registrada ainda.</Notice>
          ) : (
            <ol className="space-y-3 border-t border-border pt-4">
              {interacoes.map((i) => (
                <li key={i.id} className="rounded-lg border border-border bg-secondary p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        <span className="mr-2 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                          {INTERACTION_LABELS[i.kind] ?? i.kind}
                        </span>
                        {i.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(i.happened_at).toLocaleDateString("pt-BR")}
                        {i.author_name ? ` · ${i.author_name}` : ""}
                      </p>
                      {i.body ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{i.body}</p>
                      ) : null}
                    </div>
                    <Button variant="ghost" onClick={() => void handleRemoverInteracao(i.id)}>
                      Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
