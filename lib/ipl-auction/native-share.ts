export type ImageShareAdapter={canShare?:(data:ShareData)=>boolean;share?:(data:ShareData)=>Promise<void>};
/** Call immediately from the click handler with an already prepared file to preserve user activation. */
export async function shareSquadFile(file:File,adapter:ImageShareAdapter=navigator):Promise<string>{
 const payload:ShareData={files:[file],title:'My IPL squad · The Cricket Space'};
 try{
  if(!adapter.share||!adapter.canShare?.(payload))return 'Image sharing is not supported by this browser.';
  await adapter.share(payload);
  return '';
 }catch(error){return (error as Error).name==='AbortError'?'':'Could not open the share menu. Please tap Share your squad again.';}
}
