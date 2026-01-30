import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage, getAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const path = formData.get("path") as string;
    const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];

    if (!file || !path) {
      return NextResponse.json({ error: "File and path are required" }, { status: 400 });
    }

    // Optional: Verify Auth Token
    if (idToken) {
        try {
            await getAdminAuth().verifyIdToken(idToken);
        } catch (e) {
            console.error("Token verification failed:", e);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getAdminStorage().bucket();
    const fileRef = bucket.file(path);

    await fileRef.save(buffer, {
      contentType: file.type,
      metadata: {
        metadata: {
            originalName: file.name
        }
      }
    });

    // Make it public or get a signed URL?
    // Usually for client-side usage we want it to be accessible via the standard SDK or signed URL.
    // But since the client SDK uses the same bucket, it should be fine.
    
    // We can return some metadata
    return NextResponse.json({ success: true, path });

  } catch (error: any) {
    console.error("Server upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed on server" },
      { status: 500 }
    );
  }
}
