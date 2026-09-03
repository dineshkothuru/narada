// one file per resource (orders.ts, session.ts, ...); components import hooks
// only, never api() directly
export { ApiError } from "../client";
export * from "./health";
export * from "./me";
export * from "./auth";
export * from "./kitchen";
export * from "./floor";
export * from "./bill";
