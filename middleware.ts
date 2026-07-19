import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Rafraîchit la session Supabase et protège les routes de l'app.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path === "/register";

  // Non connecté hors page d'auth -> login
  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Connecté sur /login -> app. On NE redirige PAS depuis /register : un utilisateur
  // connecté sans cabinet doit pouvoir y accéder pour en créer un (sinon boucle).
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/accueil", request.url));
  }

  return response;
}

export const config = {
  // Exclut les assets statiques (fichiers avec extension : .png, .webmanifest,
  // sw.js, favicon…) et l'API de transcription, pour ne pas les rediriger vers /login.
  matcher: ["/((?!_next/static|_next/image|api/transcribe|.*\\..*).*)"],
};
