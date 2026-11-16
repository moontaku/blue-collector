# BLUE COLLECTOR — REDESIGN 07 검증 보고서

검증 대상: 첨부된 **V6.1 ZIP** 원본과 REDESIGN 07 수정본. 원본 폴더의 5개 파일이 첨부 ZIP 내부 파일과 바이트 단위로 일치함을 별도 확인했다.

## 정적 비교 / 절대 변경 금지 항목

| 항목 | 결과 | 확인 방법 |
|---|---|---|
| 규칙 상수 | **PASS** | 원본과 17개 규칙·저장 키 선언이 문자 단위 동일 |
| 생성·추적·아이템·충돌·입력 등 게임플레이 코드 | **PASS (소스 비교)** | 해당 함수 구간과 전체 JS diff 확인. 허용된 표시 관련 함수/라인과 표시용 GAME_VERSION 외 변경 없음 |
| 점수/코인 정산 | **PASS (소스 비교)** | finishGame 내 점수·보너스·코인 산식 및 보상 지급/저장 라인 불변 |
| localStorage 키 및 구조 | **PASS (소스 비교)** | META_STORAGE_KEY, defaultMeta, load/saveMeta 데이터 정의 및 사용 구조 불변 |
| CSV 열 구성 및 내보내기 | **PASS (소스 비교)** | exportCsv 함수 구간 바이트 동일 |
| BGM 로직 및 WAV 파일 | **PASS (소스 비교)** | JS 재생 처리 변경 없음, WAV 바이트 동일. **실제 음향 청취는 미확인** |
| 기존 DOM ID | **PASS** | 99개 모두 보존, 새 표시용 ID 2개 추가: game-version, result-best-comparison |
| 외부 CDN/이미지/요청 | **PASS (소스 검토)** | 신규 외부 URL/이미지/CDN 없음. 폰트 경로는 주석이며 실제 요청 없음 |
| GitHub 배포 | **미실시** | 요청에 따라 업로드/배포하지 않음 |

## 브라우저 체크리스트

Chromium headless, **960×540** 및 **1440×900**에서 두 번 확인했다. 환경에서 `file://` 직접 접속이 차단되어 실제 로컬 파일을 별개로 로드하지 못했고, **수정된 HTML·CSS·JS 내용을 페이지에 인라인으로 삽입해 테스트**했다. 따라서 OS별 로컬 파일 접근 및 실제 음악 재생 성공은 별도 확인이 필요하다.

| 요청 항목 | 결과 | 세부 사항 |
|---|---|---|
| 메인 → HOW TO PLAY → 시작 | **PASS** | 3개 도형과 버튼·메뉴 복귀, 최초 실행 안내 경로 확인 |
| 안전 ↔ 전쟁 전환 | **PASS** | SPACE 양방향 전환, SECURED 한 번만 표시 |
| 게임 오버 결과 BEST 비교 | **PASS (주입 상태)** | 기존 BEST 675, 현재 점수 105 → `BEST 675 (-570)` 확인 |
| 완주 결과 NEW RECORD | **PASS (주입 상태)** | 이전 BEST 675, 점수 855 → `NEW RECORD` 한 번 표시 확인 |
| RECORDS/SHOP/SETTINGS 열기·닫기 | **PASS** | 메인 및 결과 화면 경로 테스트 |
| SFX/BGM 토글 | **PASS (UI 동작)** | ON/OFF 표기 변화 확인, WAV 실제 재생 확인은 제외 |
| CSV 다운로드 동작 | **PASS** | 결과 화면에서 원래 파일명 다운로드 성공. CSV 헤더/열은 원본 유지 |
| 960×540 / 큰 창 텍스트 잘림 | **PASS (검증한 화면)** | HELP 스크롤 높이=컨테이너 높이, 주요 메뉴·결과 및 설정 육안 확인 |
| JavaScript 콘솔 오류 없음 | **PASS (테스트 범위)** | 두 뷰포트의 UI 흐름에서 관찰된 JS 및 console error 0건 |
| 정상 플레이 30초를 실시간 완주 | **미실시** | 결과 화면은 함수 호출·테스트 값 주입으로 별도 검증. 실제 30초 플레이는 사용자 QA 필요 |
| OS별 실제 BGM/SFX 출력 | **미실시** | 토글 UI만 확인. 음향 출력과 사용자 장치 설정은 확인하지 못함 |

## CSS: 삭제하지 않은 정리 후보

현재 `index.html` 및 `game.js` 문자열 참조가 발견되지 않은 **잠재적 미사용 선택자**다. 과거 CSS가 우선순위, 의사 클래스, 예전 버전 스타일을 포함할 수 있어 *확정된 미사용 코드가 아니다*. 요청에 따라 **어떤 CSS도 삭제하지 않았다**.

- `.intro-card` (style.css 약 16행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.intro-icon` (style.css 약 19행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.blue-block` (style.css 약 20행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.red-block` (style.css 약 21행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.gold-dot` (style.css 약 22행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.rules` (style.css 약 23행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.mode-guide` (style.css 약 568행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.meta-bar` (style.css 약 407행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.start-actions` (style.css 약 410행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.microcopy` (style.css 약 29행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.menu-links` (style.css 약 939행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.menu-brand-mark` (style.css 약 914행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.menu-grid-mark` (style.css 약 908행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.menu-controls` (style.css 약 935행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.result-metrics` (style.css 약 53행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함
- `.meta-actions` (style.css 약 469행): 현재 마크업/JS에서 해당 클래스 문자열을 찾지 못함

향후 CSS 삭제 전에는 DOM 동적 생성, 미디어 쿼리, 테스트 모드에서 해당 스타일이 사용되는지 별도 검토해야 한다.

## 분류 및 결론

- **확인한 사실**: 지정한 UI 흐름과 정적 규칙 비교가 위 표와 같이 통과했다.
- **확인하지 않은 것**: 실제 30초 연속 플레이 전 과정, 다양한 운영체제의 로컬 파일/오디오 재생, 외부 사용자 사용성 평가.
- **남은 작업**: Chrome에서 ZIP을 직접 실행해 게임을 1회 완주하고, BGM과 SFX를 귀로 확인한 뒤 승인 여부를 결정한다.


## REDESIGN 07.1 — 부분 수정 검증 (2026-11-16)

원본: REDESIGN 07. 이번 릴리스는 **메뉴·SETTINGS 표시 관련 변경만** 포함한다. REDESIGN 07의 앞선 전체 QA를 새 빌드에 대한 재검증으로 오해하지 않도록 아래에 이번에 실제 수행한 테스트만 적는다.

| 확인 항목 | 결과 | 근거·한계 |
|---|---|---|
| SETTINGS 빈 BGM CREDIT 제거 | PASS | 표시 행 삭제, VERSION v1.0.0 유지. 960×540/1440×900 화면 확인 |
| 메뉴에서 HOW TO PLAY 열기 | PASS | 상단 BACK만 표시, 하단 버튼 숨김 확인 |
| HOW TO PLAY 키보드 포커스 | PASS | Tab/Shift+Tab 시 보이는 BACK에 포커스 유지 |
| HOW TO PLAY → BACK → START | PASS | 메인 복귀 후 게임 시작 확인 (직전 설명 열기로 helpSeen 기록됨) |
| 첫 방문 START → 도움말 → START GAME | PASS | 기존 하단 시작 버튼 표시 및 클릭 후 플레이 진입 확인 |
| JavaScript 문법 | PASS | Node `--check` |
| JavaScript 페이지 오류 | PASS | Chromium 테스트 시 pageerror 0건. 테스트 범위 한정 |
| style.css / WAV 파일 | 동일 | 원본과 SHA-256/바이트 내용 동일 |
| 게임 규칙·저장·CSV·BGM 동작 | 소스상 변경 없음 | game.js diff는 openHelp 및 Tab 포커스 두 구간에 국한. 실시간 전체 게임/실제 음향 테스트는 미실시 |
| 로컬 ZIP을 Chrome에서 직접 실행 | 미실시 | 자동화 환경의 file:// 차단으로 HTML·CSS·JS 내용을 인라인으로 삽입해 검증 |

**CSS 정리 연기:** 기존 16개 후보와 크레딧 관련 잔여 CSS는 요청대로 삭제하지 않았다.
**남은 사용자 QA:** 다운로드한 ZIP의 index.html 직접 실행, 실제 30초 게임 1회 및 BGM/SFX 청취.
