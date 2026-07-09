"""
삼성자산운용 AI 거버넌스 다이어그램 PNG 생성 (Pillow 사용)
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT  = os.path.dirname(os.path.abspath(__file__))
FONT_BOLD   = 'C:/Windows/Fonts/malgunbd.ttf'  # 맑은 고딕 Bold
FONT_NORMAL = 'C:/Windows/Fonts/malgun.ttf'    # 맑은 고딕

# ── 색상 팔레트 ────────────────────────────────────────────────
C = {
    'navy_dark' : (26,  60, 110),
    'navy_mid'  : (46, 109, 180),
    'navy_light': (74, 144, 217),
    'fill_h2'   : (234, 242, 255),
    'fill_even' : (240, 245, 252),
    'white'     : (255, 255, 255),
    'text_dark' : (28,  28,  28),
    'text_gray' : (90,  90,  90),
    'line_light': (208, 217, 232),
    'line_mid'  : (154, 176, 207),
    'green'     : (31, 173,  94),
    'orange'    : (255, 152,  0),
    'red'       : (229,  57,  53),
    'yellow_bg' : (255, 243, 205),
    'yellow_brd': (240, 165,  0),
    'gate_text' : (122,  78,  0),
    'bg'        : (255, 255, 255),
}

def font(size, bold=False):
    path = FONT_BOLD if bold else FONT_NORMAL
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

def draw_rounded_rect(draw, xy, fill, outline, radius=10, width=2):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def text_lines(draw, lines, x, y, fonts, colors, line_h):
    cy = y
    for txt, fnt, col in zip(lines, fonts, colors):
        draw.text((x, cy), txt, font=fnt, fill=col)
        cy += line_h

def text_center(draw, text, cx, cy, fnt, fill):
    bb = draw.textbbox((0, 0), text, font=fnt)
    w, h = bb[2]-bb[0], bb[3]-bb[1]
    draw.text((cx - w//2, cy - h//2), text, font=fnt, fill=fill)

def arrow_down(draw, cx, y0, y1, color, label=None, label_font=None):
    draw.line([(cx, y0), (cx, y1-10)], fill=color, width=2)
    draw.polygon([(cx-7, y1-10), (cx+7, y1-10), (cx, y1)], fill=color)
    if label and label_font:
        bb = draw.textbbox((0,0), label, font=label_font)
        w = bb[2]-bb[0]
        draw.rounded_rectangle([cx-w//2-8, y0+6, cx+w//2+8, y0+26], radius=8, fill=(255,255,255), outline=C['line_light'], width=1)
        draw.text((cx-w//2, y0+8), label, font=label_font, fill=C['text_gray'])

def arrow_right(draw, x0, cy, x1, color):
    draw.line([(x0, cy), (x1-9, cy)], fill=color, width=2)
    draw.polygon([(x1-9, cy-6), (x1-9, cy+6), (x1, cy)], fill=color)


# ════════════════════════════════════════════════════════════════
# 다이어그램 1: 문서 계층도
# ════════════════════════════════════════════════════════════════
def make_doc_hierarchy():
    W, H = 960, 740
    img = Image.new('RGB', (W, H), C['bg'])
    d   = ImageDraw.Draw(img)

    # 제목
    d.rounded_rectangle([20, 16, W-20, 46], radius=5, fill=C['navy_dark'])
    text_center(d, 'AI 거버넌스 문서 계층 구조', W//2, 31, font(14, True), C['white'])

    layers = [
        {
            'fill': C['navy_light'], 'outline': C['navy_mid'], 'text_c': C['white'],
            'title': '🏛  운영방안_AX위원회   v2.1 | IT-AX-GOV-001',
            'desc' : 'AX 위원회 구성·임무·회의 운영 | 고위험 과제 최종 의결 | 반기 보고 수령',
            'badge': '경영진 · 임원',
        },
        {
            'fill': C['navy_dark'], 'outline': (13, 43, 80), 'text_c': C['white'],
            'title': '📜  규정_AI_거버넌스   v6.3 | IT-AX-REG-001   WHY & WHAT',
            'desc' : 'AI Native 원칙 · 절대 금지사항 · 위험 분류(고/중/저) · 기밀등급 G1/G2/G3 · 에이전트 유형 0~4',
            'badge': '전 임직원',
        },
        {
            'fill': C['navy_mid'], 'outline': C['navy_dark'], 'text_c': C['white'],
            'title': '📋  지침_AI_거버넌스   v7.7 | IT-AX-OPS-002   HOW',
            'desc' : 'Phase Gate 0~6 · Agent 라이프사이클 · CREW 이관 완성도 5기준 · 암묵지 3차원 · R&R 매트릭스 · 우수 에이전트 보상',
            'badge': 'AX팀 · AI CREW · 부서장',
        },
        {
            'fill': C['fill_h2'], 'outline': C['navy_mid'], 'text_c': C['navy_dark'],
            'title': '📖  가이드라인_AI_거버넌스   v5.1 | IT-AX-GUIDE-003   실무 적용',
            'desc' : '솔루션 유형 선택 · Kill Switch 구현 · 감사 로그 패턴 · 배포 환경 결정 트리 · 보안 체크리스트',
            'badge': 'AI CREW · 개발 참여자',
        },
    ]
    arrows = [
        '고위험 과제 승인 · 거버넌스 정책 방향 결정',
        '원칙 · 금지 · 유형 · 기밀등급 정의 → 이행 기준 구체화',
        '단계 · 라이프사이클 · R&R → 실무 구현 기준',
    ]

    BOX_H = 100
    GAP_A = 56   # 박스 사이 화살표 공간
    start_y = 62

    for i, layer in enumerate(layers):
        y0 = start_y + i * (BOX_H + GAP_A)
        y1 = y0 + BOX_H
        draw_rounded_rect(d, [30, y0, W-30, y1], layer['fill'], layer['outline'], radius=10, width=2)
        # 타이틀
        d.text((50, y0+14), layer['title'], font=font(13, True), fill=layer['text_c'])
        # 설명
        d.text((50, y0+38), layer['desc'], font=font(10), fill=(*layer['text_c'][:3], 210) if layer['text_c']==C['white'] else C['text_gray'])
        # badge (우측)
        bb = d.textbbox((0,0), layer['badge'], font=font(10))
        bw = bb[2]-bb[0]
        bx = W - 50 - bw - 16
        by = y0 + 14
        d.rounded_rectangle([bx-8, by-3, bx+bw+8, by+bb[3]-bb[1]+3], radius=8,
            fill=(255,255,255,40) if layer['text_c']==C['white'] else C['line_light'],
            outline=(255,255,255,80) if layer['text_c']==C['white'] else C['line_mid'], width=1)
        d.text((bx, by), layer['badge'], font=font(10), fill=layer['text_c'])

        # 화살표 (다음 박스로)
        if i < len(arrows):
            ay0 = y1 + 4
            ay1 = y1 + GAP_A - 4
            lbl = arrows[i]
            # 가는 선
            d.line([(W//2, ay0), (W//2, ay1-12)], fill=C['line_mid'], width=2)
            d.polygon([(W//2-7, ay1-12), (W//2+7, ay1-12), (W//2, ay1)], fill=C['line_mid'])
            # 라벨 (선 위에)
            bb2 = d.textbbox((0,0), lbl, font=font(9))
            lw = bb2[2]-bb2[0]
            lx = W//2 - lw//2
            ly = ay0 + 8
            d.rounded_rectangle([lx-8, ly-2, lx+lw+8, ly+14], radius=7, fill=C['white'], outline=C['line_light'], width=1)
            d.text((lx, ly), lbl, font=font(9), fill=C['text_gray'])

    img.save(os.path.join(OUT, 'diag1_doc_hierarchy.png'), dpi=(150, 150))
    print('✓ diag1_doc_hierarchy.png')


# ════════════════════════════════════════════════════════════════
# 다이어그램 2: Phase Gate 플로우
# ════════════════════════════════════════════════════════════════
def make_phase_flow():
    W, H = 1280, 380
    img = Image.new('RGB', (W, H), C['bg'])
    d   = ImageDraw.Draw(img)

    d.rounded_rectangle([20, 14, W-20, 44], radius=5, fill=C['navy_dark'])
    text_center(d, 'AI 과제 Phase Gate 플로우  (Phase 0 → Phase 6)', W//2, 29, font(14, True), C['white'])

    BOXY = 90       # 박스 상단 y
    BOX_H = 84
    BOX_W = 100
    GATE_S = 54     # 게이트(다이아) 한 변
    GAP = 36        # 박스 간 화살표 폭
    PH_COLORS = [
        ((234,242,255),(74,144,217)),
        ((220,230,241),(46,109,180)),
        ((200,218,235),(46,109,180)),
        ((46,109,180),(26,60,110)),
        ((26,60,110),(13,43,80)),
    ]
    phases = [
        ('Phase 0','🔍 발굴','현업 CREW\n아이디어 발굴','없음'),
        ('Phase 1','📝 기획','과제 정의서 v0\nAX팀 접수·등록','없음'),
        ('Phase 2','🎨 설계','기술 검토·설계\nAX팀 지원','없음'),
        ('Phase 3','🔨 MVP','AX 엔지니어\n주도 개발','없음'),
        ('Phase 4','🔬 심사','심사 보고서\n위험 평가서','없음'),
        ('Phase 5','🧪 파일럿','임시 ID 발급\n현업 UAT·KPI','AX-DEV-'),
        ('Phase 6','✅ 운영','정식 ID 발급\nKPI 모니터링','AX-YYYY-AGT-'),
    ]
    gates = [
        (3, '스코어카드\n70점↑?', '6차원\n100점'),
        (4, '고위험\n과제?', '투자·운용\n공시·컴플'),
    ]
    gate_positions = {3: None, 4: None}  # gate after phase index

    # 각 요소의 x 위치 계산
    items = []  # (type, phase_or_gate, x)
    x = 40
    for i, ph in enumerate(phases):
        items.append(('phase', i, x))
        x += BOX_W
        # 게이트가 이 뒤에 오는가?
        gate = None
        for g in gates:
            if g[0] == i:
                gate = g
                break
        if gate:
            items.append(('arrow', None, x)); x += GAP
            items.append(('gate', gate, x)); x += GATE_S * 2 + 4
        if i < len(phases)-1:
            items.append(('arrow', None, x)); x += GAP

    # 실제 그리기
    phase_centers = {}
    for typ, val, xi in items:
        if typ == 'phase':
            pidx = val
            ph = phases[pidx]
            ci = min(pidx, len(PH_COLORS)-1)
            fill, outline = PH_COLORS[ci]
            text_c = C['white'] if pidx >= 3 else C['navy_dark']
            draw_rounded_rect(d, [xi, BOXY, xi+BOX_W, BOXY+BOX_H], fill, outline, radius=8, width=2)
            # Phase 번호
            d.text((xi+4, BOXY+4), ph[0], font=font(9, True), fill=text_c)
            # 아이콘 + 이름
            title_w = d.textbbox((0,0), ph[1], font=font(11, True))[2]
            d.text((xi+(BOX_W-title_w)//2, BOXY+22), ph[1], font=font(11, True), fill=text_c)
            # 설명
            for j, line in enumerate(ph[2].split('\n')):
                lw = d.textbbox((0,0), line, font=font(8))[2]
                d.text((xi+(BOX_W-lw)//2, BOXY+42+j*14), line, font=font(8), fill=text_c)
            # ID badge
            if ph[3] != '없음':
                bw = d.textbbox((0,0), ph[3], font=font(8))[2]
                bx = xi + (BOX_W - bw - 12)//2
                d.rounded_rectangle([bx, BOXY+BOX_H-20, bx+bw+12, BOXY+BOX_H-4], radius=6,
                    fill=(255,255,255,40), outline=(255,255,255,80), width=1)
                d.text((bx+6, BOXY+BOX_H-19), ph[3], font=font(7), fill=text_c)
            phase_centers[pidx] = xi + BOX_W//2

        elif typ == 'gate':
            _, label_str, sub_str = val
            # 다이아몬드
            cx2 = xi + GATE_S
            cy2 = BOXY + BOX_H//2
            pts = [(cx2, cy2-GATE_S), (cx2+GATE_S, cy2), (cx2, cy2+GATE_S), (cx2-GATE_S, cy2)]
            d.polygon(pts, fill=C['yellow_bg'], outline=C['yellow_brd'])
            d.polygon(pts, outline=C['yellow_brd'], width=2)
            for j, ln in enumerate(label_str.split('\n')):
                lw = d.textbbox((0,0), ln, font=font(9, True))[2]
                d.text((cx2-lw//2, cy2-12+j*14), ln, font=font(9, True), fill=C['gate_text'])
            # 서브 텍스트 (아래)
            for j, ln in enumerate(sub_str.split('\n')):
                sw = d.textbbox((0,0), ln, font=font(8))[2]
                d.text((cx2-sw//2, cy2+GATE_S+5+j*12), ln, font=font(8), fill=C['text_gray'])

        elif typ == 'arrow':
            cy2 = BOXY + BOX_H//2
            arrow_right(d, xi, cy2, xi+GAP, C['line_mid'])

    # 반려 경로 (Gate 0 아래로)
    # Gate 0 위치
    for typ, val, xi in items:
        if typ == 'gate' and val[0] == 3:
            cx2 = xi + GATE_S
            cy2 = BOXY + BOX_H//2
            # 반려 화살표 (아래로)
            d.line([(cx2, cy2+GATE_S), (cx2, cy2+GATE_S+44)], fill=C['red'], width=2)
            d.polygon([(cx2-6, cy2+GATE_S+36), (cx2+6, cy2+GATE_S+36), (cx2, cy2+GATE_S+46)], fill=C['red'])
            d.rounded_rectangle([cx2-44, cy2+GATE_S+46, cx2+44, cy2+GATE_S+62], radius=8, fill=(255,235,238), outline=C['red'], width=1)
            text_center(d, '❌ 반려 (재신청 가능)', cx2, cy2+GATE_S+54, font(9), C['red'])
        if typ == 'gate' and val[0] == 4:
            cx2 = xi + GATE_S
            cy2 = BOXY + BOX_H//2
            # AX 위원회 우회 경로 (위로)
            d.line([(cx2, cy2-GATE_S), (cx2, cy2-GATE_S-40)], fill=C['navy_mid'], width=2)
            d.rounded_rectangle([cx2-62, cy2-GATE_S-62, cx2+62, cy2-GATE_S-40], radius=8, fill=(234,242,255), outline=C['navy_mid'], width=1)
            text_center(d, '🏛 AX 위원회 의결', cx2, cy2-GATE_S-51, font(9, True), C['navy_dark'])

    # 범례
    LEG_Y = BOXY + BOX_H + 60
    legends = [
        ((234,242,255),(74,144,217),'현업 CREW 주도'),
        (C['navy_mid'],C['navy_dark'],'AX팀 주도'),
        ((31,173,94),(20,120,65),'운영 단계'),
        (C['yellow_bg'],C['yellow_brd'],'게이트 (의사결정)'),
    ]
    lx = 40
    for fill, out, lbl in legends:
        d.rounded_rectangle([lx, LEG_Y, lx+18, LEG_Y+14], radius=3, fill=fill, outline=out, width=1)
        d.text((lx+22, LEG_Y+1), lbl, font=font(9), fill=C['text_dark'])
        lx += d.textbbox((0,0), lbl, font=font(9))[2] + 46

    img.save(os.path.join(OUT, 'diag2_phase_flow.png'), dpi=(150, 150))
    print('✓ diag2_phase_flow.png')


# ════════════════════════════════════════════════════════════════
# 다이어그램 3: Agent 라이프사이클
# ════════════════════════════════════════════════════════════════
def make_agent_lifecycle():
    W, H = 960, 680
    img = Image.new('RGB', (W, H), C['bg'])
    d   = ImageDraw.Draw(img)

    d.rounded_rectangle([20, 14, W-20, 44], radius=5, fill=C['navy_dark'])
    text_center(d, '에이전트 라이프사이클 — 상태 머신', W//2, 29, font(14, True), C['white'])

    states = [
        {'name':'등록 전',         'id':'ID 없음 (Phase 0~4)',         'note':'CREW 자율 실험 단계',       'fill':(230,240,255), 'outline':C['navy_light'],  'icon':'⭕', 'text_c':C['navy_dark']},
        {'name':'🟡 등록신청',     'id':'AX-DEV-YYYY-XXX (임시)',       'note':'AX팀 임시 ID 발급·파일럿', 'fill':(255,248,225), 'outline':C['yellow_brd'], 'icon':'',   'text_c':C['gate_text']},
        {'name':'🟢 운영 (Active)','id':'AX-YYYY-AGT-XXX (정식)',      'note':'KPI 모니터링·정식 접근',   'fill':(232,245,233), 'outline':(67,160,71),     'icon':'',   'text_c':(27,94,32)},
        {'name':'🔴 폐기 (Retired)','id':'ID 비활성화',                 'note':'접근권한 전체 회수',        'fill':(255,235,238), 'outline':C['red'],        'icon':'',   'text_c':(183,28,28)},
    ]
    MAIN_X = 80
    BOX_W_S = 360
    BOX_H_S = 72
    START_Y = 70
    GAP_S   = 58

    for i, st in enumerate(states):
        y0 = START_Y + i * (BOX_H_S + GAP_S)
        y1 = y0 + BOX_H_S
        draw_rounded_rect(d, [MAIN_X, y0, MAIN_X+BOX_W_S, y1], st['fill'], st['outline'], radius=10, width=2)
        d.text((MAIN_X+16, y0+10), st['name'], font=font(13, True), fill=st['text_c'])
        d.text((MAIN_X+16, y0+30), st['id'],   font=font(10, False), fill=st['text_c'])
        d.text((MAIN_X+16, y0+48), st['note'], font=font(9), fill=st['text_c'])

        # 화살표 (다음 상태로)
        if i < len(states)-1:
            arrow_labels = [
                'Phase 5 파일럿 진입 승인 → AX팀 임시 ID 발급',
                'Phase 6 운영 승격: KPI 80%↑ · 사고 0건',
                'KPI 지속 미달 · 업무 변화 · 보안 사고 · 복구 불가',
            ]
            ay0 = y1 + 4
            ay1 = y1 + GAP_S - 4
            cx  = MAIN_X + BOX_W_S // 2
            lbl = arrow_labels[i]
            d.line([(cx, ay0), (cx, ay1-12)], fill=C['line_mid'], width=2)
            d.polygon([(cx-7, ay1-12), (cx+7, ay1-12), (cx, ay1)], fill=C['line_mid'])
            bb = d.textbbox((0,0), lbl, font=font(9))
            lw = bb[2]-bb[0]
            lx = cx - lw//2
            ly = ay0 + 10
            d.rounded_rectangle([lx-8, ly-2, lx+lw+8, ly+14], radius=7, fill=C['white'], outline=C['line_light'], width=1)
            d.text((lx, ly), lbl, font=font(9), fill=C['text_gray'])

    # Suspended 상태 (Active 옆에)
    SUS_X = MAIN_X + BOX_W_S + 70
    SUS_Y = START_Y + 2 * (BOX_H_S + GAP_S)
    SUS_W = 320
    draw_rounded_rect(d, [SUS_X, SUS_Y, SUS_X+SUS_W, SUS_Y+BOX_H_S], (255,243,224), (255,152,0), radius=10, width=2)
    d.text((SUS_X+14, SUS_Y+10), '🔵 일시 중단 (Suspended)', font=font(12, True), fill=(122,78,0))
    d.text((SUS_X+14, SUS_Y+30), '정식 ID 유지',               font=font(10), fill=(122,78,0))
    d.text((SUS_X+14, SUS_Y+46), '데이터 접근 차단 · 원인 분석', font=font(9), fill=(122,78,0))

    # Active ↔ Suspended 화살표
    active_y = START_Y + 2 * (BOX_H_S + GAP_S)
    active_cx = MAIN_X + BOX_W_S
    sus_cx    = SUS_X
    mid_cy    = active_y + BOX_H_S // 2

    # → (Active to Suspended: 사고·점검)
    d.line([(active_cx, mid_cy - 8), (sus_cx - 1, mid_cy - 8)], fill=C['orange'], width=2)
    d.polygon([(sus_cx-10, mid_cy-15), (sus_cx-10, mid_cy-1), (sus_cx, mid_cy-8)], fill=C['orange'])
    top_lbl = '사고 · 점검'
    bb = d.textbbox((0,0), top_lbl, font=font(9))
    lw = bb[2]-bb[0]
    mx = (active_cx + sus_cx)//2 - lw//2
    d.rounded_rectangle([mx-6, mid_cy-22, mx+lw+6, mid_cy-8], radius=6, fill=C['white'], outline=(255,200,100), width=1)
    d.text((mx, mid_cy-21), top_lbl, font=font(9), fill=C['orange'])

    # ← (Suspended to Active: 원인 해소)
    d.line([(sus_cx, mid_cy + 8), (active_cx + 1, mid_cy + 8)], fill=(67,160,71), width=2)
    d.polygon([(active_cx+10, mid_cy+1), (active_cx+10, mid_cy+15), (active_cx, mid_cy+8)], fill=(67,160,71))
    bot_lbl = '원인 해소'
    bb2 = d.textbbox((0,0), bot_lbl, font=font(9))
    lw2 = bb2[2]-bb2[0]
    mx2 = (active_cx + sus_cx)//2 - lw2//2
    d.rounded_rectangle([mx2-6, mid_cy+8, mx2+lw2+6, mid_cy+22], radius=6, fill=C['white'], outline=(150,200,150), width=1)
    d.text((mx2, mid_cy+9), bot_lbl, font=font(9), fill=(27,94,32))

    # 폐기 기준 박스
    note_y = START_Y + 3 * (BOX_H_S + GAP_S) + BOX_H_S + 14
    note_lines = [
        '⚠️  폐기 기준',
        '① 3개월 이상 미사용   ② KPI 기준치 2개 분기 연속 미달',
        '③ 보안 사고 및 규제 위반 발생   ④ 담당 CREW 부재 + 이관 계획 없음',
    ]
    d.rounded_rectangle([MAIN_X, note_y, MAIN_X+BOX_W_S, note_y+60], radius=8, fill=(255,235,238), outline=C['red'], width=1)
    d.text((MAIN_X+12, note_y+8),  note_lines[0], font=font(10, True), fill=(183,28,28))
    d.text((MAIN_X+12, note_y+26), note_lines[1], font=font(8),        fill=(183,28,28))
    d.text((MAIN_X+12, note_y+42), note_lines[2], font=font(8),        fill=(183,28,28))

    img.save(os.path.join(OUT, 'diag3_agent_lifecycle.png'), dpi=(150, 150))
    print('✓ diag3_agent_lifecycle.png')


if __name__ == '__main__':
    make_doc_hierarchy()
    make_phase_flow()
    make_agent_lifecycle()
    print('All diagrams generated.')
