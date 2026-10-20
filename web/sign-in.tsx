import { CircleAlert, HeartPulse } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { call, type Session } from "@/lib/api";

/** Household + access key. A stopgap until real sign-in (see README): the key is the API token. */
export function SignIn({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [household, setHousehold] = useState("demo");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const session = { household: household.trim(), token: token.trim() };
    try {
      await call(session, "outbox");
      onSignIn(session);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="size-5" />
            </div>
            <CardTitle>Family Health</CardTitle>
            <CardDescription>Your household's health companion.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="household">Household</Label>
              <Input id="household" value={household} onChange={(e) => { setHousehold(e.target.value); setError(""); }} pattern="[A-Za-z0-9_\-]{1,64}" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="token">Access key</Label>
              <Input id="token" type="password" autoComplete="current-password" autoFocus value={token} aria-invalid={!!error || undefined}
                onChange={(e) => { setToken(e.target.value); setError(""); }} required />
            </div>
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Couldn't sign in</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Spinner />}{busy ? "Checking…" : "Continue"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
