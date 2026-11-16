# Playtests

플레이 테스트 기록(CSV)을 모아 둔 폴더입니다.

| 파일 | 게임 버전 | 내용 |
|---|---|---|
| v1.0.0_normal_safe-vs-war.csv | v1.0.0 (STEP 6-5-4) | 보통 난이도, 보호막 없음. 1-10판 안전 모드, 11-22판 전쟁 모드 (22판) |
| v1.0.0_difficulty-and-shield.csv | v1.0.0 (STEP 6-5-4) | 난이도별 테스트. 어려움 모드에서 보호막 3회 사용 |

- 테스트 방법: 직접 플레이하고 게임이 내보내는 CSV를 그대로 저장
- 표본이 작아서 모드 간 차이를 단정하지 않습니다.
- v1.0.0 CSV에는 아직 게임 버전 열이 없어 이 표로 버전을 구분합니다.
  
## v1.2.0 빌드 테스트 (수집 당시 표기: v1.3.0-test.2)

릴리즈 v1.2.0과 코드는 같고 버전 표기만 다릅니다.

| 파일 | 내용 |
|---|---|
| v1.3.0-test.2_normal_safe-vs-war_alternating_unaware.csv | 보통 난이도, 보호막 없음, 30판. 홀수 회차 안전 모드, 짝수 회차 전쟁 모드. NEAR MISS를 의식하지 않고 플레이 |
| v1.3.0-test.2_normal_safe_seeking.csv | 보통 난이도, 보호막 없음, 안전 모드 10판. NEAR MISS를 일부러 노리고 플레이. 번갈아 하지 않음 |

- 이 CSV에는 `game_version`, `near_miss_count`, `near_miss_points` 열이 끝에 추가되어 있습니다.
- NEAR MISS 점수는 최종 점수와 코인 기준 점수에 포함됩니다.
