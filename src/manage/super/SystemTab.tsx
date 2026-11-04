import { useState } from "react";
import { downloadBackup, whoamiIp } from "../../api/admin";
import { messageFor } from "../../api/messages";
import { downloadBlob } from "../../lib/download";
import { formatKst } from "../../lib/excel";
import { Button, Notice } from "../../ui";

/** nrbooth-backup-YYYYMMDD-HHmm.db (KST). 서버가 Content-Disposition 을 노출하지 않아 프론트에서 만든다. */
function backupFileName(): string {
  const digits = formatKst(Math.floor(Date.now() / 1000)).replace(/\D/g, "");
  return `nrbooth-backup-${digits.slice(0, 8)}-${digits.slice(8, 12)}.db`;
}

type Ip = { remote_addr: string | null; x_forwarded_for: string | null };

export default function SystemTab() {
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [ip, setIp] = useState<Ip | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);

  async function backup() {
    setBackupError(null);
    setBackingUp(true);
    try {
      downloadBlob(await downloadBackup(), backupFileName(), "application/octet-stream");
    } catch (err) {
      setBackupError(messageFor(err));
    } finally {
      setBackingUp(false);
    }
  }

  async function checkIp() {
    setIpError(null);
    setChecking(true);
    try {
      setIp(await whoamiIp());
    } catch (err) {
      setIp(null);
      setIpError(messageFor(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-18 font-extrabold tracking-[-0.03em]">데이터베이스 백업</h2>
        <p className="text-15">서버의 전체 데이터를 .db 파일 하나로 내려받아요.</p>
        {backupError && <Notice tone="error">{backupError}</Notice>}
        <Button loading={backingUp} onClick={() => void backup()}>
          백업 내려받기
        </Button>
      </section>
      <section className="space-y-3">
        <h2 className="text-18 font-extrabold tracking-[-0.03em]">접속 IP</h2>
        <p className="text-15">서버가 보는 내 접속 주소예요. 방문객 신청 제한이 이 값을 기준으로 해요.</p>
        {ipError && <Notice tone="error">{ipError}</Notice>}
        <Button variant="secondary" loading={checking} onClick={() => void checkIp()}>
          접속 IP 확인
        </Button>
        {ip && (
          <dl className="space-y-2">
            <div>
              <dt className="text-13 font-bold">접속 주소</dt>
              <dd className="break-all text-15 tabular-nums">{ip.remote_addr ?? "없음"}</dd>
            </div>
            <div>
              <dt className="text-13 font-bold">전달된 주소(X-Forwarded-For)</dt>
              <dd className="break-all text-15 tabular-nums">{ip.x_forwarded_for ?? "없음"}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}
