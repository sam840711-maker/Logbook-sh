# SH Pilot Logbook — v0.3

오프라인 단일 페이지 PWA 전자 비행일지. 모든 데이터는 기기 안(IndexedDB)에만 저장되며 서버로 전송되지 않습니다.

## v0.3 변경점 (Pilotlog UI 반영)
- **CrewLounge PILOTLOG CSV 가져오기**: More → Data → *Import CrewLounge PILOTLOG CSV*. 비행·시뮬레이터·기재가 한 번에 들어오고, 기존 로그북과 겹치는 기록은 자동으로 건너뜁니다.
  - 시간은 분 단위, OUT/IN은 UTC `H:MM`로 해석, autoland는 `TAG_APP`의 `AL` 토큰으로 환산, multi-pilot은 `AC_MP`로 판별합니다.
- **My Total Time 대시보드** (파이차트 없음, 막대·숫자): Grand total(Aircraft / Sim / Total), Function(PIC·PICUS·SIC·DUAL·RELIEF), Flight condition(NIGHT·DAY·ACTUAL·SIM INST·CROSS CTRY), Currencies(TO/LDG day·night·AUTOLAND), Aircraft model 분해. 상단 All / Aircraft / Simulator 토글.
- **비행 입력 폼**: OUT/IN 아래 **Local 시각** 표시(공항 타임존 자동), **ACTUAL INSTRUMENT / SIMULATED INSTRUMENT** 분리, **TASK(PF/PM)**, **Paste from last flight**(직전 비행 복사 → 출발지는 직전 도착지로).
- **비행 목록**: 카드형(날짜·편명/노선·기종/등록·OUT–IN·블록), 시뮬레이터는 보라색 카드.
- Multi-pilot은 **기재 속성**(Aircraft의 Multi-pilot)으로만 관리하고, 비행마다 입력하던 체크박스는 제거했습니다(공항 운항 특성상 중복 입력 방지).

## 기능 요약
- 비행/시뮬레이터/기재/자격(면장·신검·교육) 관리, 90일 착륙·야간·autoland recency, 자격 만료 D-day.
- 공항 IATA→ICAO 자동 변환(예: ICN→RKSI), OUT/IN으로 블록타임 자동 계산.
- PDF 출력 3종: EASA / FAA / GCAA (가로 A4 원장 + 합계/요약 페이지, 영문).
- JSON 백업/복원, CSV 내보내기.

## 설치 (GitHub Pages)
1. 이 폴더의 모든 파일을 저장소 루트(또는 /docs)에 업로드합니다. 폴더 구조(특히 lib/)를 그대로 유지하세요.
2. Settings → Pages → Branch 지정 후 배포.
3. 배포 URL을 모바일 브라우저로 열고 홈 화면에 추가하면 앱처럼 전체화면·오프라인 동작합니다.

## 파일
```
index.html              앱 본체 (단일 파일)
manifest.webmanifest    PWA 매니페스트
sw.js                   서비스워커(오프라인 캐시)
icon.svg / icon-maskable.svg
lib/jspdf.umd.min.js    PDF 엔진(jsPDF)
lib/logbook-pdf.js      EASA/FAA/GCAA 원장 생성기
lib/airports.js         공항 ICAO/IATA/타임존 DB (IATA 보유 7,914개)
```

## 참고
- Local 시각은 IATA 코드가 있는 공항만 지원합니다(소형 비IATA 공항은 UTC만 표시).
- PDF는 영문 전용입니다(한글 비고는 표시되지 않을 수 있음 — 의도된 동작).
- GCAA 제출용 정식 양식은 EASA식 원장 + 면장 대조 주석으로 구성했습니다. 공식 제출 전 최신 GCAA 서식을 한 번 확인하세요.
- 데이터는 기기에만 저장되므로 정기적으로 JSON 백업을 권장합니다.
