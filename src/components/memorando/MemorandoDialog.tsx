import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button, Field, Notice, TextInput } from "@/components/simulator/ui";
import { lookupCnpj } from "@/lib/cnpj.functions";
import type { CnpjData } from "@/lib/cnpj/types";
import {
  buildMemorandoBlob,
  memorandoFileName,
  type MemorandoClient,
  type MemorandoManual,
} from "@/lib/memorando/document";
import {
  emptyOfficeConfig,
  getOfficeConfig,
  OFFICE_FIELDS,
  type OfficeConfig,
} from "@/lib/office-config.functions";

export function MemorandoDialog({
  cnpjData,
  clientName,
  onClose,
}: {
  cnpjData: CnpjData | null;
  clientName: string;
  onClose: () => void;
}) {
  const loadOffice = useServerFn(getOfficeConfig);
  const search = useServerFn(lookupCnpj);

  const [stage, setStage] = useState<"cnpj" | "review">(cnpjData ? "review" : "cnpj");
  const [cnpjInput, setCnpjInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [office, setOffice] = useState<OfficeConfig>(emptyOfficeConfig());
  const [client, setClient] = useState<MemorandoClient>({
    razao_social: cnpjData?.razao_social || clientName,
    cnpj: cnpjData?.cnpj ?? "",
    endereco: cnpjData?.endereco ?? "",
    representante_nome: cnpjData?.representante_sugerido ?? "",
  });
  const [manual, setManual] = useState<MemorandoManual>({
    representante_cpf: "",
    prazo_confidencialidade_anos: "",
    cidade_assinatura: "",
    data_assinatura: "",
  });

  useEffect(() => {
    void loadOffice().then((res) => setOffice(res.values));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await search({ data: { cnpj: cnpjInput } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setClient({
        razao_social: res.data.razao_social,
        cnpj: res.data.cnpj,
        endereco: res.data.endereco,
        representante_nome: res.data.representante_sugerido,
      });
      setStage("review");
    } catch {
      setError("Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await buildMemorandoBlob({ escritorio: office, cliente: client, manual });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = memorandoFileName(client.razao_social);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError("Não foi possível gerar o documento agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const officeIncomplete = OFFICE_FIELDS.some((f) => !office[f.key].trim());

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/50 p-4">
      <div className="mx-auto my-6 max-w-2xl rounded-xl border border-border bg-card p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">Memorando de Entendimento e Confidencialidade</h2>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        {stage === "cnpj" ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta simulação não tem CNPJ salvo. Informe o CNPJ do cliente para buscar os dados.
            </p>
            <Field label="CNPJ do cliente">
              <TextInput
                value={cnpjInput}
                onChange={(event) => setCnpjInput(event.target.value)}
                placeholder="00.000.000/0001-00"
                inputMode="numeric"
              />
            </Field>
            {error ? <Notice tone="warning">{error}</Notice> : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void runSearch()} disabled={busy}>
                {busy ? "Buscando..." : "Buscar dados"}
              </Button>
              <Button variant="ghost" onClick={() => setStage("review")}>
                Preencher manualmente
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Dados do cliente
              </h3>
              <Field label="Razão social">
                <TextInput
                  value={client.razao_social}
                  onChange={(e) => setClient({ ...client, razao_social: e.target.value })}
                />
              </Field>
              <Field label="CNPJ">
                <TextInput
                  value={client.cnpj}
                  onChange={(e) => setClient({ ...client, cnpj: e.target.value })}
                />
              </Field>
              <Field label="Endereço">
                <TextInput
                  value={client.endereco}
                  onChange={(e) => setClient({ ...client, endereco: e.target.value })}
                />
              </Field>
              <Field
                label="Nome do representante do cliente"
                hint="Confirme quem efetivamente vai assinar — a consulta pública não informa isso."
              >
                <TextInput
                  value={client.representante_nome}
                  onChange={(e) => setClient({ ...client, representante_nome: e.target.value })}
                />
              </Field>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Dados do escritório
              </h3>
              {officeIncomplete ? (
                <Notice tone="warning">
                  Complete os dados do escritório na área restrita para não gerar campos em branco.
                </Notice>
              ) : null}
              {OFFICE_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <TextInput
                    value={office[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => setOffice({ ...office, [f.key]: e.target.value })}
                  />
                </Field>
              ))}
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Preenchimento manual
              </h3>
              <Field label="CPF do representante">
                <TextInput
                  value={manual.representante_cpf}
                  onChange={(e) => setManual({ ...manual, representante_cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="Prazo de confidencialidade (anos)">
                <TextInput
                  value={manual.prazo_confidencialidade_anos}
                  onChange={(e) =>
                    setManual({ ...manual, prazo_confidencialidade_anos: e.target.value })
                  }
                  inputMode="numeric"
                />
              </Field>
              <Field label="Cidade de assinatura">
                <TextInput
                  value={manual.cidade_assinatura}
                  onChange={(e) => setManual({ ...manual, cidade_assinatura: e.target.value })}
                />
              </Field>
              <Field label="Data de assinatura">
                <TextInput
                  value={manual.data_assinatura}
                  onChange={(e) => setManual({ ...manual, data_assinatura: e.target.value })}
                  placeholder="17 de setembro de 2026"
                />
              </Field>
            </section>

            {error ? <Notice tone="warning">{error}</Notice> : null}

            <Button
              onClick={() => void generate()}
              disabled={
                busy ||
                !client.razao_social.trim() ||
                !manual.representante_cpf.trim() ||
                !manual.prazo_confidencialidade_anos.trim() ||
                !manual.cidade_assinatura.trim() ||
                !manual.data_assinatura.trim()
              }
            >
              {busy ? "Gerando..." : "Gerar documento (.docx)"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
