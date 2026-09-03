// Pure URL building for table QR codes, kept separate from the page so it
// can be unit tested without rendering or mocking the QR image library.
export function tableQrUrl(origin: string, code: string): string {
  return `${origin}/t/${code}`;
}
