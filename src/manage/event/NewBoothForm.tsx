import { useId, useState, type FormEvent } from "react";
import { createBooth } from "../../api/admin";
import { fieldErrors, messageFor } from "../../api/messages";
import type { BoothMode } from "../../api/types";
import { downloadBulkTemplate } from "../../lib/bulkBooths";
import { Button, Choice, Notice, TextField } from "../../ui";

type NumKey = "start_hour" | "end_hour" | "slots_per_hour" | "limit_per_slot" | "total_limit";

const TIME_KEYS: NumKey[] = ["start_hour", "end_hour", "slots_per_hour", "limit_per_slot"];
const DEFAULTS: Record<NumKey, string> = {
  start_hour: "11",
  end_hour: "16",
  slots_per_hour: "3",
  limit_per_slot: "5",
  total_limit: "100",
};

// 빈 칸은 NaN 으로 보내 서버가 필드 오류(422)로 돌려주게 한다.
const toNum = (v: string) => (v.trim() === "" ? NaN : Number(v));

/** 행사 부스 탭 맨 위의 부스 추가 폼. 연달아 추가하기 쉽게 성공하면 이름만 비운다. */
export function NewBoothForm({
  eventId,
  onCreated,
  onBulk,
}: {
  eventId: number;
  onCreated: () => Promise<unknown>;
  onBulk: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<BoothMode>("time");
  const [waitlist, setWaitlist] = useState(false);
  const [nums, setNums] = useState(DEFAULTS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const shown = mode === "time" ? TIME_KEYS : (["total_limit"] as NumKey[]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setAdding(true);
    try {
      const values = Object.fromEntries(shown.map((k) => [k, toNum(nums[k])]));
      await createBooth(eventId, { name: name.trim(), mode, use_waitlist: waitlist, ...values });
      setName("");
      await onCreated();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      // 칸에 붙지 못하는 오류는 폼 위에 보여 준다.
      const visible = ["name", "mode", "use_waitlist", ...shown];
      if (!Object.keys(fields).some((k) => visible.includes(k))) setFormError(messageFor(err));
    } finally {
      setAdding(false);
    }
  }

  const numField = (k: NumKey, label: string, hint: string, min: number, max?: number) => (
    <TextField
      label={label}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={nums[k]}
      onChange={(e) => setNums({ ...nums, [k]: e.target.value })}
      error={errors[k]}
      hint={hint}
    />
  );

  return (
    <form onSubmit={add} noValidate aria-labelledby={titleId} className="space-y-4 rounded-lg border-2 border-rule bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="text-18 font-extrabold tracking-[-0.03em]">
          새 부스 만들기
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => void downloadBulkTemplate().catch(() => setFormError("양식을 만들지 못했어요. 다시 시도해 주세요."))}
          >
            엑셀 양식 내려받기
          </Button>
          <Button variant="secondary" onClick={onBulk}>
            엑셀로 일괄 등록
          </Button>
        </div>
      </div>
      {formError && <Notice tone="error">{formError}</Notice>}
      <TextField label="부스 이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Choice
          label="운영 방식"
          value={mode}
          onChange={setMode}
          error={errors.mode}
          options={[
            { value: "time", label: "타임별" },
            { value: "fcfs", label: "선착순" },
          ]}
        />
        <label className="flex min-h-11 items-center gap-3 text-15 font-bold">
          <input type="checkbox" checked={waitlist} onChange={(e) => setWaitlist(e.target.checked)} className="size-5 accent-ink" />
          대기 접수 받기
        </label>
      </div>
      {mode === "time" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {numField("start_hour", "시작 시각", "0~23 사이 정수", 0, 23)}
          {numField("end_hour", "종료 시각", "시작과 같거나 늦게", 0, 23)}
          {numField("slots_per_hour", "시간당 타임 수", "1~6", 1, 6)}
          {numField("limit_per_slot", "타임당 인원", "0이면 제한 없음", 0)}
        </div>
      ) : (
        <div className="max-w-60">{numField("total_limit", "선착순 인원", "0이면 제한 없음", 0)}</div>
      )}
      <Button type="submit" loading={adding} className="w-full">
        부스 추가
      </Button>
    </form>
  );
}
