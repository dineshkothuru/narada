import OrderExperience from "@/components/OrderExperience";
import { fetchMenu } from "@/lib/menu";

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const menu = await fetchMenu(code);
  return <OrderExperience tableCode={code} menu={menu} />;
}
