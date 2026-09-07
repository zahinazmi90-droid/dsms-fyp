import { NextResponse } from "next/server";

export function handleApiError(err: unknown) {
  if (err instanceof Error) {
    if (err.name === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Sila log masuk semula." }, { status: 401 });
    }
    if (err.name === "FORBIDDEN") {
      return NextResponse.json({ error: "Anda tidak mempunyai akses." }, { status: 403 });
    }
  }
  console.error(err);
  return NextResponse.json({ error: "Ralat sistem. Sila cuba lagi." }, { status: 500 });
}
