import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage, getAdminAuth } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Security check: Verify the user is authenticated
  let token = request.headers.get("Authorization")?.split("Bearer ")[1];
  
  if (!token) {
    token = searchParams.get("token") || undefined;
  }

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = getAdminAuth();
    await auth.verifyIdToken(token);
  } catch (error) {
    console.error("Token verification failed:", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const file = bucket.file(path);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || "application/pdf";

    // Create a stream from the file
    const stream = file.createReadStream();

    // Convert Node.js ReadableStream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.split('/').pop()}"`,
      },
    });
  } catch (error: any) {
    console.error("Proxy download failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
