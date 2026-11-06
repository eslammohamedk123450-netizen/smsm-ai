export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-app-domain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

export function handleCorsRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function withCors(headers: Record<string, string> = {}): Record<string, string> {
  return { ...corsHeaders, ...headers };
}
