import {test,expect,loginAs} from './fixtures';
import {writeFileSync} from 'node:fs';
import {PrismaClient} from '@prisma/client';
import {hashPassword} from '../../lib/password';
const db=new PrismaClient({datasourceUrl:'file:./browser-test.db'});
test.afterAll(()=>db.$disconnect());

test('비로그인 홈페이지: SEO·앵커·키보드·CTA·공개 요청 범위',async({page})=>{
 await page.goto('about:blank');await page.context().clearCookies();
 const requests:string[]=[],errors:string[]=[];
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('/');expect(response?.status()).toBe(200);
 await expect(page).toHaveTitle('IntentBridge | 광고 유입을 구매까지 연결합니다');
 await expect(page.locator('h1')).toHaveText('광고 유입을,구매까지 연결합니다.');
 expect(new URL((await page.locator('link[rel="canonical"]').getAttribute('href'))!).href).toBe('http://localhost:3100/');
 await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content','website');
 await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/광고 유입부터/);
 await expect(page.locator('.app-shell,.sidebar,.platform-toolbar')).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'제품 소개',exact:true})).toBeVisible();
 expect(await page.locator('a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.getElementById(a.getAttribute('href')!.slice(1))).map(a=>a.getAttribute('href')))).toEqual([]);
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'본문으로 이동'})).toBeFocused();
 await page.keyboard.press('Enter');await expect(page).toHaveURL(/#public-main$/);
 await page.getByRole('link',{name:'제품 살펴보기'}).click();await expect(page).toHaveURL(/#product$/);
 expect(requests.filter(u=>new URL(u).origin!=='http://localhost:3100')).toEqual([]);
 expect(requests.filter(u=>u.includes('/api/')&&!u.includes('/api/auth/session'))).toEqual([]);
 expect(errors).toEqual([]);
 await page.locator('.pw-header-actions').getByRole('link',{name:'로그인',exact:true}).click();await expect(page).toHaveURL(/\/login$/);await expect(page.getByRole('heading',{name:'로그인',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'IntentBridge 홈페이지'}).click();
 await page.locator('.pw-header-actions').getByRole('link',{name:'시작하기'}).click();await expect(page).toHaveURL(/\/signup$/);await expect(page.getByRole('heading',{name:'회원가입',exact:true})).toBeVisible();
 await page.goto('/dashboard');await expect(page).toHaveURL(/\/login$/);
});

test('Public 반응형 1440/1366/1024/768/390 · 미리보기 · 초기 JS 크기',async({page},testInfo)=>{
 await page.goto('about:blank');await page.context().clearCookies();
 for(const width of [1440,1366,1024,768,390]){
  await page.setViewportSize({width,height:900});await page.goto('/');
  await expect(page.locator('.pw-hero .pw-button')).toBeVisible();
  await expect(page.locator('.pw-journey footer')).toContainText('총 구매 94건');
  await expect(page.locator('.pw-forecast')).toContainText('DEMO FORECAST');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const lowContrast=await page.locator('.pw-site').evaluate(root=>{
   const luminance=(color:string)=>{const rgb=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
   return [...root.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().width&&[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim())).flatMap(el=>{
    const style=getComputedStyle(el);let parent:Element|null=el,bg='rgb(255,255,255)';
    while(parent){const value=getComputedStyle(parent).backgroundColor;if(value!=='rgba(0, 0, 0, 0)'&&value!=='transparent'){bg=value;break}parent=parent.parentElement;}
    const a=luminance(style.color),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&parseInt(style.fontWeight)>=700);
    return ratio<(large?3:4.5)?[{element:el.tagName,className:el.className,ratio}]:[];
   });
  });
  expect(lowContrast).toEqual([]);
  await page.screenshot({path:`test-results/public-${width}.png`,fullPage:true});
 }
 await page.getByText('메뉴',{exact:true}).click();await page.getByRole('navigation',{name:'모바일 제품 소개'}).getByRole('link',{name:'주요 기능'}).click();await expect(page).toHaveURL(/#features$/);
 const sizes=()=>page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname.endsWith('.js')).map(e=>({file:new URL(e.name).pathname,decodedBytes:(e as PerformanceResourceTiming).decodedBodySize})));
 await page.goto('/');await page.waitForLoadState('networkidle');const homepage=await sizes();
 await loginAs(page);await page.waitForLoadState('networkidle');const dashboard=await sizes();
 const total=(entries:typeof homepage)=>entries.reduce((sum,e)=>sum+e.decodedBytes,0);
 expect(total(homepage)).toBeGreaterThan(0);expect(total(homepage)).toBeLessThan(total(dashboard));
 const metrics=testInfo.outputPath('initial-javascript.json');writeFileSync(metrics,JSON.stringify({homepageBytes:total(homepage),dashboardBytes:total(dashboard),homepage,dashboard},null,2));
 await testInfo.attach('initial-javascript.json',{path:metrics,contentType:'application/json'});
});

test('로그인한 모든 역할: Public 유지 → Dashboard · Membership 격리 유지',async({page})=>{
 const email=crypto.randomUUID()+'@public.invalid';
 const manager=await db.user.create({data:{email,name:'홈페이지 검수 담당자',role:'MANAGER',status:'ACTIVE',passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!),members:{create:{advertiserId:'brand-a',role:'MANAGER'}}}});
 try{
  for(const user of ['admin@intentbridge.test',email,'a@intentbridge.test']){
   await loginAs(page,user);await page.goto('/');await expect(page).toHaveURL('http://localhost:3100/');
   await page.setViewportSize({width:390,height:900});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const entry=page.locator('.pw-header-actions .pw-button');await expect(entry).toHaveText(/대시보드로 이동/);
   await expect(page.locator('.platform-toolbar')).toHaveCount(0);await entry.click();await expect(page).toHaveURL(/\/dashboard$/);
   if(user!=='admin@intentbridge.test'){expect((await page.request.get('/api/workspaces/brand-b')).status()).toBe(403);expect((await page.goto('/dashboard?advertiser=brand-b'))?.status()).toBe(403);}
  }
 }finally{await db.user.delete({where:{id:manager.id}});}
});
