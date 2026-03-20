import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase, TvReceiverModel } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();

  const receiver = await TvReceiverModel.findById(id);
  if (!receiver || receiver.accountId !== session.user.accountId) {
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }

  receiver.lastSeenAt = new Date();
  await receiver.save();

  return NextResponse.json({ ok: true });
}
