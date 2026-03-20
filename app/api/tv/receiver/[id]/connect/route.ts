import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectToDatabase, TvReceiverModel } from "@/lib/db";

const schema = z.object({
  connected: z.boolean(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { id } = await params;
  await connectToDatabase();

  const receiver = await TvReceiverModel.findById(id);
  if (!receiver || receiver.accountId !== session.user.accountId) {
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }

  receiver.statusNonce = crypto.randomUUID();
  receiver.statusRemoteConnected = parsed.data.connected;
  await receiver.save();

  return NextResponse.json({ ok: true });
}
