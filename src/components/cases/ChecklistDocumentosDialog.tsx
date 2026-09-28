import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/simulator/ui";

interface DocItem {
  nome: string;
  formato: string;
  porque: string;
  obrigatorio?: boolean;
}

interface Modulo {
  id: string;
  titulo: string;
  resumo: string;
  docs: DocItem[];
}

export const CHECKLIST_MODULOS: Modulo[] = [
  {
    id: "diagnostico",
    titulo: "Diagnóstico da Reforma (IBS/CBS)",
    resumo: "Mede quanto a empresa vai pagar de imposto com a Reforma e quem são os fornecedores e clientes que mais pesam.",
    docs: [
      { nome: "XML das notas fiscais de compra (NF-e) dos últimos 12 meses", formato: "XML ou ZIP com os XML (não serve PDF/DANFE)", porque: "Mostra de quem a empresa compra e quanto de crédito poderá aproveitar no novo imposto.", obrigatorio: true },
      { nome: "XML das notas fiscais de venda (NF-e) dos últimos 12 meses", formato: "XML ou ZIP", porque: "Mostra o que a empresa vende e para quem, base para calcular o imposto devido e o preço necessário.", obrigatorio: true },
      { nome: "XML das notas de serviço (NFS-e) tomadas e prestadas", formato: "XML ou ZIP", porque: "Serviços têm regras próprias na Reforma; sem elas o cálculo fica incompleto." },
      { nome: "Extrato do PGDAS-D (se for do Simples Nacional)", formato: "PDF gerado no portal do Simples", porque: "Traz o faturamento real dos últimos 12 meses e a faixa do Simples usada no cálculo." },
      { nome: "DRE ou balancete dos últimos 12 meses", formato: "Excel ou PDF", porque: "Permite projetar resultado e fluxo de caixa ano a ano até 2033." },
      { nome: "Planilha de clientes e fornecedores (opcional)", formato: "Excel/CSV com nome, CNPJ e valor movimentado", porque: "Alternativa aos XML para identificar o regime de cada parceiro." },
    ],
  },
  {
    id: "locacao",
    titulo: "Impacto na Locação",
    resumo: "Avalia o efeito da Reforma sobre aluguéis pagos ou recebidos.",
    docs: [
      { nome: "Contratos de locação vigentes", formato: "PDF", porque: "Confirma valor, prazo e cláusulas de reajuste e repasse de tributos.", obrigatorio: true },
      { nome: "Recibos ou boletos recentes de aluguel", formato: "PDF", porque: "Confirma o valor mensal efetivamente pago." },
      { nome: "Dados do locador (CNPJ/CPF e regime)", formato: "Texto ou cartão CNPJ", porque: "O crédito do locatário depende de quem é o locador." },
    ],
  },
  {
    id: "contratos",
    titulo: "Contratos e Reequilíbrio",
    resumo: "Identifica contratos que precisam ter o preço revisto por causa da mudança de tributos.",
    docs: [
      { nome: "Contratos de prestação de serviço ou fornecimento continuado", formato: "PDF ou Word", porque: "Avaliamos as cláusulas de reajuste e de repasse de tributos.", obrigatorio: true },
      { nome: "Planilha de custos do contrato", formato: "Excel", porque: "Mostra quanto do preço é custo e quanto gera crédito no novo sistema." },
      { nome: "Últimas notas fiscais emitidas no contrato", formato: "XML", porque: "Confirma os tributos hoje embutidos no preço." },
    ],
  },
  {
    id: "saldos",
    titulo: "Saldos Credores PIS/COFINS e ICMS",
    resumo: "Quantifica créditos acumulados e o melhor caminho para transformá-los em dinheiro antes da Reforma.",
    docs: [
      { nome: "EFD-Contribuições (SPED) dos últimos 5 anos", formato: "Arquivo .txt do SPED", porque: "Comprova os créditos de PIS/COFINS acumulados.", obrigatorio: true },
      { nome: "EFD ICMS/IPI (SPED Fiscal) dos últimos 5 anos", formato: "Arquivo .txt do SPED", porque: "Comprova o saldo credor de ICMS.", obrigatorio: true },
      { nome: "PER/DCOMP já transmitidos", formato: "PDF ou recibos", porque: "Evita pedir de novo créditos já compensados." },
    ],
  },
  {
    id: "monofasico",
    titulo: "PIS/COFINS Monofásico",
    resumo: "Recupera PIS/COFINS pago a mais em produtos cujo imposto já foi recolhido na indústria.",
    docs: [
      { nome: "XML das notas de venda (NF-e/NFC-e) dos últimos 5 anos", formato: "XML ou ZIP", porque: "Identificamos, produto a produto, os itens monofásicos pelo NCM.", obrigatorio: true },
      { nome: "Extratos do PGDAS-D do mesmo período (Simples)", formato: "PDF", porque: "Mostra quanto de PIS/COFINS foi pago no DAS e pode ser recuperado." },
      { nome: "Arquivos do SPED Contribuições (Lucro Presumido/Real)", formato: "Arquivo .txt", porque: "Confirma o que foi apurado e recolhido." },
    ],
  },
  {
    id: "capex",
    titulo: "Planejamento de CAPEX",
    resumo: "Define o melhor momento para comprar máquinas e equipamentos pensando no crédito do imposto.",
    docs: [
      { nome: "Lista de investimentos previstos", formato: "Excel com bem, valor e data prevista", porque: "Base para comparar comprar agora ou depois da Reforma.", obrigatorio: true },
      { nome: "Controle do CIAP (Bloco G do SPED Fiscal)", formato: "Arquivo .txt ou relatório", porque: "Mostra o fator de aproveitamento do crédito de ICMS da empresa." },
      { nome: "Notas de compra de ativos recentes", formato: "XML", porque: "Confirma alíquotas de ICMS e IPI praticadas." },
    ],
  },
];

function montarTexto(clientName: string, mods: Modulo[]) {
  const linhas: string[] = [];
  linhas.push(`Olá${clientName ? `, ${clientName}` : ""}! Para concluirmos a análise, precisamos dos documentos abaixo.`);
  linhas.push("Itens marcados com * são indispensáveis.");
  for (const m of mods) {
    linhas.push("", `*${m.titulo}*`, m.resumo);
    m.docs.forEach((d, i) => {
      linhas.push(`${i + 1}. ${d.nome}${d.obrigatorio ? " *" : ""}`);
      linhas.push(`   Formato: ${d.formato}`);
      linhas.push(`   Por quê: ${d.porque}`);
    });
  }
  linhas.push("", "Qualquer dúvida, estamos à disposição.");
  return linhas.join("\n");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function ChecklistDocumentosDialog({
  open,
  onOpenChange,
  clientName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientName: string;
}) {
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set(["diagnostico"]));
  const mods = useMemo(() => CHECKLIST_MODULOS.filter((m) => sel.has(m.id)), [sel]);
  const texto = useMemo(() => montarTexto(clientName, mods), [clientName, mods]);

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setMsg("Checklist copiado. Cole no WhatsApp ou e-mail.");
    } catch {
      setMsg("Não foi possível copiar.");
    }
  };

  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const corpo = mods
      .map(
        (m) => `<h2>${escapeHtml(m.titulo)}</h2><p class="r">${escapeHtml(m.resumo)}</p><table><tr><th>Documento</th><th>Formato</th><th>Por que precisamos</th></tr>${m.docs
          .map(
            (d) =>
              `<tr><td>${escapeHtml(d.nome)}${d.obrigatorio ? " <b>(indispensável)</b>" : ""}</td><td>${escapeHtml(d.formato)}</td><td>${escapeHtml(d.porque)}</td></tr>`,
          )
          .join("")}</table>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Checklist de documentos</title><style>
      body{font-family:Georgia,serif;color:#1a2233;margin:32px}h1{font-size:20px}h2{font-size:15px;margin-top:22px}
      .r{font-size:12px;color:#555}table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#eef1f6}
    </style></head><body><h1>Checklist de documentos${clientName ? ` — ${escapeHtml(clientName)}` : ""}</h1>${corpo}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checklist de documentos para o cliente</DialogTitle>
          <DialogDescription>
            Escolha os módulos contratados. Cada documento vem com o formato certo e o motivo do pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {CHECKLIST_MODULOS.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                sel.has(m.id) ? "border-navy bg-navy text-navy-foreground" : "border-border bg-card text-foreground"
              }`}
            >
              <input type="checkbox" className="sr-only" checked={sel.has(m.id)} onChange={() => toggle(m.id)} />
              {m.titulo}
            </label>
          ))}
        </div>

        <div className="space-y-4">
          {mods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Selecione ao menos um módulo.</p>
          ) : null}
          {mods.map((m) => (
            <section key={m.id} className="rounded-lg border border-border p-3">
              <p className="font-semibold text-foreground">{m.titulo}</p>
              <p className="mb-2 text-xs text-muted-foreground">{m.resumo}</p>
              <ul className="space-y-2">
                {m.docs.map((d) => (
                  <li key={d.nome} className="text-sm">
                    <p className="font-medium text-foreground">
                      {d.nome}
                      {d.obrigatorio ? (
                        <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-navy">
                          indispensável
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">Formato: {d.formato}</p>
                    <p className="text-xs text-muted-foreground">Por quê: {d.porque}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {msg ? <span className="mr-auto text-xs text-muted-foreground">{msg}</span> : null}
          <Button variant="ghost" onClick={imprimir} disabled={mods.length === 0}>
            Imprimir / salvar PDF
          </Button>
          <Button onClick={() => void copiar()} disabled={mods.length === 0}>
            Copiar para WhatsApp/E-mail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
