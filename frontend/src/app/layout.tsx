import type { Metadata } from "next";
import "tailwindcss";
import Navbar from "../../components/Navbar";
import { Toaster } from "react-hot-toast";
import './globals.css'
import {AppProvider} from "../../context/AppProvider";
export const metadata: Metadata = {
  title: "Bus Ticket App",
  description: "Welcome Our Bus Station",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
     <AppProvider>
         <Toaster />
         <Navbar />
         {children}
     </AppProvider>
      </body>
    </html>
  );
}
