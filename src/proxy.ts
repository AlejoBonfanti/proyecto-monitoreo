/**
 * Chequeo optimista de sesión (solo lee la cookie, no llama a la API).
 * La verificación real está en `features/auth/dal.ts` y en la API.
 */
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/features/auth/session-token";

const RUTAS_PUBLICAS = ["/login"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esPublica = RUTAS_PUBLICAS.includes(pathname);
  const sesion = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value);

  if (!esPublica && !sesion) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("desde", pathname);
    return NextResponse.redirect(url);
  }
  if (esPublica && sesion) return NextResponse.redirect(new URL("/", req.nextUrl));
  return NextResponse.next();
}

export const config = {
  // Todo menos assets estáticos, imágenes optimizadas e íconos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
