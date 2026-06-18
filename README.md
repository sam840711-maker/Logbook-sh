# SH Pilot Logbook (v0.1 + PDF)

조종사 비행 로그북 · 오프라인 PWA · 단일파일 중심

## 구성 파일
```
index.html              앱 본체 (UI + 로직, IndexedDB 저장)
manifest.webmanifest    PWA 설치 정보
sw.js                   서비스워커 (오프라인 캐시)
icon.svg, icon-maskable.svg   앱 아이콘
lib/jspdf.umd.min.js    PDF 생성 라이브러리 (로컬 동봉, 오프라인 동작)
lib/logbook-pdf.js      EASA/FAA/GCAA 출력 엔진
```
모든 경로는 상대경로이므로 폴더째 어디에 올려도 동작합니다.

---

## GitHub Pages로 배포 (폰에서 설치해서 쓰기)

### 방법 A — 웹에서 업로드 (가장 간단)
1. github.com 로그인 → 우상단 **+ → New repository**
2. 이름 예: `logbook` → **Public** → Create repository
3. 빈 레포 화면에서 **uploading an existing file** 클릭
4. 이 zip의 **내용물 전체**(index.html, sw.js, lib 폴더 등)를 드래그해서 업로드 → **Commit changes**
   - ⚠️ `sh-pilot-logbook` 폴더 자체가 아니라, 그 **안의 파일들**을 올립니다. (index.html이 레포 루트에 있어야 함)
5. 레포 상단 **Settings → Pages**
6. **Source: Deploy from a branch** → Branch: `main` / `/ (root)` → **Save**
7. 1~2분 뒤 같은 화면에 주소가 뜸:
   `https://<사용자명>.github.io/logbook/`

### 방법 B — git (터미널)
```bash
git init
git add .
git commit -m "logbook v0.1"
git branch -M main
git remote add origin https://github.com/<사용자명>/logbook.git
git push -u origin main
```
이후 Settings → Pages에서 위 6~7번과 동일하게 설정.

### 업데이트할 때
파일을 다시 올리고 commit하면 됩니다. 새 버전이 안 보이면 `sw.js`의 `CACHE` 값(`logbook-v0-1`)을 올려서(예: `v0-2`) 캐시를 갱신하세요.

---

## 폰에 앱처럼 설치 (PWA)

- **iPhone (Safari)**: 배포 주소 열기 → 공유 버튼 → **홈 화면에 추가**
- **Android (Chrome)**: 주소 열기 → 메뉴(⋮) → **앱 설치 / 홈 화면에 추가**

설치하면 전체화면 앱으로 뜨고, 한 번 연 뒤에는 **오프라인에서도** 동작합니다. 데이터는 기기 내부(IndexedDB)에만 저장됩니다.

> ⚠️ 데이터는 이 기기/브라우저에만 있습니다. 기기 변경·캐시 삭제에 대비해 **더보기 → JSON 백업**을 주기적으로 받아두세요. 복원은 같은 화면의 JSON 복원으로 합니다.

---

## PDF 출력
더보기 → 조종사 이름/라이선스 입력 후 **EASA / FAA / GCAA** 버튼.
- 원장(좌우 스크롤형 표) + 페이지별/누계 합계
- 요약 페이지: 총계, 기종별 집계, 시뮬레이터 요약, 증명·서명란
- 국제 제출을 위해 **영문**으로 출력됩니다(한글 비고는 표시 안 될 수 있음).
- GCAA는 라이선스 총계와 대조하라는 안내가 요약 페이지에 추가됩니다. 제출 전 실제 GCAA/소속 항공사 요구 양식과 한 번 더 대조하세요.

## 로컬에서 바로 열기
`index.html`을 더블클릭하면 대부분 동작하지만, 서비스워커/일부 기능은 `http(s)`에서만 완전히 동작합니다. 폰 설치 전 PC 확인은 간단한 로컬 서버 권장:
```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```
