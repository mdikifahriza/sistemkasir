import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildShiftTimeDate, hasShiftTimeOverlap, normalizeShiftTimeString } from '@/lib/shiftSchedule';
import { requireRole, requireSession } from '@/lib/serverAuth';

function validateShiftPayload(startTime: string, endTime: string) {
  const normalizedStart = normalizeShiftTimeString(startTime);
  const normalizedEnd = normalizeShiftTimeString(endTime);

  if (!normalizedStart || !normalizedEnd) {
    return { error: 'Format jam shift tidak valid. Gunakan format HH:mm.' };
  }

  if (normalizedStart === normalizedEnd) {
    return { error: 'Jam mulai dan jam selesai tidak boleh sama.' };
  }

  return {
    startTime: normalizedStart,
    endTime: normalizedEnd,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const shifts = await prisma.shift.findMany({
      orderBy: { startTime: 'asc' },
    });
    return NextResponse.json({ data: shifts });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memuat master shift' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) return roleError;

    const body = await req.json();
    const { shiftName, startTime, endTime, colorCode } = body;

    if (!shiftName || !startTime || !endTime) {
      return NextResponse.json({ error: 'Nama, jam mulai, dan jam selesai wajib diisi' }, { status: 400 });
    }

    const validated = validateShiftPayload(startTime, endTime);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const existingShifts = await prisma.shift.findMany({
      select: {
        id: true,
        shiftName: true,
        startTime: true,
        endTime: true,
      },
    });

    if (hasShiftTimeOverlap(existingShifts, validated)) {
      return NextResponse.json({ error: 'Jadwal shift bertabrakan dengan shift lain.' }, { status: 409 });
    }

    const startDate = buildShiftTimeDate(validated.startTime);
    const endDate = buildShiftTimeDate(validated.endTime);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Jam shift tidak dapat diproses.' }, { status: 400 });
    }

    const newShift = await prisma.shift.create({
      data: {
        shiftName,
        startTime: startDate,
        endTime: endDate,
        colorCode: colorCode || '#10b981',
        isActive: true,
      },
    });

    return NextResponse.json({ data: newShift });
  } catch (error) {
    console.error('[shift-master] POST error:', error);
    return NextResponse.json({ error: 'Gagal membuat shift' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) return roleError;

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID shift wajib diisi' }, { status: 400 });
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existingShift) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
    }

    const nextStartTime = updates.startTime ?? existingShift.startTime.toISOString();
    const nextEndTime = updates.endTime ?? existingShift.endTime.toISOString();
    const validated = validateShiftPayload(nextStartTime, nextEndTime);

    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const existingShifts = await prisma.shift.findMany({
      select: {
        id: true,
        shiftName: true,
        startTime: true,
        endTime: true,
      },
    });

    if (hasShiftTimeOverlap(existingShifts, validated, id)) {
      return NextResponse.json({ error: 'Jadwal shift bertabrakan dengan shift lain.' }, { status: 409 });
    }

    const startDate = buildShiftTimeDate(validated.startTime);
    const endDate = buildShiftTimeDate(validated.endTime);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Jam shift tidak dapat diproses.' }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      ...updates,
      startTime: startDate,
      endTime: endDate,
    };

    const updatedShift = await prisma.shift.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: updatedShift });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memperbarui shift' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) return roleError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID shift wajib diisi' }, { status: 400 });
    }

    await prisma.shift.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus shift (mungkin masih ada sesi terkait)' }, { status: 500 });
  }
}
