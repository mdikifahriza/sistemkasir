import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2, deleteFromR2, getFromR2 } from '@/lib/r2';
import { requireRole, requireSession } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Path wajib diisi' }, { status: 400 });
    }

    const response = await getFromR2(path);

    if (!response.Body) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
    }

    // Convert stream to buffer
    const bytes = await response.Body.transformToByteArray();
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);

    return new NextResponse(body, {
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Image Fetch Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil gambar' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) {
      return roleError;
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const rawPathPrefix = formData.get('pathPrefix');
    const pathPrefix =
      typeof rawPathPrefix === 'string' && rawPathPrefix.trim()
        ? rawPathPrefix.trim().replace(/[^a-zA-Z0-9/_-]/g, '')
        : 'general';

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;

    const upload = await uploadToR2(buffer, fileName, file.type);

    return NextResponse.json({ 
      data: {
        path: upload.fileName,
        publicUrl: upload.publicUrl
      } 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload gagal diproses';
    console.error('Upload Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) {
      return roleError;
    }

    const { path } = await req.json();
    if (!path) return NextResponse.json({ error: 'Path wajib diisi' }, { status: 400 });

    await deleteFromR2(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
