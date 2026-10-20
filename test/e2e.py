"""Teste no navegador. Uso: python3 test/e2e.py http://localhost:8790 [pasta_de_prints]"""
import sys
from playwright.sync_api import sync_playwright
base=sys.argv[1]; shots=sys.argv[2] if len(sys.argv)>2 else None
errs=[]; fails=[]
def check(name,cond):
    print(('  ok   ' if cond else '  FALHOU ')+name)
    if not cond: fails.append(name)
with sync_playwright() as p:
    b=p.chromium.launch()
    for label,vp in (('desktop',{'width':1400,'height':900}),('celular',{'width':390,'height':800})):
        ctx=b.new_context(viewport=vp); pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.on('console',lambda m:errs.append(m.text) if m.type=='error' and 'Failed to load resource' not in m.text and 'fonts.g' not in m.text else None)
        pg.route('**/*',lambda r: r.abort() if r.request.url.startswith('http') and 'localhost' not in r.request.url else r.continue_())
        pg.goto(base); pg.wait_for_selector('.card',timeout=8000); pg.wait_for_timeout(500)
        print(label)
        check('5 editorias no menu', pg.locator('#categoryNav .nav-item').count()==5)
        check('abas das editorias', pg.locator('#categoryTabs .tab').count()==6)
        check('seções na home', pg.locator('section').count()>=5)
        check('urgente aparece', pg.locator('.badge-urgent').count()>=1)
        check('tendências aparecem', pg.locator('.trend-card').count()>=1)
        check('sem link de admin', pg.locator('a[href*="admin"]').count()==0)
        check('status das fontes', '2 de 3' in pg.inner_text('#sourcesStatus'))
        if shots: pg.screenshot(path=f'{shots}_{label}_home.png')
        pg.evaluate("go('ia')"); pg.wait_for_timeout(500)
        cards=pg.locator('.card').count()
        check('editoria IA lista só IA', cards>0 and all('Inteligência' in t or '🤖' in t for t in pg.locator('.card-category').all_inner_texts()))
        pg.evaluate("go('all',{filter:'urgent'})"); pg.wait_for_timeout(400)
        check('filtro urgentes', pg.locator('.card').count()>=1)
        pg.evaluate("go('all')"); pg.evaluate("setFilter('all')"); pg.wait_for_timeout(300)
        pg.evaluate("go('futebol')"); pg.wait_for_timeout(400)
        pg.locator('[data-action="favorite"]').first.click(); pg.wait_for_timeout(200)
        pg.evaluate("go('favorites')"); pg.wait_for_timeout(300)
        check('favoritos guardam', pg.locator('.card').count()==1)
        pg.evaluate("openSearch()"); pg.fill('#searchInput','figma'); pg.wait_for_timeout(700)
        check('busca sem acento/maiúscula', pg.locator('.search-result-item').count()>=1)
        if shots: pg.screenshot(path=f'{shots}_{label}_busca.png')
        pg.keyboard.press('Escape')
        pg.evaluate("go('all')"); pg.wait_for_timeout(300)
        if shots: pg.screenshot(path=f'{shots}_{label}_home2.png',full_page=False)
        reg=pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)")
        check('service worker registrado', reg)
        ctx.close()
    # sem dados: mensagem amigável
    ctx=b.new_context(service_workers='block'); pg=ctx.new_page()
    pg.route('**/*',lambda r: r.abort() if r.request.url.startswith('http') and 'localhost' not in r.request.url else r.continue_())
    pg.route('**/data/news.json',lambda r:r.fulfill(status=404,body='x'))   # registrada por último = vale primeiro
    pg.goto(base); pg.wait_for_timeout(1200)
    check('mensagem amigável sem dados', 'ainda não foi gerado' in pg.inner_text('#mainContent'))
    b.close()
print('ERROS DE CONSOLE:',errs[:5] if errs else 0)
sys.exit(1 if fails or errs else 0)
