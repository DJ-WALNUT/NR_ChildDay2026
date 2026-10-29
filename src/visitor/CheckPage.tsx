import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { messageFor } from "../api/messages";
import { cancel, getBoothPage, lookup, publicKeys } from "../api/public";
import type { LookupResult, ReservationStatus } from "../api/types";
import { normalizeCode, normalizeName } from "../lib/identity";
import { clearTicket, loadTicket } from "../lib/ticketStore";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, ConfirmDialog, Notice, PageFrame, Spinner, TextField } from "../ui";
import { QueryFailure, VisitorFrame } from "./BrandHeader";
import { TicketCard } from "./TicketCard";

interface Identity {
  name: string;
  code: string;
}
interface ReservedState {
  /** slot·status·booth_name 이 모두 있으면(신청 직후) 조회 없이 그 값으로 입장권을 보인다. 없으면 조회한다. */
  reserved?: {
    name: string;
    code: string;
    slot?: string;
    status?: ReservationStatus;
    booth_name?: string;
    at?: number;
  };
}

const FRESH_MS = 60_000;

export default function CheckPage() {
  const { slug = "", boothId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const reserved = (location.state as ReservedState | null)?.reserved;
  const [stored] = useState(() => loadTicket(Number(boothId)));
  const [identity, setIdentity] = useState<Identity | null>(() => {
    if (reserved) return { name: reserved.name, code: reserved.code };
    return stored ? { name: stored.name, code: stored.code } : null;
  });
  useDocumentTitle("내 신청 확인");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; code?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [cancelled, setCancelled] = useState(false);

  const booth = useQuery({
    queryKey: publicKeys.booth(slug, boothId),
    queryFn: () => getBoothPage(slug, boothId),
  });
  // 신청 직후에는 신청 응답으로 입장권을 그대로 보인다(조회 API 는 요청 제한이 있어 바로 부르지 않는다).
  const seed: LookupResult | undefined =
    identity && reserved && reserved.slot && reserved.status && reserved.booth_name &&
    reserved.name === identity.name && reserved.code === identity.code
      ? { name: reserved.name, slot: reserved.slot, status: reserved.status, booth_name: reserved.booth_name }
      : undefined;
  const found = useQuery({
    queryKey: ["public", "lookup", boothId, identity?.name, identity?.code],
    queryFn: () => lookup(boothId, identity!),
    enabled: identity !== null && !cancelled,
    initialData: seed,
    initialDataUpdatedAt: seed ? reserved?.at : undefined,
    staleTime: seed ? FRESH_MS : 0,
  });

  const notFound = found.error instanceof ApiError && found.error.status === 404;
  // 보관·이동 상태의 신청이 서버에 없으면 둘 다 비워 새로 고침해도 되살아나지 않게 한다.
  useEffect(() => {
    if (notFound) {
      clearTicket(Number(boothId));
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [notFound, boothId, navigate, location.pathname]);

  // 신청 직후 이 화면으로 왔으면 제목(h1)으로 포커스를 옮겨 화면 전환을 알린다.
  const arrived = useRef(false);
  const ready = Boolean(found.data) && Boolean(booth.data);
  useEffect(() => {
    if (!reserved || !ready || arrived.current) return;
    arrived.current = true;
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [reserved, ready]);

  if (booth.isError && !booth.data) return <QueryFailure error={booth.error} onRetry={() => void booth.refetch()} />;
  if (!booth.data) {
    return (
      <PageFrame surface="ink" width="narrow">
        <Spinner />
      </PageFrame>
    );
  }
  const { org, event } = booth.data;

  function onForm(e: FormEvent) {
    e.preventDefault();
    const n = normalizeName(name);
    const c = normalizeCode(code);
    setFormErrors({ name: n.ok ? undefined : n.message, code: c.ok ? undefined : c.message });
    if (!n.ok || !c.ok) return;
    // 같은 사람으로 다시 확인하면 키가 그대로라 다시 조회하지 않으므로 직접 다시 부른다.
    if (notFound && identity && identity.name === n.value && identity.code === c.value) void found.refetch();
    else setIdentity({ name: n.value, code: c.value });
  }

  async function doCancel() {
    if (!identity || inFlight.current) return;
    inFlight.current = true;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancel(boothId, identity);
      clearTicket(Number(boothId));
      setCancelled(true);
      navigate(location.pathname, { replace: true, state: null });
    } catch (err) {
      setCancelError(err);
    }
    setConfirming(false);
    setCancelling(false);
    inFlight.current = false;
  }

  function forget() {
    clearTicket(Number(boothId));
    setIdentity(null);
    navigate(location.pathname, { replace: true, state: null });
  }

  const showForm = !cancelled && (identity === null || notFound);
  // 조회가 막혀도(요청 제한·네트워크) 이 기기에 보관한 입장권이 있으면 그것을 보인다.
  const savedAsResult: LookupResult | null =
    identity && stored && stored.slot && stored.status && stored.name === identity.name && stored.code === identity.code
      ? { name: stored.name, slot: stored.slot, status: stored.status, booth_name: booth.data.booth.name }
      : null;
  const shown = found.data ?? (found.isError && !notFound ? savedAsResult : null);
  const stale = found.isError && !notFound && shown !== null;

  return (
    <VisitorFrame orgName={org.name} orgLogoUrl={org.logo_url} eventName={event.name} eventLogoUrl={event.logo_url}>
      {cancelled && (
        <>
          <Notice tone="info">신청을 취소했어요.</Notice>
          <Link to={`/${slug}`} className="inline-block text-15 font-bold underline">
            다른 부스 보기
          </Link>
        </>
      )}
      {!cancelled && identity && found.isPending && <Spinner />}
      {!cancelled && stale && (
        <Notice tone="warn" action={{ label: "다시 시도", onClick: () => void found.refetch() }}>
          상태가 최신이 아닐 수 있어요.
        </Notice>
      )}
      {!cancelled && found.isError && !notFound && !stale && (
        <Notice tone="error" action={{ label: "다시 시도", onClick: () => void found.refetch() }}>
          {messageFor(found.error)}
        </Notice>
      )}
      {!cancelled && notFound && <Notice tone="warn">신청 내역을 찾을 수 없어요.</Notice>}
      {!cancelled && identity && shown && (
        <>
          {reserved?.status === "waiting" && shown.status === "waiting" && (
            <Notice tone="info">대기자로 접수됐어요. 자리가 나면 입장할 수 있어요.</Notice>
          )}
          {cancelError !== null && <Notice tone="error">{messageFor(cancelError)}</Notice>}
          <TicketCard
            eventName={event.name}
            boothName={shown.booth_name}
            name={shown.name}
            slot={shown.slot}
            status={shown.status}
            notice={event.notice}
            onCancel={() => setConfirming(true)}
            onForget={forget}
          />
        </>
      )}
      {showForm && (
        <form onSubmit={onForm} noValidate className="on-paper space-y-4 rounded-lg bg-paper p-4 text-ink">
          <h1 tabIndex={-1} className="text-18 font-extrabold">
            내 신청 확인
          </h1>
          <TextField
            label="참가자 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            error={formErrors.name}
          />
          <TextField
            label="식별번호"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={formErrors.code}
          />
          <Button type="submit" className="w-full">
            내 신청 확인
          </Button>
        </form>
      )}
      <ConfirmDialog
        open={confirming}
        title="신청을 취소할까요?"
        body="취소하면 자리가 다른 분께 돌아가요."
        confirmLabel="신청 취소하기"
        danger
        busy={cancelling}
        onConfirm={() => void doCancel()}
        onCancel={() => {
          if (!cancelling) setConfirming(false);
        }}
      />
    </VisitorFrame>
  );
}
