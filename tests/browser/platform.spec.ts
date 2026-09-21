import {test,expect,loginAs,type Page} from './fixtures';
import {PrismaClient} from '@prisma/client';
import {hashPassword} from '../../lib/password';
const db=new PrismaClient({datasourceUrl:'file:./browser-test.db'});
const headers={Origin:'http://localhost:3100'};
test.afterAll(()=>db.$disconnect());
async function wizard(page:Page,name='Google Analytics 4'){
 const card=page.locator('.platform-connectors article').filter({has:page.getByRole('button',{name,exact:true})});
 await card.getByRole('button',{name:'연결하기',exact:true}).click();
 const dialog=page.getByRole('dialog');
 for(let i=0;i<4;i++)await dialog.getByRole('button',{name:'다음',exact:true}).click();
 await dialog.getByRole('button',{name:'데모 연결 테스트',exact:true}).click();
 await expect(dialog).toContainText('정상 · 데모 연결 완료');
 await dialog.getByRole('link',{name:'데이터 확인하기 →'}).click();
 await expect(dialog).toHaveCount(0);
}
test('새 Workspace: 빈 상태 → 프로필 → 실제 담당자 → 데모 연결 → 검증 → 분석 시작',async({page})=>{
 const name='Platform '+crypto.randomUUID();let id='',manager='';
 try{
  const response=await page.request.post('/api/admin/advertisers',{headers,data:{name,industry:'쇼핑',productName:'데모 상품'}});expect(response.status()).toBe(200);id=(await response.json()).id;
  await page.goto('/dashboard?advertiser='+id);await expect(page.getByRole('heading',{name:'IntentBridge 설정을 완료해주세요.'})).toBeVisible();
  await page.goto('/connections?advertiser='+id);
  await page.getByLabel('사이트 URL',{exact:true}).fill('https://demo.example.com');await page.getByLabel('월 광고예산 (원)',{exact:true}).fill('3000000');await page.getByRole('button',{name:'프로필 저장',exact:true}).click();
  await expect.poll(async()=>(await(await page.request.get(`/api/workspaces/${id}/platform`)).json()).document.profile.monthlyBudget).toBe(3000000);
  manager=(await db.user.create({data:{email:crypto.randomUUID()+'@platform.invalid',name:'플랫폼 담당자',role:'MANAGER',status:'ACTIVE',members:{create:{advertiserId:id,role:'MANAGER'}}}})).id;
  await page.reload();await expect(page.getByLabel('담당 MANAGER')).toHaveValue('플랫폼 담당자');
  await wizard(page);await expect(page.locator('#platform-data')).not.toContainText('구매0');
  const ready=await(await page.request.get(`/api/workspaces/${id}/platform`)).json();expect(ready.hasData).toBe(true);expect(ready.document.connections.ga4.state).toBe('healthy');
  await page.getByRole('button',{name:'데이터 확인 완료로 표시',exact:true}).click();await expect(page.getByRole('button',{name:'분석 시작',exact:true})).toBeEnabled();await page.getByRole('button',{name:'분석 시작',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/dashboard\\?advertiser='+id));await expect(page.locator('.platform-source').filter({hasText:'분석 준비 완료'})).toBeVisible();
  expect((await(await page.request.get(`/api/workspaces/${id}/platform`)).json()).document.started).toBe(true);
 }finally{if(manager)await db.user.deleteMany({where:{id:manager}});if(id)await db.advertiser.deleteMany({where:{id}});}
});
test('연결 새로고침은 실적 보존 · 낡은 revision/잘못된 계정/CSRF 차단',async({page})=>{
 const before=(await(await page.request.get('/api/bootstrap')).json()).fixtures;
 await page.goto('/connections');await wizard(page);
 const url='/api/workspaces/brand-a/platform',first=await(await page.request.get(url)).json();
 const wrong=await page.request.patch(url,{headers,data:{revision:first.revision,action:'connect',connector:'ga4',account:'invalid',property:'invalid',fields:['구매']}});expect(wrong.status()).toBe(400);
 expect((await page.request.patch(url,{headers:{Origin:'https://invalid.example'},data:{revision:first.revision,action:'refresh',connector:'ga4'}})).status()).toBe(403);
 const card=page.locator('.platform-connectors article').filter({has:page.getByRole('button',{name:'Google Analytics 4',exact:true})});await card.getByRole('button',{name:'새로고침',exact:true}).click();
 await expect.poll(async()=>(await(await page.request.get(url)).json()).revision).toBe(first.revision+1);
 const refreshed=await(await page.request.get(url)).json();expect(refreshed.document.connections.ga4.lastSync).not.toBe(first.document.connections.ga4.lastSync);
 expect((await page.request.patch(url,{headers,data:{revision:first.revision,action:'refresh',connector:'ga4'}})).status()).toBe(409);
 expect((await(await page.request.get('/api/bootstrap')).json()).fixtures).toEqual(before);
 await page.reload();await expect(card).toContainText('정상');
});
test('새 플랫폼 API의 MANAGER 조회/쓰기 제한·ADVERTISER 격리',async({page})=>{
 const email=crypto.randomUUID()+'@platform.invalid',manager=await db.user.create({data:{email,name:'담당 마케터',role:'MANAGER',status:'ACTIVE',passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!),members:{create:{advertiserId:'brand-a',role:'MANAGER'}}}});
 try{
  await loginAs(page,email);expect((await page.request.get('/api/workspaces/brand-a/platform')).status()).toBe(200);expect((await page.request.get('/api/workspaces/brand-b/platform')).status()).toBe(403);
  expect((await page.request.patch('/api/workspaces/brand-a/platform',{headers,data:{action:'profile',revision:0,siteUrl:'https://demo.example.com',monthlyBudget:100,goal:'구매'}})).status()).toBe(403);
  await page.goto('/connections');await expect(page.getByRole('button',{name:'연결하기',exact:true})).toHaveCount(0);await expect(page.getByLabel('사이트 URL')).toBeDisabled();
  await loginAs(page,'a@intentbridge.test');expect((await page.request.get('/api/workspaces/brand-b/platform')).status()).toBe(403);expect((await page.request.patch('/api/workspaces/brand-a/platform',{headers,data:{action:'validate',revision:0}})).status()).toBe(403);
  await expect(page.locator('a[href^="/connections"]')).toHaveCount(0);await expect(page.getByLabel('광고주 · 실행안 검색')).toHaveCount(0);
 }finally{await db.user.deleteMany({where:{id:manager.id}});}
});
test('검색·최근 광고주·알림 읽음·보고서 기간·회사 표시 저장',async({page})=>{
 await page.getByLabel('광고주 · 실행안 검색',{exact:true}).fill('브랜드 B');await page.locator('.platform-search-results').getByRole('link',{name:'브랜드 B',exact:true}).click();await expect(page.getByLabel('광고주 워크스페이스')).toHaveValue('brand-b');
 await page.getByText('광고주 빠른 전환',{exact:true}).click();await page.locator('.platform-popover').getByRole('button',{name:'브랜드 A',exact:true}).first().click();await expect(page.getByLabel('광고주 워크스페이스')).toHaveValue('brand-a');
 await page.locator('.platform-toolbar summary').filter({hasText:'알림'}).click();await page.getByRole('button',{name:'읽음으로 표시',exact:true}).first().click();await expect(page.getByRole('button',{name:'안 읽음으로 표시',exact:true})).toHaveCount(1);
 await page.goto('/reports');await page.getByLabel('보고서 기간').selectOption('7');await expect(page.locator('.platform-panel').first()).toContainText('7일 제공');const download=page.waitForEvent('download');await page.getByRole('button',{name:'보고서 다운로드 · HTML'}).click();expect((await download).suggestedFilename()).toContain('_7.html');
 await page.goto('/connections');await page.getByText('Advanced · 연결 아키텍처 및 기존 설정',{exact:true}).click();await page.getByLabel('회사명',{exact:true}).fill('플랫폼 검수');await page.getByLabel('로고 텍스트').fill('PM');await page.getByRole('button',{name:'설정 저장',exact:true}).click();await expect(page.locator('.platform-toolbar')).toContainText('PM · 플랫폼 검수');
});
test('Platform 반응형 1440/1366/1024/768/390 · 외부 API 요청 없음',async({page})=>{
 const errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='http://localhost:3100')external.push(r.url());});
 for(const width of [1440,1366,1024,768,390]){await page.setViewportSize({width,height:900});await page.goto('/connections');await expect(page.locator('.platform-connectors article')).toHaveCount(7);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/platform-${width}.png`,fullPage:true});}
 await loginAs(page,'a@intentbridge.test');for(const route of ['/dashboard','/funnel','/performance','/campaigns','/reports']){await page.goto(route);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(errors).toEqual([]);expect(external).toEqual([]);
});
