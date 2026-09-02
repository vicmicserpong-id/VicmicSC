import { PickupPanel } from "./pickup-panel";

export const metadata = { title: "Pengambilan Unit" };
export const dynamic = "force-dynamic";

export default async function PickupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <PickupPanel initialCode={code ?? ""} />;
}
