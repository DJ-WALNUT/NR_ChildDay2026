import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { messageFor } from "../api/messages";
import { cancel, getBoothPage, lookup, publicKeys } from "../api/public";
import type { ReservationStatus } from "../api/types";
import { normalizeCode, normalizeName } from "../lib/identity";
import { clearTicket, loadTicket } from "../lib/ticketStore";
import { Button, ConfirmDialog, Notice, PageFrame, Spinner, TextField } from "../ui";
import { QueryFailure, VisitorFrame } from "./BrandHeader";
import { TicketCard } from "./TicketCard";

interface Identity {
  name: string;
  code: string;
}
interface ReservedState {
  reserved?: { name: string; code: string; status: ReservationStatus };
}

export default function CheckPage() {
  const { slug = "", boothId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const reserved = (location.state as ReservedState | null)?.reserved;
  const [identity, setIdentity] = useState<Identity | null>(() => {
    if (reserved) return { name: reserved.name, code: reserved.code };
    const t = loadTicket(Number(boothId));
    return t ? { name: t.name, code: t.code } : null;
  });
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
  const found = useQuery({
    queryKey: ["public", "lookup", boothId, identity?.name, identity?.code],
    queryFn: () => lookup(boothId, identity!),
    enabled: identity !== null && !cancelled,
  });

  const notFound = found.error instanceof ApiError && found.error.status === 404;
  // 보관·이동 상태의 신청이 서버에 없으면 둘 다 비워 새로 고침해도 되살아나지 않게 한다.
  useEffect(() => {
    if (notFound) {
      clearTicket(Number(boothId));
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [notFound, boothId, navigate, location.pathname]);

  if (booth.isError) return <QueryFailure error={booth.error} onRetry={() => void booth.refetch()} />;
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
    if (n.ok && c.ok) setIdentity({ name: n.value, code: c.value });
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
      {!cancelled && found.isError && !notFound && (
        <Notice tone="error" action={{ label: "다시 시도", onClick: () => void found.refetch() }}>
          {messageFor(found.error)}
        </Notice>
      )}
      {!cancelled && notFound && <Notice tone="warn">신청 내역을 찾을 수 없어요.</Notice>}
      {!cancelled && identity && found.data && (
        <>
          {reserved?.status === "waiting" && found.data.status === "waiting" && (
            <Notice tone="info">대기자로 접수됐어요. 자리가 나면 입장할 수 있어요.</Notice>
          )}
          {cancelError !== null && <Notice tone="error">{messageFor(cancelError)}</Notice>}
          <TicketCard
            eventName={event.name}
            boothName={found.data.booth_name}
            name={found.data.name}
            slot={found.data.slot}
            status={found.data.status}
            notice={event.notice}
            onCancel={() => setConfirming(true)}
            onForget={forget}
          />
        </>
      )}
      {showForm && (
        <form onSubmit={onForm} noValidate className="on-paper space-y-4 rounded-lg bg-paper p-4 text-ink">
          <h1 className="text-18 font-extrabold">내 신청 확인</h1>
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
        onCancel={() => setConfirming(false)}
      />
    </VisitorFrame>
  );
}
