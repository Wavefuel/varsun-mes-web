import type { Metadata, Viewport } from "next";
import BottomNav from "@/components/BottomNav";
import FontDebugger from "@/components/FontDebugger";
import AppSplash from "@/components/AppSplash";
import { DataProvider } from "@/context/DataContext";
import AuthGuard from "@/components/AuthGuard";
import ErpHeartbeat from "@/components/ErpHeartbeat";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
	title: "Varsun MES",
	description: "Mobile Manufacturing Execution System",
	manifest: "/manifest.json",
	icons: {
		icon: [
			{ url: "/favicon/favicon-32x32.png", sizes: "32x32" },
			{ url: "/favicon/favicon-16x16.png", sizes: "16x16" },
		],
		shortcut: "/favicon/favicon.ico",
		apple: "/favicon/apple-touch-icon.png",
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Varsun MES",
	},
	formatDetection: {
		telephone: false,
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	themeColor: "#ffffff",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link
					href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Noto+Sans:wght@400;500;600;700&amp;display=swap"
					rel="stylesheet"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
					rel="stylesheet"
				/>
			</head>
			<body className="font-sans antialiased">
				<FontDebugger />
				<Toaster
					position="top-center"
					richColors
					closeButton
					toastOptions={{ duration: 5000, style: { borderRadius: "0px", width: "100%" } }}
					style={{ width: "90%", maxWidth: "440px" }}
				/>
				<DataProvider>
					<div className="mobile-wrapper relative bg-[#F8FAFB] min-h-screen shadow-2xl overflow-hidden max-w-[480px] w-full mx-auto">
						<AuthGuard />
						{/* <ErpHeartbeat /> */}
						<AppSplash />
						<div className="pb-20">{children}</div>
						<BottomNav />
						{/* Portal targets for pickers to ensure they appear on top */}
						<div id="picker-portal" />
						<div id="time-picker-portal-root" />
					</div>
				</DataProvider>
			</body>
		</html>
	);
}
