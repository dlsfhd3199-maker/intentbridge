import type {ConnectorDefinition,ConnectorId,PlatformConnector,AnalyticsConnector,AdsConnector,PlatformDocument} from '@/types/platform';
import type {DashboardData} from '@/types/domain';
export const stateNames={disconnected:'연결 안 됨',setup:'설정 필요',connecting:'연결 중',healthy:'정상',attention:'확인 필요',error:'오류'};
const adFields=['광고비','노출','클릭','전환','전환매출'];
export const connectorCatalog:ConnectorDefinition[]=[
 {id:'ga4',name:'Google Analytics 4',icon:'G4',description:'자사몰 방문부터 구매까지 고객 행동을 확인합니다.',kind:'analytics',fields:['사용자','세션','상품 조회','장바구니','결제 시작','구매','매출','유입 경로'],accounts:['Progress Media GA4','Demo Store GA4','Test Property'],properties:['Demo Store · 100001','Demo Shop · 100002']},
 ...(['naver','meta','google','kakao','daangn'] as const).map(id=>({id,name:({naver:'Naver Ads',meta:'Meta Ads',google:'Google Ads',kakao:'Kakao Ads',daangn:'Daangn Ads'})[id],icon:({naver:'N',meta:'M',google:'G',kakao:'K',daangn:'D'})[id],description:'광고비와 전환 흐름을 데모 계정으로 확인합니다.',kind:'ads' as const,fields:adFields,accounts:['브랜드 A · Demo','브랜드 B · Demo'],properties:['Demo Account 01','Demo Account 02']})),
 {id:'ai',name:'ChatGPT / AI Traffic',icon:'AI',description:'AI 유입 분석 데모입니다. ChatGPT Ads는 Experimental / Planned입니다.',kind:'analytics',fields:['사용자','세션','구매','매출'],accounts:['AI Traffic Demo'],properties:['Demo AI Source'],planned:true},
];
export function demoMetrics(id:ConnectorId,d:DashboardData){if(id==='ga4')return [{label:'사용자',value:d.source.uniqueUsers},{label:'세션',value:d.source.sessions},{label:'구매',value:d.totals.purchases},{label:'매출',value:d.totals.revenue,unit:'원'}];if(id==='ai')return [{label:'사용자',value:d.source.uniqueUsers},{label:'직접 구매',value:d.analytics.directPurchases},{label:'직접 매출',value:d.finance.directRevenue,unit:'원'}];if(id==='meta')return [{label:'광고비',value:d.finance.metaSpend,unit:'원'},{label:'재방문 구매',value:d.retargeting.recoveredPurchases},{label:'전환매출',value:d.finance.recoveredRevenue,unit:'원'}];return [{label:'광고비',value:0,unit:'원'},{label:'클릭',value:0},{label:'전환',value:0}];}
class DemoConnector implements PlatformConnector {
 constructor(public definition:ConnectorDefinition){}
 async test(input:{account:string;property:string;fields:string[]}){const ok=this.definition.accounts.includes(input.account)&&this.definition.properties.includes(input.property)&&input.fields.length>0&&input.fields.every(f=>this.definition.fields.includes(f));return {ok,message:ok?'데모 계정과 수집 항목을 확인했습니다. 외부 API는 호출하지 않았습니다.':'계정과 수집 항목을 확인해주세요.'};}
 collect(data:DashboardData){return demoMetrics(this.definition.id,data);}
}
export class DemoGA4Connector extends DemoConnector implements AnalyticsConnector {readonly category='analytics' as const;constructor(){super(connectorCatalog[0]);}}
export class DemoAdsConnector extends DemoConnector implements AdsConnector {readonly category='ads' as const;}
// Real adapters can implement the same contract; this registry deliberately installs DEMO adapters only.
export class ConnectionService {constructor(private adapters:PlatformConnector[]=connectorCatalog.map(d=>d.id==='ga4'?new DemoGA4Connector():d.kind==='ads'?new DemoAdsConnector(d):new DemoConnector(d))){}get(id:ConnectorId){const adapter=this.adapters.find(a=>a.definition.id===id);if(!adapter)throw new Error('지원하지 않는 연결입니다.');return adapter;}}
export const connections=new ConnectionService();
export function emptyPlatform():PlatformDocument{return {version:1,profile:{siteUrl:'',monthlyBudget:0,goal:'구매'},connections:{},validated:false,started:false,activity:[]};}
export const goals=['매출','구매','DB','회원가입','브랜드 인지도'];
export function onboardingSteps(d:PlatformDocument,managerCount:number,hasData:boolean){return [!!d.profile.siteUrl&&d.profile.monthlyBudget>0,managerCount>0,d.connections.ga4?.state==='healthy',d.validated&&hasData,d.started];}
export function workspaceHealth(d:PlatformDocument){return Object.values(d.connections).some(c=>c?.state==='error')?'데이터 오류':!d.started?'설정 중':!d.validated||Object.values(d.connections).some(c=>c?.state==='attention')?'확인 필요':'운영 정상';}
