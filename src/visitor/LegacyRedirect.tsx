import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getBoothHome } from "../api/public";
import { NotFound, PageFrame, Spinner } from "../ui";

export default function LegacyRedirect({ to }: { to: "reserve" | "check" }) {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!boothId) return;
    let alive = true;
    getBoothHome(boothId).then(
      ({ slug }) => {
        if (alive) navigate(`/${slug}/${to}/${boothId}`, { replace: true });
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [boothId, to, navigate]);

  if (!boothId) return <Navigate to="/" replace />;
  return (
    <PageFrame surface="ink" width="narrow">
      {failed ? <NotFound title="부스를 찾을 수 없어요" /> : <Spinner />}
    </PageFrame>
  );
}
