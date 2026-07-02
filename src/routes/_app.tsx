import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "#/components/layout/AppShell";

// Pathless layout route: wraps every authenticated page with the sidebar,
// top bar, and auth/role guards. Child routes render inside AppShell's Outlet.
export const Route = createFileRoute("/_app")({ component: AppShell });
