import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthProvider } from "#/lib/auth/auth";
import { StoreProvider } from "#/lib/store/store";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{ title: "611 Ministry Funding" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			// Brand tab icon (the Coins mark). SVG is honoured by all modern
			// browsers; overrides the default /favicon.ico fallback.
			{ rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<AuthProvider>
					<StoreProvider>{children}</StoreProvider>
				</AuthProvider>
				<Scripts />
			</body>
		</html>
	);
}
