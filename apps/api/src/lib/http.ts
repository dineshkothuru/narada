// Services throw this to say "this is the client's fault, and here is the
// status". app.ts's error handler already forwards error.statusCode and
// error.message, so a thrown HttpError becomes its intended response with no
// per-route try/catch.
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
