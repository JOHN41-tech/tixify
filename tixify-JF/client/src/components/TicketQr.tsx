import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function TicketQr({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: size, color: { dark: "#171814", light: "#ddff5a" } })
      .then((dataUrl) => { if (active) setSrc(dataUrl); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [size, value]);

  if (error) return <div className="grid aspect-square w-full place-items-center rounded-2xl bg-[#ddff5a] p-4 text-center text-xs font-semibold text-[#171814]">QR unavailable<br />Use code {value}</div>;
  if (!src) return <div className="aspect-square w-full animate-pulse rounded-2xl bg-[#ddff5a]/60" aria-label="Generating QR code" />;
  return <img src={src} width={size} height={size} alt={`Scannable ticket QR code for ${value}`} className="h-auto w-full rounded-2xl bg-[#ddff5a] p-3" />;
}
