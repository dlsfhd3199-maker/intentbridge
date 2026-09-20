import 'server-only';
import type {Prisma} from '@prisma/client';
import seed from '@/mock/mock-data.json';
import {db} from './database';
import {AccessError,requireAdvertiserAccess} from './authorization';
import {transaction} from './transaction';
import {requestContext} from './request-context';
import {connectorCatalog,connections,emptyPlatform,goals,onboardingSteps} from '@/features/platform/catalog';
import type {PlatformDocument,ConnectorId} from '@/types/platform';
const key=(id:string)=>`intentbridge:platform:v1:${id}`;
export async function readPlatform(id:string){
 const {advertiser}=await requireAdvertiserAccess(id);
 const [row,managers,campaigns,drafts,simulations,history]=await Promise.all([
  db.workspaceDocument.findUnique({where:{advertiserId_key:{advertiserId:id,key:key(id)}}}),
  db.user.findMany({where:{role:'MANAGER',status:'ACTIVE',members:{some:{advertiserId:id}}},select:{id:true,name:true}}),
  db.campaign.findMany({where:{advertiserId:id},select:{id:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:5}),
  db.campaignDraft.findMany({where:{advertiserId:id},select:{id:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:5}),
  db.savedSimulation.findMany({where:{advertiserId:id},select:{id:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:5}),
  db.operationHistory.findMany({where:{advertiserId:id},select:{id:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:5})
 ]);
 const document=row?.payload as unknown as PlatformDocument??emptyPlatform();
 const events=(items:{id:string;updatedAt:Date}[],label:string)=>items.map(item=>({id:label+item.id,at:item.updatedAt.toISOString(),label}));
 const activity=[...document.activity,...events(campaigns,'캠페인 저장'),...events(drafts,'캠페인 초안 저장'),...events(simulations,'성과 개선 시나리오 저장'),...events(history,'데모 운영 변경')].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,30);
 const mock=advertiser.mockData as {source?:{uniqueUsers?:number}};
 return {document,revision:row?.revision??0,managers:managers.map(m=>({id:m.id,name:m.name||'담당 마케터'})),status:advertiser.status,hasData:(mock.source?.uniqueUsers??0)>0,activity};
}
export async function changePlatform(id:string,input:Record<string,unknown>){
 const {user}=await requireAdvertiserAccess(id,'MANAGE_CONNECTIONS');
 if(!Number.isSafeInteger(input.revision)||Number(input.revision)<0||!['profile','connect','refresh','validate','start'].includes(String(input.action)))throw new AccessError(400,'설정 요청을 확인해주세요.');
 return transaction(async tx=>{
  const row=await tx.workspaceDocument.findUnique({where:{advertiserId_key:{advertiserId:id,key:key(id)}}});if((row?.revision??0)!==input.revision)throw new AccessError(409,'다른 화면에서 설정이 변경되었습니다. 새로고침해주세요.');
  const document=structuredClone(row?.payload as unknown as PlatformDocument??emptyPlatform()),at=new Date().toISOString();let label='';
  if(input.action==='profile'){
   let url:URL;try{url=new URL(String(input.siteUrl));}catch{throw new AccessError(400,'사이트 URL을 확인해주세요.');}
   if(url.protocol!=='https:'||url.username||url.password||String(input.siteUrl).length>500||typeof input.monthlyBudget!=='number'||!Number.isSafeInteger(input.monthlyBudget)||input.monthlyBudget<1||input.monthlyBudget>1e12||!goals.includes(String(input.goal)))throw new AccessError(400,'광고주 정보를 확인해주세요.');
   document.profile={siteUrl:url.toString(),monthlyBudget:input.monthlyBudget,goal:String(input.goal)};label='광고주 프로필 저장';
  }else if(input.action==='connect'||input.action==='refresh'){
   const definition=connectorCatalog.find(c=>c.id===input.connector);if(!definition)throw new AccessError(400);
   const previous=document.connections[definition.id];
   const selection=input.action==='refresh'?previous:{account:input.account,property:input.property,fields:input.fields};
   if(!selection||typeof selection.account!=='string'||typeof selection.property!=='string'||!Array.isArray(selection.fields)||!selection.fields.every(f=>typeof f==='string')||new Set(selection.fields).size!==selection.fields.length)throw new AccessError(400,'수집 설정을 확인해주세요.');
   const config={account:selection.account,property:selection.property,fields:selection.fields as string[]};if(!(await connections.get(definition.id).test(config)).ok)throw new AccessError(400,'데모 연결 테스트를 통과하지 못했습니다.');
   document.connections[definition.id as ConnectorId]={...config,state:'healthy',lastSync:at};document.validated=false;label=`${definition.name} 데모 ${input.action==='refresh'?'새로고침':'연결 완료'}`;
   // Initialize only an empty workspace; never replace existing metrics on refresh.
   if(definition.id==='ga4'){
    const advertiser=await tx.advertiser.findUniqueOrThrow({where:{id}}),mock=advertiser.mockData as {source?:{uniqueUsers?:number}};
    if(!mock.source?.uniqueUsers){const fixture=structuredClone(seed.advertisers[[...id].reduce((s,c)=>s+c.charCodeAt(0),0)%seed.advertisers.length]);await tx.advertiser.update({where:{id},data:{mockData:{...fixture,id,name:advertiser.name,industry:advertiser.industry,productName:advertiser.productName}}});}
   }
  }else if(input.action==='validate'){
   if(document.connections.ga4?.state!=='healthy')throw new AccessError(400,'GA4 데모 연결을 먼저 완료해주세요.');document.validated=true;label='데모 데이터 확인 완료';
  }else{
   const managers=await tx.user.count({where:{role:'MANAGER',status:'ACTIVE',members:{some:{advertiserId:id}}}}),advertiser=await tx.advertiser.findUniqueOrThrow({where:{id}}),mock=advertiser.mockData as {source?:{uniqueUsers?:number}};
   if(!onboardingSteps(document,managers,!!mock.source?.uniqueUsers).slice(0,4).every(Boolean))throw new AccessError(400,'앞의 네 가지 설정을 완료해주세요.');document.started=true;label='워크스페이스 운영 시작';
  }
  document.activity=[{id:crypto.randomUUID(),at,label},...document.activity].slice(0,50);
  const payload=JSON.parse(JSON.stringify(document)) as Prisma.InputJsonValue;
  await tx.workspaceDocument.upsert({where:{advertiserId_key:{advertiserId:id,key:key(id)}},create:{advertiserId:id,key:key(id),payload,revision:1},update:{payload,revision:{increment:1}}});
  await tx.auditLog.create({data:{advertiserId:id,actorUserId:user.id,requestId:requestContext()?.requestId,action:'PLATFORM_DEMO_UPDATED',resource:key(id),after:{action:String(input.action)}}});return {ok:true};
 },{actor:user.id,scope:`platform:${id}`,input});
}
