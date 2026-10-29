import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { fieldErrors, messageFor } from "../api/messages";
import type { Booth, BoothMode, BoothSettings } from "../api/types";
import { Button, Choice, Notice, TextField } from "../ui";

type Form = {
  name: string;
  mode: BoothMode;
  use_waitlist: boolean;
  total_limit: string;
  start_hour: string;
  end_hour: string;
  slots_per_hour: string;
  limit_per_slot: string;
};
type NumKey = "total_limit" | "start_hour" | "end_hour" | "slots_per_hour" | "limit_per_slot";

const NUM_KEYS: NumKey[] = ["total_limit", "start_hour", "end_hour", "slots_per_hour", "limit_per_slot"];

const toForm = (b: Booth): Form => ({
  name: b.name,
  mode: b.mode,
  use_waitlist: b.use_waitlist,
  total_limit: String(b.total_limit),
  start_hour: String(b.start_hour),
  end_hour: String(b.end_hour),
  slots_per_hour: String(b.slots_per_hour),
  limit_per_slot: String(b.limit_per_slot),
});

// 빈 칸은 NaN 으로 보내 서버가 필드 오류(422)로 돌려주게 한다.
const toNum = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function SettingsForm({
  booth,
  onSave,
  onSaved,
}: {
  booth: Booth;
  onSave: (s: Partial<BoothSettings>) => Promise<Booth>;
  onSaved: (b: Booth) => void;
}) {
  const [open, setOpen] = useState(false);
  // 사용자가 고친 칸만 들고 있고, 나머지는 서버에서 온 부스 값을 그대로 보여준다.
  // 그래서 15초 갱신으로 새 값이 오면 안 고친 칸은 따라가고 고친 칸은 유지된다.
  const [edits, setEdits] = useState<Partial<Form>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  const base = toForm(booth);
  const form: Form = { ...base, ...edits };
  const dirty = (Object.keys(edits) as (keyof Form)[]).filter((k) => edits[k] !== base[k]);

  const save = useMutation({
    mutationFn: () => {
      const body: Partial<BoothSettings> = {};
      for (const k of dirty) {
        if (k === "name") body.name = form.name;
        else if (k === "mode") body.mode = form.mode;
        else if (k === "use_waitlist") body.use_waitlist = form.use_waitlist;
        else body[k] = toNum(form[k]);
      }
      return onSave(body);
    },
    onMutate: () => {
      setErrors({});
      setNote(null);
    },
    onSuccess: (b) => {
      setEdits({});
      setNote("저장했어요.");
      onSaved(b);
    },
    onError: (err) => setErrors(fieldErrors(err)),
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setEdits((e) => {
      const next = { ...e, [k]: v };
      if (v === base[k]) delete next[k]; // 원래 값으로 돌아오면 고친 것이 아니다
      return next;
    });
  const numField = (k: NumKey, label: string, hint?: string, min?: number, max?: number) => (
    <TextField
      label={label}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={form[k]}
      onChange={(e) => set(k, e.target.value)}
      error={errors[k]}
      hint={hint}
    />
  );

  // 화면에 그려진 칸에 붙지 못하는 422 오류(예: 숨겨진 칸)는 일반 안내로 보여준다.
  const shownKeys = new Set<string>(["name", "mode", "use_waitlist", ...(form.mode === "time" ? NUM_KEYS.filter((k) => k !== "total_limit") : ["total_limit"])]);
  const orphans = Object.entries(errors).filter(([k]) => !shownKeys.has(k)).map(([, v]) => v);
  const generic =
    save.isError && (Object.keys(errors).length === 0 || orphans.length > 0)
      ? [messageFor(save.error), ...orphans].join(" ")
      : null;

  return (
    <section aria-label="부스 설정">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between text-15 font-extrabold"
      >
        설정
        <ChevronDown aria-hidden className={`size-5 ${open ? "rotate-180" : ""}`} />
      </button>
      <form
        hidden={!open}
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty.length === 0) {
            setErrors({});
            setNote("바꾼 내용이 없어요.");
            return;
          }
          save.mutate();
        }}
      >
        <TextField label="부스 이름" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        <Choice
          label="운영 방식"
          value={form.mode}
          onChange={(v) => set("mode", v)}
          error={errors.mode}
          options={[
            { value: "time", label: "타임별" },
            { value: "fcfs", label: "선착순" },
          ]}
        />
        <label className="flex min-h-11 items-center gap-3 text-15 font-bold">
          <input
            type="checkbox"
            checked={form.use_waitlist}
            onChange={(e) => set("use_waitlist", e.target.checked)}
            className="size-5"
          />
          대기 접수 받기
        </label>
        {form.mode === "time" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {numField("start_hour", "시작 시각", "0~23 사이 정수", 0, 23)}
            {numField("end_hour", "종료 시각", "종료는 시작과 같거나 늦어야 해요", 0, 23)}
            {numField("slots_per_hour", "시간당 타임 수", "1~6", 1, 6)}
            {numField("limit_per_slot", "타임당 인원", "0이면 제한 없음", 0)}
          </div>
        ) : (
          numField("total_limit", "선착순 인원", "0이면 제한 없음", 0)
        )}
        {generic && <Notice tone="error">{generic}</Notice>}
        {note && !save.isError && <Notice tone="info">{note}</Notice>}
        <Button type="submit" loading={save.isPending}>
          저장
        </Button>
      </form>
    </section>
  );
}
