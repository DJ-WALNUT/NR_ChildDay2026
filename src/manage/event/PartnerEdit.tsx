import { useState, type FormEvent } from "react";
import { fieldErrors, messageFor } from "../../api/messages";
import type { Partner } from "../../api/types";
import { Button, Modal, Notice, SelectField, TextField } from "../../ui";

export const NONE = "";

export type Org = { id: number; name: string };

/** 연결 기관 선택 상자. 이미 연결된 기관이 목록에 없어도 고를 수 있게 보태 줘요. */
export function LinkedOrgSelect({ value, onChange, targets, current, error }: {
  value: string;
  onChange: (v: string) => void;
  targets: Org[];
  current?: Org | null;
  error?: string;
}) {
  const orgs = current && !targets.some((o) => o.id === current.id) ? [current, ...targets] : targets;
  return (
    <SelectField
      label="연결 기관"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      options={[{ value: NONE, label: "연결 안 함" }, ...orgs.map((o) => ({ value: String(o.id), label: o.name }))]}
    />
  );
}

export function EditDialog({ partner, targets, onSave, onClose }: {
  partner: Partner;
  targets: Org[];
  onSave: (body: { name: string; linked_org_id?: number | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(partner.name);
  const [linked, setLinked] = useState(partner.linked_org ? String(partner.linked_org.id) : NONE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      // 연결 기관은 바뀌었을 때만 보낸다. 서버는 보낸 값을 활성 기관인지 검사하므로 비활성 기관에 연결된 단체도 이름은 바꿀 수 있게 한다.
      const next = linked === NONE ? null : Number(linked);
      const changed = next !== (partner.linked_org?.id ?? null);
      await onSave({ name: name.trim(), ...(changed && { linked_org_id: next }) });
      onClose();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="운영 단체 수정" onClose={onClose}>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <TextField label="단체 이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <LinkedOrgSelect value={linked} onChange={setLinked} targets={targets} current={partner.linked_org} error={errors.linked_org_id} />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" loading={busy}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
