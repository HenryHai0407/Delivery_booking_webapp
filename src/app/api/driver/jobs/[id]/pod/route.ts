import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId: actorUserId } = await requireRole("driver");
    const body = (await req.json()) as {
      objectKey?: string;
      storageUrl?: string;
      notes?: string;
    };

    if (!body.objectKey || !body.storageUrl) {
      return NextResponse.json({ error: "Missing objectKey or storageUrl" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const pod = await prisma.pod.upsert({
      where: { bookingId: id },
      update: { notes: body.notes || undefined },
      create: {
        bookingId: id,
        notes: body.notes
      }
    });

    const existingPhoto = await prisma.podPhoto.findFirst({
      where: {
        podId: pod.id,
        objectKey: body.objectKey
      },
      select: { id: true }
    });

    if (existingPhoto) {
      return NextResponse.json({ podId: pod.id, photoId: existingPhoto.id, deduplicated: true });
    }

    const photo = await prisma.podPhoto.create({
      data: {
        podId: pod.id,
        objectKey: body.objectKey,
        storageUrl: body.storageUrl
      }
    });

    await prisma.bookingEvent.create({
      data: {
        bookingId: id,
        actorUserId,
        eventType: "pod_uploaded",
        payloadJson: JSON.stringify({
          objectKey: body.objectKey,
          photoId: photo.id,
          storageUrl: body.storageUrl
        })
      }
    });

    return NextResponse.json({ podId: pod.id, photoId: photo.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
