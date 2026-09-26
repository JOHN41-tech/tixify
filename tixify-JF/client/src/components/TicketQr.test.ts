import { describe, expect, it } from "vitest";
import QRCode from "qrcode";

describe("ticket QR payload", () => {
  it("encodes a public ticket code as a data URL", async () => {
    const dataUrl = await QRCode.toDataURL("tixify://ticket/TIX-DEMO-123");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});
