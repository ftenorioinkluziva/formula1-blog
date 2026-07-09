import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const GET = (req: Request) => toNextJsHandler(auth).GET(req)
export const POST = (req: Request) => toNextJsHandler(auth).POST(req)


