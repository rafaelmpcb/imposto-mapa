import { supabase } from "@/integrations/supabase/client";

const TOKEN_ERROR = /jwt|unauthorized|token/i;

/**
 * Executa uma chamada ao servidor e, se ela falhar por causa do token de sessão
 * (ex.: "JWT issued at future", relógio fora de sincronia), renova a sessão e
 * tenta uma única vez novamente.
 */
export async function withAuthRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!TOKEN_ERROR.test(message)) throw error;
    await supabase.auth.refreshSession();
    return run();
  }
}
