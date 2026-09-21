import {test,expect,loginAs} from './fixtures';
import {PrismaClient} from '@prisma/client';
import {emptyPlatform,connectorCatalog} from '../../features/platform/catalog';
const db=new PrismaClient({datasourceUrl:'file:./browser-test.db'});
test.afterAll(()=>db.$disconnect());

test('광고주 관리: 검색·담당자·상태·연결 필터와 Workspace 진입',async({page})=>{
 const manager=await db.user.create({data:{email:crypto.randomUUID()+'@directory.invalid',name:'목록 담당자',role:'MANAGER',status:'ACTIVE',members:{create:{advertiserId:'brand-a',role:'MANAGER'}}}});
 const document=emptyPlatform();document.started=true;document.validated=true;document.connections.ga4={state:'healthy',account:'Demo',property:'Demo',fields:[],lastSync:'2026-09-20T00:00:00Z'};
 await db.workspaceDocument.create({data:{advertiserId:'brand-a',key:'intentbridge:platform:v1:brand-a',payload:JSON.parse(JSON.stringify(document)),revision:1}});
 try{
  await page.goto('/advertisers?period=14');const area=page.getByTestId('advertiser-management'),rows=area.locator('tbody tr');await expect(rows).toHaveCount(2);
  await expect(area.locator('.am-summary')).toContainText('전체 광고주2');await expect(rows.filter({hasText:'브랜드 A'})).toContainText(`1 / ${connectorCatalog.length}`);await expect(rows.filter({hasText:'브랜드 A'})).toContainText('분석 준비 완료');await expect(rows.filter({hasText:'브랜드 B'})).toContainText('설정 중');
  await expect(area.locator('.ds-journey-signal,.ds-activity-rail,.ui-chart-panel')).toHaveCount(0);
  await area.getByLabel('광고주 검색').fill('브랜드 B');await expect(rows).toHaveCount(1);await expect(rows).toContainText('브랜드 B');await area.getByLabel('광고주 검색').fill('없는 광고주');await expect(rows).toHaveCount(0);await area.getByRole('button',{name:'필터 초기화'}).click();
  await area.getByLabel('담당자',{exact:true}).selectOption(manager.id);await expect(rows).toHaveCount(1);await expect(rows).toContainText('브랜드 A');await area.getByLabel('담당자',{exact:true}).selectOption('unassigned');await expect(rows).toHaveCount(1);await expect(rows).toContainText('브랜드 B');await area.getByLabel('담당자',{exact:true}).selectOption('');
  await area.getByLabel('상태',{exact:true}).selectOption('setup');await expect(rows).toHaveCount(1);await expect(rows).toContainText('브랜드 B');await area.getByLabel('상태',{exact:true}).selectOption('');
  await area.getByLabel('데이터 연결 상태',{exact:true}).selectOption('connected');await expect(rows).toHaveCount(1);await expect(rows).toContainText('브랜드 A');await area.getByLabel('데이터 연결 상태',{exact:true}).selectOption('disconnected');await expect(rows).toHaveCount(1);await expect(rows).toContainText('브랜드 B');
  await rows.getByRole('link',{name:'Workspace 열기 →'}).click();await expect(page).toHaveURL(/\/dashboard\?advertiser=brand-b&period=14$/);await expect(page.getByLabel('광고주 워크스페이스')).toHaveValue('brand-b');await expect(page.locator('.ds-journey-signal')).toBeVisible();
 }finally{await db.user.delete({where:{id:manager.id}})}
});

test('광고주 관리: 5개 viewport 목록·Drawer 취소·키보드 초점',async({page})=>{
 await page.goto('/advertisers');const area=page.getByTestId('advertiser-management');await expect(area.locator('tbody tr')).toHaveCount(2);
 for(const width of [1440,1366,1024,768,390]){
  await page.setViewportSize({width,height:960});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(area.getByRole('link',{name:'Workspace 열기 →'}).first()).toBeVisible();await page.screenshot({path:`test-results/advertiser-directory-${width}.png`,fullPage:true});
  const open=area.getByRole('button',{name:'+ 새 광고주',exact:true});await open.click();const modal=page.getByRole('dialog',{name:'새 광고주'});await expect(modal).toBeVisible();await expect(modal.getByLabel('광고주 이름')).toBeVisible();await modal.getByLabel('광고주 이름').fill('저장하지 않은 광고주');await page.screenshot({path:`test-results/advertiser-drawer-${width}.png`,fullPage:true});await page.keyboard.press('Escape');await expect(modal).not.toBeVisible();await expect(open).toBeFocused();await expect(area.locator('tbody tr')).toHaveCount(2);
 }
 await area.getByRole('button',{name:'브랜드 A 수정',exact:true}).click();await expect(page.getByRole('dialog',{name:'광고주 수정'}).getByLabel('광고주 이름')).toHaveValue('브랜드 A');await page.getByRole('button',{name:'취소',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('광고주 관리: 부분 조회 실패를 정상으로 표시하지 않고 재시도한다',async({page})=>{
 await page.route('**/api/workspaces/brand-b/platform',route=>route.fulfill({status:503,json:{error:'테스트 조회 실패'}}));await page.goto('/advertisers');const area=page.getByTestId('advertiser-management');await expect(area.getByRole('alert')).toContainText('일부 연결 상태');await expect(area.locator('tbody tr').filter({hasText:'브랜드 B'})).toContainText('확인 불가');await area.getByLabel('데이터 연결 상태',{exact:true}).selectOption('unknown');await expect(area.locator('tbody tr')).toHaveCount(1);
 await page.unroute('**/api/workspaces/brand-b/platform');await area.getByRole('button',{name:'다시 시도'}).click();await expect(area.getByRole('alert')).toHaveCount(0);await area.getByLabel('데이터 연결 상태',{exact:true}).selectOption('');await expect(area.locator('tbody tr')).toHaveCount(2);await expect(area.locator('tbody tr').filter({hasText:'브랜드 B'})).toContainText('설정 중');
});

test('ADVERTISER는 광고주 관리 메뉴 없이 자신의 Workspace를 유지한다',async({page})=>{
 await loginAs(page,'a@intentbridge.test');await expect(page.locator('nav a[href="/advertisers"]')).toHaveCount(0);await expect(page.getByTestId('advertiser-dashboard')).toBeVisible();expect((await page.goto('/advertisers'))?.status()).toBe(403);
});

test('비활성 광고주 생성·목록 상태·활성화 후 Workspace 진입',async({page})=>{
 const name='비활성 검수 '+crypto.randomUUID().slice(0,8);let id:string|undefined;
 try{
  await page.goto('/advertisers');await page.getByRole('button',{name:'+ 새 광고주',exact:true}).click();const modal=page.getByRole('dialog',{name:'새 광고주'});await modal.getByLabel('광고주 이름',{exact:true}).fill(name);await modal.getByLabel('Workspace 상태').selectOption('DISABLED');await modal.getByRole('button',{name:'광고주 생성',exact:true}).click();await expect(modal).not.toBeVisible();
  const rows=page.getByRole('table',{name:'광고주 목록'}).locator('tbody tr'),row=rows.filter({hasText:name});await expect(row).toContainText('비활성 Workspace');id=(await db.advertiser.findFirstOrThrow({where:{name}})).id;
  await page.getByLabel('상태',{exact:true}).selectOption('DISABLED');await expect(rows).toHaveCount(1);await expect(row.getByRole('link',{name:'Workspace 열기 →'})).toHaveCount(0);await expect(row.getByRole('link',{name:'사용자 보기'})).toHaveAttribute('href','/settings');
  await row.getByRole('button',{name:`${name} 수정`,exact:true}).click();await page.getByRole('dialog').getByLabel('Workspace 상태').selectOption('ACTIVE');await page.getByRole('button',{name:'광고주 변경 저장',exact:true}).click();await expect(row).toContainText('ACTIVE');await expect(row.getByRole('link',{name:'Workspace 열기 →'})).toHaveAttribute('href',`/dashboard?advertiser=${id}&period=30`);expect((await db.advertiser.findUniqueOrThrow({where:{id}})).status).toBe('ACTIVE');
 }finally{await db.advertiser.deleteMany({where:id?{id}:{name}})}
});
