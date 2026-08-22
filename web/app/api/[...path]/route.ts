import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function backendUrl(): string {
  const url = process.env.INTERNAL_API_URL;
  if (url) {
    return url.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8080";
  }
  throw new Error("INTERNAL_API_URL is required when running the web service in production");
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const { path } = await context.params;
    const target = new URL(`/api/${path.join("/")}`, backendUrl());
    target.search = request.nextUrl.search;

    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }

    const method = request.method;
    const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
    const response = await fetch(target, { method, headers, body, cache: "no-store" });
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");
    if (responseContentType) {
      responseHeaders.set("content-type", responseContentType);
    }
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return Response.json({ message: "The API service is unavailable." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
