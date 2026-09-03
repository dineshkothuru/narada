// Pure URL building for table QR codes, kept separate from the page so it
// can be unit tested without rendering or mocking the QR image library.
export function tableQrUrl(origin: string, outletSlug: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/outlet/${encodeURIComponent(outletSlug)}/table/${encodeURIComponent(code)}`;
}
