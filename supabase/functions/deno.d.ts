// Type declarations for Deno runtime used by Supabase Edge Functions

declare namespace Deno {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;

  export const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  };
}
