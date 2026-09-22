import { Notice } from "@/components/simulator/ui";

/** Espaço reservado para as ferramentas ainda não construídas. */
export function ModuloEmBreve({
  titulo,
  descricao,
  itens,
}: {
  titulo: string;
  descricao: string;
  itens: string[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Módulo em preparação
      </p>
      <h2 className="mt-2 text-xl font-semibold text-foreground">{titulo}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{descricao}</p>
      <ul className="mt-4 space-y-2 text-sm text-foreground">
        {itens.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-navy">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Notice>
          Esta aba já tem o lugar reservado no painel. Quando o módulo entrar no ar, ele aparece
          aqui com as próprias listagens e indicadores.
        </Notice>
      </div>
    </section>
  );
}
