import "@/styles.css";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

type RootLayoutProps = { children: ReactNode };

export default async function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <meta name="description" content="An internet website!" />
      <link rel="icon" type="image/png" href="/images/favicon.png" />
      <TooltipProvider>{children}</TooltipProvider>
    </>
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  } as const;
};
