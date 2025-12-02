import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/mice(.*)",
  "/cohorts(.*)",
  "/subjects(.*)",
  "/experiments(.*)",
  "/settings(.*)",
  "/library(.*)",
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-up",
  "/onboarding(.*)",
  "/api/webhooks(.*)",
]);

// Routes that work without an org (user can see their personal data)
const isOrgOptionalRoute = createRouteMatcher([
  "/settings(.*)",
  "/organization(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId } = await auth();
  const url = req.nextUrl;

  // Intercept Clerk's organization selection task flow
  // Redirect to our custom onboarding instead
  if (url.pathname.includes("/tasks/choose-organization") || 
      url.pathname.includes("/tasks/create-organization")) {
    if (userId) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
  }

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect routes that need auth
  if (isProtectedRoute(req)) {
    if (!userId) {
      await auth.protect();
    }

    // Allow org-optional routes without an active org
    // This lets users access settings and manage their org membership
    if (isOrgOptionalRoute(req)) {
      return NextResponse.next();
    }

    // If user is signed in but has no org, redirect to onboarding
    // But allow query param to bypass (for users who want to see personal data)
    if (userId && !orgId) {
      const allowPersonal = url.searchParams.get("personal") === "true";
      if (!allowPersonal) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
