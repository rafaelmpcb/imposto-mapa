import { Select } from "@/components/simulator/ui";
import { STAGE_BLOCKS, STAGE_LABELS, type CaseStage } from "@/lib/cases/stages";

/** Seletor das 12 etapas, agrupadas pelos 3 blocos do funil. */
export function StageSelect({
  value,
  onChange,
  disabled,
}: {
  value: CaseStage;
  onChange: (stage: CaseStage) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      disabled={disabled ?? false}
      aria-label="Etapa do funil"
      onChange={(event) => onChange(event.target.value as CaseStage)}
    >
      {STAGE_BLOCKS.map((block) => (
        <optgroup key={block.number} label={`${block.number} ${block.title}`}>
          {block.stages.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
