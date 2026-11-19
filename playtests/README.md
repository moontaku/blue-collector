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

## 외부 플레이어 기록 (v1.2.0 ~ v1.2.4-test)

다른 사람이 직접 플레이하고 게임에서 내보낸 CSV입니다. 이름은 알파벳으로만 구분했고(A~J), 같은 알파벳은 같은 사람입니다. 개인을 식별할 수 있는 정보는 CSV에 없습니다.

| 파일 | 판 수 | 내용 |
|---|---|---|
| v1.2.0_normal_external_testerA.csv | 13 | 보통 난이도 |
| v1.2.0_normal_external_testerB.csv | 7 | 보통 난이도 |
| v1.2.0_normal_external_testerC.csv | 5 | 보통 난이도 |
| v1.2.0_normal_external_testerE.csv | 26 | 보통 난이도 |
| v1.2.1-test_normal_external_testerD.csv | 10 | 보통 난이도 |
| v1.2.1-test_normal_external_testerF.csv | 11 | 보통 난이도 |
| v1.2.2-test_normal_external_testerE.csv | 64 | 보통 난이도. 위 v1.2.0의 E와 같은 사람의 다른 세션 |
| v1.2.3-test_normal_external_testerH.csv | 10 | 보통 난이도. 맥 크롬, EFFECTS OFF로 플레이 |
| v1.2.3-test_mixed_external_testerI.csv | 22 | 보통 16판 + 어려움 6판 |
| v1.2.4-test_normal_external_testerJ.csv | 18 | 보통 난이도. 기기 열 포함 |

- 모든 CSV는 게임이 내보낸 그대로이며, 보호막은 쓰지 않도록 안내했기 때문에 사용 기록이 없습니다(전부 "미사용").
- 모집 경로가 한정된 소수의 사람이라 평균이나 비율로 일반화하지 않습니다. 관찰 내용은 루트 [README](../README.md)의 "처음 해 본 사람들의 반응"에 정리했습니다.
- 위험 모드(RISK)의 옛 이름이 CSV 열 이름에 남아 있어 `전쟁중획득수`, `전쟁모드평균FPS` 등으로 표기됩니다.
- 보유 코인과 개인 최고 점수는 테스터의 브라우저에 누적된 값이라 판마다 이어집니다.
- v1.2.4-test부터 CSV에 `device_pixel_ratio`, `canvas_css_size`, `hardware_concurrency`, `effects_enabled`, `display_hz` 열이 추가됩니다. 이 폴더의 외부 CSV 중에서는 J의 CSV에만 있습니다.
- 낮은 FPS(약 25~36)가 나온 기록은 H의 CSV입니다. 기기 요인이 섞여 있을 수 있어 점수 해석에 주의가 필요합니다.
