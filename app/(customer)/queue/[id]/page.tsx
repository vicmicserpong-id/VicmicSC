import { TicketView } from "./ticket-view";

export const metadata = {
  title: "Tiket Antrean",
};

export default async function QueueTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketView id={id} />;
}
