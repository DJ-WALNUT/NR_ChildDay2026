import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, deleteBooth, listEvents, listPartners, rotateBoothToken, updateBooth } from "../../api/admin";
import { messageFor } from "../../api/messages";
import type { Booth } from "../../api/types";
import type { BoothSource } from "../../booth/BoothSource";
import { Button, ConfirmDialog, Notice, SelectField } from "../../ui";

const NONE = "";

/** 소유 기관(또는 슈퍼관리자)만 보는 부스 동작: 행사 이동, 운영 단체 배정, 링크 재발급, 삭제. */
export function OwnerActions({ booth, source }: { booth: Booth; source: BoothSource }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const eventsQ = useQuery({ queryKey: adminKeys.events(booth.org_id), queryFn: () => listEvents(booth.org_id) });
  const partnersQ = useQuery({ queryKey: adminKeys.partners(booth.event_id), queryFn: () => listPartners(booth.event_id) });
  const [target, setTarget] = useState(NONE);
  // null 이면 서버 값을 그대로 보여준다(이동·저장 뒤에는 다시 서버 값으로 돌아간다).
  const [partnerSel, setPartnerSel] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = (eventsQ.data ?? []).filter((e) => e.id !== booth.event_id);
  const partnerValue = partnerSel ?? (booth.partner_id === null ? NONE : String(booth.partner_id));

  /** 행사 안 목록과 요약, 대시보드 수치가 함께 달라진다. 옮길 때는 옛 행사와 새 행사 모두. */
  const refreshAround = (eventIds: number[]) =>
    Promise.all([
      ...eventIds.flatMap((id) => [
        qc.invalidateQueries({ queryKey: adminKeys.booths(id) }),
        qc.invalidateQueries({ queryKey: adminKeys.event(id) }),
        qc.invalidateQueries({ queryKey: adminKeys.partners(id) }),
      ]),
      qc.invalidateQueries({ queryKey: adminKeys.overview(booth.org_id) }),
    ]);

  const move = useMutation({
    mutationFn: (eventId: number) => updateBooth(booth.id, { event_id: eventId }),
    onMutate: () => setError(null),
    onSuccess: async (_b, eventId) => {
      setMoving(false);
      setTarget(NONE);
      setPartnerSel(null);
      await Promise.all([qc.invalidateQueries({ queryKey: source.key }), refreshAround([booth.event_id, eventId])]);
    },
    onError: (err) => {
      setMoving(false);
      setError(messageFor(err));
    },
  });

  const assign = useMutation({
    mutationFn: (partnerId: number | null) => updateBooth(booth.id, { partner_id: partnerId }),
    onMutate: () => setError(null),
    onSuccess: async () => {
      setPartnerSel(null);
      await Promise.all([qc.invalidateQueries({ queryKey: source.key }), refreshAround([booth.event_id])]);
    },
    onError: (err) => setError(messageFor(err)),
  });

  const rotate = useMutation({
    mutationFn: () => rotateBoothToken(booth.id),
    onMutate: () => setError(null),
    onSuccess: async () => {
      setRotating(false);
      await qc.invalidateQueries({ queryKey: source.key });
    },
    onError: (err) => {
      setRotating(false);
      setError(messageFor(err));
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteBooth(booth.id),
    onMutate: () => setError(null),
    onSuccess: async () => {
      setDeleting(false);
      // 지운 부스의 콘솔 쿼리는 다시 받지 않는다(404). 목록·요약만 맞춘다.
      await refreshAround([booth.event_id]);
      navigate(`/manage/events/${booth.event_id}`);
    },
    onError: (err) => {
      setDeleting(false);
      setError(messageFor(err));
    },
  });

  const targetEvent = others.find((e) => String(e.id) === target);

  return (
    <section aria-labelledby="owner-actions" className="space-y-5 border-t-2 border-rule pt-6">
      <h2 id="owner-actions" className="text-18 font-extrabold tracking-[-0.03em]">
        부스 관리 도구
      </h2>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="space-y-2">
        {eventsQ.isSuccess && others.length === 0 ? (
          <p className="text-13 text-muted">옮길 수 있는 다른 행사가 없어요.</p>
        ) : (
          <SelectField
            label="이동할 행사"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={eventsQ.isPending}
            options={[
              { value: NONE, label: "행사를 골라 주세요" },
              ...others.map((e) => ({ value: String(e.id), label: e.name })),
            ]}
          />
        )}
        <Button variant="secondary" disabled={target === NONE} onClick={() => setMoving(true)}>
          행사 이동
        </Button>
      </div>

      <div className="space-y-2">
        <SelectField
          label="운영 단체"
          value={partnerValue}
          onChange={(e) => setPartnerSel(e.target.value)}
          disabled={partnersQ.isPending}
          options={[
            { value: NONE, label: "미배정" },
            ...(partnersQ.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
          ]}
        />
        <Button
          variant="secondary"
          loading={assign.isPending}
          disabled={partnerValue === (booth.partner_id === null ? NONE : String(booth.partner_id))}
          onClick={() => assign.mutate(partnerValue === NONE ? null : Number(partnerValue))}
        >
          운영 단체 배정
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setRotating(true)}>
          링크 재발급
        </Button>
        <Button variant="danger" onClick={() => setDeleting(true)}>
          부스 삭제
        </Button>
      </div>

      <ConfirmDialog
        open={moving}
        title="부스를 다른 행사로 옮길까요?"
        body={`"${booth.name}" 부스가 "${targetEvent?.name ?? ""}" 행사로 옮겨져요. 운영 단체 배정이 해제돼요.`}
        confirmLabel="이동"
        busy={move.isPending}
        onConfirm={() => targetEvent && move.mutate(targetEvent.id)}
        onCancel={() => !move.isPending && setMoving(false)}
      />
      <ConfirmDialog
        open={rotating}
        title="링크를 다시 발급할까요?"
        body="지금 쓰는 부스 관리 링크와 QR은 더 이상 쓸 수 없어요. 새 링크를 다시 나눠 주세요."
        confirmLabel="재발급"
        danger
        busy={rotate.isPending}
        onConfirm={() => rotate.mutate()}
        onCancel={() => !rotate.isPending && setRotating(false)}
      />
      <ConfirmDialog
        open={deleting}
        title="부스를 삭제할까요?"
        body="신청 명단까지 모두 삭제되고 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        requireText={booth.name}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => !remove.isPending && setDeleting(false)}
      />
    </section>
  );
}
