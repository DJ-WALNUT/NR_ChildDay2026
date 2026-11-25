import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { ApiError } from "../api/client";
import { fieldErrors, messageFor } from "../api/messages";
import { getBoothPage, publicKeys, reserve } from "../api/public";
import { isTimeAvailability } from "../api/types";
import type { Gender } from "../api/types";
import { normalizeCode, normalizeName } from "../lib/identity";
import { compareSlots, slotParts } from "../lib/slots";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { saveTicket } from "../lib/ticketStore";
import { Button, Choice, Notice, PageFrame, SelectField, Spinner, Stamp, TextField, Ticket } from "../ui";
import { QueryFailure, VisitorFrame } from "./BrandHeader";
import { BigLink } from "./BigLink";
import { TicketHeader } from "./TicketCard";

type Errors = Partial<Record<"name" | "code" | "gender" | "age_group" | "slot" | "agree", string>>;

// 화면에 보이는 순서대로 첫 오류 칸을 찾아 포커스한다.
const FOCUS_ORDER = ["slot", "name", "gender", "age_group", "code", "agree"] as const;

function focusFirstInvalid(form: HTMLFormElement | null, errs: Errors) {
  const key = FOCUS_ORDER.find((k) => errs[k]);
  if (!key || !form) return;
  const holder = form.querySelector<HTMLElement>(`[data-field="${key}"]`);
  const el =
    holder?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]:not([disabled])') ??
    holder?.querySelector<HTMLElement>('[role="radio"]:not([disabled])') ??
    holder?.querySelector<HTMLElement>("input, select");
  el?.focus();
  el?.scrollIntoView?.({ block: "center" });
}

export default function ReservePage() {
  const { slug = "", boothId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: publicKeys.booth(slug, boothId),
    queryFn: () => getBoothPage(slug, boothId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageChoice, setAge] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<{ err: unknown; who: { name: string; code: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  useDocumentTitle(q.data ? `${q.data.booth.name} 신청 · ${q.data.org.name}` : null);

  if (q.isError && !q.data) return <QueryFailure error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) {
    return (
      <PageFrame surface="ink" width="narrow">
        <Spinner />
      </PageFrame>
    );
  }
  const { org, event, booth, availability } = q.data;
  // 작성 중에 주최 측이 선택지를 바꾸면 사라진 값은 다시 고르게 한다.
  const age = event.age_options.includes(ageChoice) ? ageChoice : "";
  const isTime = booth.mode === "time" && isTimeAvailability(availability);
  const closed = !booth.is_active || availability.is_closed;

  const frame = (children: ReactNode) => (
    <VisitorFrame orgName={org.name} orgLogoUrl={org.logo_url} eventName={event.name} eventLogoUrl={event.logo_url}>
      <BigLink to={`/${slug}/check/${boothId}`} tone="solid">
        <Search aria-hidden className="size-5" />
        내 신청 확인
      </BigLink>
      {children}
    </VisitorFrame>
  );

  if (closed) {
    return frame(
      <Ticket tone="muted" header={<TicketHeader eventName={event.name} boothName={booth.name} />}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-15">지금은 신청을 받지 않아요.</p>
          <Stamp kind="closed" />
        </div>
        {event.notice && <p className="mt-3 text-13 break-words whitespace-pre-line text-muted">{event.notice}</p>}
        <Link to={`/${slug}`} className="mt-3 inline-block text-15 font-bold underline">
          다른 부스 보기
        </Link>
      </Ticket>,
    );
  }

  const slotOptions = isTime
    ? [...availability.slots]
        .sort((a, b) => compareSlots(a.label, b.label))
        .map((s) => {
          const parts = slotParts(s.label);
          const closedHint = booth.use_waitlist ? "대기" : "마감";
          return {
            value: s.label,
            label: s.label,
            hint: s.full ? closedHint : s.remaining === null ? "자리 여유" : `남은 ${s.remaining}자리`,
            disabled: s.full && !booth.use_waitlist,
            // 타임이 있는 부스는 시간별 줄로 묶어 칸을 짧게 보인다.
            ...(parts && {
              group: parts.hour,
              short: parts.tab,
              shortHint: s.full ? closedHint : s.remaining === null ? "여유" : String(s.remaining),
            }),
          };
        })
    : [];
  const timetable = slotOptions.some((o) => o.group !== undefined);

  async function submit() {
    const next: Errors = {};
    const n = normalizeName(name);
    const c = normalizeCode(code);
    if (!n.ok) next.name = n.message;
    if (!c.ok) next.code = c.message;
    if (!gender) next.gender = "성별을 선택해 주세요.";
    if (!age) next.age_group = `${event.age_label} 항목을 선택해 주세요.`;
    if (isTime && !slot) next.slot = "시간을 선택해 주세요.";
    if (!agree) next.agree = "신청에 동의해 주세요.";
    setErrors(next);
    setSubmitError(null);
    if (Object.keys(next).length > 0) focusFirstInvalid(formRef.current, next);
    if (!n.ok || !c.ok || !gender || !age || (isTime && !slot) || !agree) return;

    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await reserve(boothId, {
        name: n.value,
        code: c.value,
        gender,
        age_group: age,
        ...(isTime && slot ? { slot } : {}),
      });
      saveTicket({ booth_id: Number(boothId), slug, name: n.value, code: c.value, slot: res.slot, status: res.status });
      // 같은 사람의 옛 조회 결과가 캐시에 남아 있으면 새 신청 대신 보이므로 지운다.
      qc.removeQueries({ queryKey: ["public", "lookup", boothId, n.value, c.value] });
      navigate(`/${slug}/check/${boothId}`, {
        state: {
          reserved: {
            name: n.value,
            code: c.value,
            slot: res.slot,
            status: res.status,
            booth_name: booth.name,
            at: Date.now(),
          },
        },
      });
    } catch (err) {
      setSubmitError({ err, who: { name: n.value, code: c.value } });
      const server = fieldErrors(err) as Errors;
      setErrors(server);
      if (server.age_group) void q.refetch(); // 그사이 바뀐 선택지를 받아 온다
      focusFirstInvalid(formRef.current, server);
      if (err instanceof ApiError && err.status === 409 && (err.code === "full" || err.code === "closed")) {
        void q.refetch().then((r) => {
          const a = r.data?.availability;
          if (a && isTimeAvailability(a) && a.slots.some((s) => s.label === slot && s.full)) setSlot(null);
        });
      }
      setBusy(false);
      inFlight.current = false;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  const err = submitError?.err;
  const duplicate = err instanceof ApiError && err.code === "duplicate";
  const retryable = err instanceof ApiError && (err.status === 0 || err.status >= 500);
  const errorCount = Object.values(errors).filter(Boolean).length;

  return frame(
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      <Ticket header={<TicketHeader eventName={event.name} boothName={booth.name} />}>
        <div className="space-y-4">
          {event.notice && <p className="text-13 break-words whitespace-pre-line text-muted">{event.notice}</p>}
          {isTime ? (
            <div data-field="slot">
              <Choice
                label="시간 선택"
                note={timetable ? "숫자는 남은 자리예요" : undefined}
                value={slot}
                options={slotOptions}
                onChange={setSlot}
                error={errors.slot}
              />
              {timetable && slot && <p className="mt-2 text-15 font-bold">선택한 시간: {slot}</p>}
            </div>
          ) : (
            <>
              <p className="text-15 font-bold">현장 선착순으로 입장해요.</p>
              {booth.use_waitlist && !isTimeAvailability(availability) && availability.full && (
                <Notice tone="info">정원이 다 찼어요. 지금 신청하면 대기자로 접수돼요.</Notice>
              )}
            </>
          )}
          <div data-field="name">
          <TextField
            label="참가자 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            error={errors.name}
          />
          </div>
          <div data-field="gender">
            <Choice
              label="성별"
              value={gender}
              options={[
                { value: "남", label: "남" },
                { value: "여", label: "여" },
              ]}
              onChange={setGender}
              error={errors.gender}
            />
          </div>
          <div data-field="age_group">
          <SelectField
            label={event.age_label}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            options={[{ value: "", label: "선택해 주세요" }, ...event.age_options.map((a) => ({ value: a, label: a }))]}
            error={errors.age_group}
          />
          </div>
          <div data-field="code">
          <TextField
            label="식별번호"
            hint="다음에 신청을 확인할 때 쓰는 숫자 4자리예요."
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
          />
          </div>
          <div data-field="agree">
            <label className="flex min-h-11 items-center gap-3 text-15 font-bold">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                aria-invalid={errors.agree ? true : undefined}
                aria-describedby={errors.agree ? "agree-error" : undefined}
                className="size-5 accent-ink"
              />
              위 체험부스를 신청합니다
            </label>
            {errors.agree && (
              <p id="agree-error" className="text-13 font-bold">
                {errors.agree}
              </p>
            )}
          </div>
          {submitError && (
            <Notice
              tone="error"
              action={retryable ? { label: "다시 시도", onClick: () => void submit() } : undefined}
            >
              {messageFor(err)}
              {duplicate && (
                <>
                  {" "}
                  <Link
                    to={`/${slug}/check/${boothId}`}
                    state={{ reserved: submitError.who }}
                    className="font-bold underline"
                  >
                    내 신청 확인
                  </Link>
                </>
              )}
            </Notice>
          )}
          {errorCount > 0 && <p role="alert" className="text-13 font-bold">입력 내용을 확인해 주세요 ({errorCount}곳)</p>}
          <Button type="submit" size="lg" loading={busy} className="w-full">
            신청하기
          </Button>
        </div>
      </Ticket>
    </form>,
  );
}
