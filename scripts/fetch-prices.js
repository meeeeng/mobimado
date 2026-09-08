/* 모비라이프 OpenAPI에서 필요한 시세만 골라 prices.json 으로 저장합니다.
   환경변수 MABI_API_KEY 필요. */

const BASE = 'https://open.mabimobi.life/v1/market/prices';
const KEY = process.env.MABI_API_KEY;
if (!KEY) { console.error('MABI_API_KEY 가 없습니다.'); process.exit(1); }

/* ── 매칭 규칙 ────────────────────────────── */
const MATS = ['허상의 마력석','포식의 마력석','심해의 마력석',
              '야생의 영혼석','삼림의 영혼석','공명의 영혼석',
              '파동의 영혼석','망령의 영혼석','원념의 영혼석'];

const KIND = { '비늘 갑옷':'비늘', '가죽 갑옷':'가죽', '전투복':'천' };
const PARTS = ['투구','상의','장갑','하의','신발'];

const WEAPON = {
  '숏소드':'전사', '그레이트 소드':'대검전사', '론 엣지소드':'검술사', '라이트 핼버드':'기사',
  '숏보우':'궁수', '라이트 크로스보우':'석궁사수', '라이트 롱보우':'장궁병',
  '우드 완드':'마법사', '크리스탈 스태프':'화염술사', '스노우 오브':'빙결술사', '라운드 코일':'전격술사',
  '마블 힐링 완드':'힐러', '라운드헤드 케인':'사제', '블런트 쿼터스태프':'수도사', '서펜트 의식용 단검':'암흑술사',
  '켈틱 류트':'음유시인', '커브드 하프':'악사', '꽃잎 접부채':'댄서',
  '플랫 대거':'도적', '샤프 듀얼소드':'듀얼블레이드', '라이트 너클':'격투가',
};

/* ── 호출 ─────────────────────────────────── */
async function fetchAll(params) {
  const out = []; let offset = 0;
  for (let page = 0; page < 20; page++) {
    const url = `${BASE}?${new URLSearchParams({ ...params, limit: 100, offset })}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const j = await res.json();
    const rows = j.data || [];
    out.push(...rows);
    if (rows.length < 100) return { rows: out, updated: j.last_updated_at };
    offset += 100;
  }
  return { rows: out, updated: null };
}

/* ── 파싱 ─────────────────────────────────── */
const strip = n => n.replace(/ZZ$/, '').trim();

function parse(rows, out) {
  for (const r of rows) {
    const name = strip(r.name);
    const price = r.min_price;
    if (!price) continue;

    // 재료
    if (MATS.includes(name)) { out.mats[name.split('의 ')[0]] = price; continue; }

    // 잔영 / 해연
    const m = name.match(/^(잔영|해연)의 (.+)$/);
    if (!m) continue;
    const [, grade, rest] = m;
    const bucket = grade === '잔영' ? 'J' : 'H';

    // 장신구
    if (rest === '페리도트 링')      { out['acc'+bucket]['반지']   = price; continue; }
    if (rest === '페리도트 네크리스') { out['acc'+bucket]['목걸이'] = price; continue; }

    // 방어구
    let hit = false;
    for (const k in KIND) {
      if (!rest.startsWith(k + ' ')) continue;
      const part = rest.slice(k.length + 1).trim();
      if (PARTS.includes(part)) { out['arm'+bucket][`${part}|${KIND[k]}`] = price; hit = true; }
      break;
    }
    if (hit) continue;

    // 무기
    if (WEAPON[rest]) out['wpn'+bucket][WEAPON[rest]] = price;
  }
}

/* ── 실행 ─────────────────────────────────── */
(async () => {
  const out = { updated: null, fetchedAt: new Date().toISOString(),
    mats:{}, armJ:{}, armH:{}, accJ:{}, accH:{}, wpnJ:{}, wpnH:{} };

  for (const q of [{ search:'영혼석' }, { search:'마력석' }, { search:'ZZ' }]) {
    const { rows, updated } = await fetchAll(q);
    if (updated) out.updated = updated;
    parse(rows, out);
    console.log(`${JSON.stringify(q)} → ${rows.length}건`);
  }

  const n = o => Object.keys(o).length;
  console.log(`재료 ${n(out.mats)} / 방어구 잔영 ${n(out.armJ)} 해연 ${n(out.armH)}`);
  console.log(`장신구 잔영 ${n(out.accJ)} 해연 ${n(out.accH)} / 무기 잔영 ${n(out.wpnJ)} 해연 ${n(out.wpnH)}`);

  if (n(out.mats) < 5) { console.error('재료 시세를 거의 못 받았습니다. 저장하지 않습니다.'); process.exit(1); }

  require('fs').writeFileSync('prices.json', JSON.stringify(out, null, 1));
  console.log('prices.json 저장 완료');
})().catch(e => { console.error(e); process.exit(1); });
