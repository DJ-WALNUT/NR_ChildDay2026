import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { adminKeys, deleteEvent, removeEventLogo, updateEvent, uploadEventLogo } from "../../api/admin";
import { fieldErrors, messageFor } from "../../api/messages";
import { Button, ConfirmDialog, Notice, TextAreaField, TextField } from "../../ui";
import { useAuth } from "../auth/AuthProvider";
import LogoField from "../LogoField";
import { orgHomePath } from "../paths";
import type { EventTabProps } from "./EventPage";

const NOTICE_MAX = 500;

/** 한 줄에 하나씩 쓴 선택지. 빈 줄은 뺀다. */
const parseOptions = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function Settings({ event, org }: EventTabProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState(event.name);
  const [notice, setNotice] = useState(event.notice ?? "");
  const [ageLabel, setAgeLabel] = useState(event.age_label);
  const [ageText, setAgeText] = useState(event.age_options.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.event(event.id) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.events(org.id) }),
    ]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    const label = ageLabel.trim();
    const options = parseOptions(ageText);
    try {
      await updateEvent(event.id, {
        name: name.trim(),
        notice: notice.trim() === "" ? null : notice,
        ...(label !== event.age_label && { age_label: label }),
        ...(options.join("\n") !== event.age_options.join("\n") && { age_options: options }),
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setSaveError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteEvent(event.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.overview(org.id) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.events(org.id) }),
      ]);
      navigate(user ? orgHomePath(user, org.id) : "/manage");
    } catch (err) {
      setConfirming(false);
      setDeleteError(messageFor(err));
      setDeleting(false);
    }
  }

  const tooLong = notice.length > NOTICE_MAX;

  return (
    <div className="max-w-xl space-y-8">
      <form onSubmit={save} className="space-y-4">
        <TextField label="행사 이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextAreaField
          label="안내 문구"
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          error={errors.notice ?? (tooLong ? `${NOTICE_MAX}자까지 쓸 수 있어요.` : undefined)}
          hint="방문객 신청 화면에 보여요. 비우면 보이지 않아요."
        />
        <p className="text-right text-13 tabular-nums text-muted">
          {notice.length}/{NOTICE_MAX}
        </p>
        <TextField
          label="연령대 항목 이름"
          value={ageLabel}
          maxLength={20}
          onChange={(e) => setAgeLabel(e.target.value)}
          error={errors.age_label}
          hint="신청 화면, 실적, 엑셀에 이 이름으로 보여요. 예: 학년, 소속"
        />
        <TextAreaField
          label="연령대 선택지"
          value={ageText}
          style={{ height: "auto" }}
          rows={8}
          onChange={(e) => setAgeText(e.target.value)}
          error={errors.age_options}
          hint="한 줄에 하나씩 써 주세요. 이미 받은 신청의 값은 바뀌지 않고, 고치거나 뺀 선택지는 실적에 '이전 선택지'로 따로 보여요."
        />
        {saveError && <Notice tone="error">{saveError}</Notice>}
        {saved && <Notice tone="info">저장했어요.</Notice>}
        <Button type="submit" loading={saving} disabled={tooLong}>
          저장
        </Button>
      </form>

      <LogoField
        label="행사 로고"
        logoUrl={event.logo_url}
        upload={(file) => uploadEventLogo(event.id, file)}
        remove={() => removeEventLogo(event.id)}
        onChanged={() => void refresh()}
      />

      <section aria-labelledby="event-delete" className="space-y-2 border-t-2 border-muted pt-4">
        <h2 id="event-delete" className="text-18 font-extrabold">
          행사 삭제
        </h2>
        <p className="text-15">행사를 지우면 부스와 신청 기록도 함께 지워져요.</p>
        {deleteError && <Notice tone="error">{deleteError}</Notice>}
        <Button variant="danger" onClick={() => setConfirming(true)}>
          행사 삭제
        </Button>
      </section>

      <ConfirmDialog
        open={confirming}
        title="행사를 삭제할까요?"
        body={`부스 ${event.booth_count}개와 모든 신청이 함께 지워져요. 되돌릴 수 없어요.`}
        confirmLabel="삭제"
        danger
        requireText={event.name}
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

/** 행사가 바뀔 때만 입력란을 새로 채운다(다시 받아온 값이 쓰던 글을 덮지 않게). */
export default function SettingsTab(props: EventTabProps) {
  return <Settings key={props.event.id} {...props} />;
}
