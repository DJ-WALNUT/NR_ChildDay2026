import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeys, updateSuperOrg } from "../../api/admin";
import { ApiError } from "../../api/client";
import { fieldErrors, messageFor } from "../../api/messages";
import type { SuperOrg } from "../../api/types";
import { Button, ConfirmDialog, Modal, Notice, TextField } from "../../ui";

/** 기관 이름·주소 수정. 주소(slug)가 바뀌면 방문객 주소가 끊기므로 한 번 더 확인한다. */
export function OrgEditDialog({ org, onClose }: { org: SuperOrg; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: { name?: string; slug?: string }) => updateSuperOrg(org.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.superOrgs() });
      onClose();
    },
    onError: (err) => {
      setConfirming(false);
      const fields = fieldErrors(err);
      if (err instanceof ApiError && err.code === "slug_taken") fields.slug = messageFor(err);
      setErrors(fields);
      setFormError(Object.keys(fields).length === 0 ? messageFor(err) : null);
    },
  });

  const nextName = name.trim();
  const nextSlug = slug.trim();
  const slugChanged = nextSlug !== org.slug;

  function send() {
    const body: { name?: string; slug?: string } = {};
    if (nextName !== org.name) body.name = nextName;
    if (slugChanged) body.slug = nextSlug;
    if (Object.keys(body).length === 0) onClose();
    else save.mutate(body);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    if (slugChanged) setConfirming(true);
    else send();
  }

  if (confirming) {
    return (
      <ConfirmDialog
        open
        danger
        title="주소를 바꿀까요?"
        body="기존 방문객 주소와 QR이 끊겨요. 이미 나눠 준 QR과 링크는 더 이상 열리지 않아요."
        confirmLabel="주소 바꾸기"
        busy={save.isPending}
        onConfirm={send}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <Modal title="기관 수정" onClose={onClose} width="md">
      <form onSubmit={submit} className="mt-3 space-y-3">
        {formError && <Notice tone="error">{formError}</Notice>}
        <TextField label="기관 이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <TextField
          label="기관 주소"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          error={errors.slug}
          hint="영문 소문자·숫자·- 2~32자"
          autoComplete="off"
          required
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" loading={save.isPending}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
