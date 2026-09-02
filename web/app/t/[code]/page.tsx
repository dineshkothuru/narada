import OrderExperience from "@/components/OrderExperience";

export default async function TablePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <OrderExperience tableCode={code} />;
}
