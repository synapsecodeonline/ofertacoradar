"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await createClient().auth.signOut();
    router.refresh();
  }

  if (!loaded) return <span className="h-8 w-16" />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-8 items-center rounded-full border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300"
      >
        Entrar
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      title={user.email ?? undefined}
      className="inline-flex h-8 items-center rounded-full bg-emerald-100 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200"
    >
      Sair
    </button>
  );
}
