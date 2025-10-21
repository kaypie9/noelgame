import { MESSAGE_EXPIRATION_TIME } from "@/lib/constants";
import type { NeynarUser } from "@/lib/neynar";
import { useAuthenticate, useMiniKit } from '@coinbase/onchainkit/minikit';
import { useCallback, useEffect, useState } from "react";

export const useSignIn = ({ autoSignIn = false }: { autoSignIn?: boolean }) => {
  const { context } = useMiniKit(); // Farcaster Mini App context
  const { signIn } = useAuthenticate(); // SIWF signer

  const [user, setUser] = useState<NeynarUser | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Basic context guards
      if (!context) {
        throw new Error("No Farcaster Mini App context");
      }
      const fid = (context as any)?.user?.fid as number | undefined;
      if (!fid) {
        throw new Error("Missing user fid in context");
      }

      // Build SIWF message window
      const result = await signIn({
        nonce: Math.random().toString(36).slice(2),
        notBefore: new Date().toISOString(),
        expirationTime: new Date(Date.now() + MESSAGE_EXPIRATION_TIME).toISOString(),
      });
      if (!result) {
        throw new Error("Sign in failed");
      }

      // Safely read referrer fid only when embedded in a cast
      let referrerFid: number | null = null;
      if (context.location?.type === "cast_embed") {
        const loc = context.location as { type: "cast_embed"; cast?: { fid?: number } };
        referrerFid = loc.cast?.fid ?? null;
      }

      // Call our auth API
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          signature: result.signature,
          message: result.message,
          fid,
          referrerFid,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({} as any));
        console.error("sign-in error", errorData);
        throw new Error(errorData?.message || "Sign in failed");
      }

      const data = (await res.json()) as { user: NeynarUser };
      setUser(data.user);
      setIsSignedIn(true);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [context, signIn]);

  useEffect(() => {
    if (autoSignIn) {
      void handleSignIn();
    }
  }, [autoSignIn, handleSignIn]);

  return { signIn: handleSignIn, isSignedIn, isLoading, error, user };
};