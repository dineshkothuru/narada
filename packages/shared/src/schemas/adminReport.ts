import { z } from "zod";

export const adminReportQuerySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>;

export type AdminReport = {
  day: string;
  bills: number;
  covers: number;
  gross: number;
  discount: number;
  gst: number;
  service: number;
  tips: number;
  net: number;
  averageBill: number;
  byMethod: { method: string; count: number; amount: number }[];
  collected: number;
  variance: number;
};
