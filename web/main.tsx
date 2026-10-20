/** The web channel: a chat app served by the Worker's static assets, talking to the HTTP channel. */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from "@/lib/api";
import { Chat } from "./chat";
import { SignIn } from "./sign-in";
import "./styles.css";

const dark = matchMedia("(prefers-color-scheme: dark)");
const theme = () => document.documentElement.classList.toggle("dark", dark.matches);
dark.addEventListener("change", theme);
theme();

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem("session") ?? "null") } catch { return null }
  });
  const signIn = (s: Session | null) => {
    if (s) localStorage.setItem("session", JSON.stringify(s));
    else localStorage.removeItem("session");
    setSession(s);
  };
  return session ? <Chat session={session} onSignOut={() => signIn(null)} /> : <SignIn onSignIn={signIn} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider><App /></TooltipProvider>
  </StrictMode>,
);
