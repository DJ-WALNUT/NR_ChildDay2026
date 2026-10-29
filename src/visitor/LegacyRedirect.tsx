import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { messageFor } from "../api/messages";
import { getBoothHome } from "../api/public";
import { Notice, NotFound, PageFrame, Spinner } from "../ui";

export default function LegacyRedirect({ to }: { to: "reserve" | "check" }) {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<{ err: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!boothId) return;
    let alive = true;
    getBoothHome(boothId).then(
      ({ slug }) => {
        if (alive) navigate(`/${slug}/${to}/${boothId}`, { replace: true });
      },
      (err) => {
        if (alive) setFailure({ err });
      },
    );
    return () => {
      alive = false;
    };
  }, [boothId, to, navigate, attempt]);

  if (!boothId) return <Navigate to="/" replace />;
  return (
    <PageFrame surface="ink" width="narrow">
      {failure === null ? (
        <Spinner />
      ) : failure.err instanceof ApiError && failure.err.status === 404 ? (
        <NotFound title="부스를 찾을 수 없어요" />
      ) : (
        <Notice
          tone="error"
          action={{
            label: "다시 시도",
            onClick: () => {
              setFailure(null);
              setAttempt((n) => n + 1);
            },
          }}
        >
          {messageFor(failure.err)}
        </Notice>
      )}
    </PageFrame>
  );
}
