// Loaded only by the disposable browser suite via an explicit Node --require.
// Production startup never loads this file. No real secret/provider is used.
const originalFetch=globalThis.fetch,used=new Set();
globalThis.fetch=async (input,init)=>{
  const url=typeof input==='string'||input instanceof URL?String(input):input.url;
  if(url!=='https://challenges.cloudflare.com/turnstile/v0/siteverify')return originalFetch(input,init);
  const body=new URLSearchParams(String(init?.body??'')),token=body.get('response');
  if(body.get('secret')!=='trial-qa-secret'||!token?.startsWith('trial-qa-'))return Response.json({success:false,'error-codes':['invalid-input-response']});
  if(used.has(token))return Response.json({success:false,'error-codes':['timeout-or-duplicate']});
  used.add(token);return Response.json({success:true,hostname:new URL(process.env.SITELEDGER_APP_URL).hostname,action:'siteledger-trial'});
};
