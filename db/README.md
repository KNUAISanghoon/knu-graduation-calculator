# KNU Course Database

경북대학교 전자공학부 인공지능전공 졸업학점 계산기를 위한 강의 DB 초안입니다.

## 구조

- `courses`: 졸업요건 계산에 쓰는 과목 단위 테이블입니다. 분반은 합쳐서 한 과목으로 저장합니다.
- `course_offerings`: 연도, 학기, 분반별 개설 이력입니다. 같은 과목의 여러 분반은 여기에만 남습니다.
- `major_required_courses`: 입학년도별 전자공학부 인공지능전공 전공필수 기준표입니다.
- `import_runs`: 추후 크롤링 실행 이력을 남기기 위한 테이블입니다.

## 초기화

```bash
python3 db/scripts/create_db.py
```

기본 DB 경로는 `db/courses.db`입니다.

## 전공필수 우선순위

확인된 전공필수 과목은 `db/data/ai_major_required_courses.csv`에 넣습니다.

```csv
admission_year,major_name,course_code,course_name,note
2023,전자공학부 인공지능전공,COURSE001,예시과목명,확인 후 실제 코드로 교체
```

이 CSV에 있는 `course_code`와 일치하는 강의는 import 시:

- `is_major_required = 1`
- `is_major = 1`
- `sort_priority = 0`

으로 들어갑니다. 그래서 조회할 때 `ORDER BY sort_priority, course_name`을 쓰면 전공필수가 맨 위에 옵니다.

## CSV/JSON import

```bash
python3 db/scripts/import_courses.py path/to/courses.csv
python3 db/scripts/import_courses.py path/to/courses.json --source knu.sy
```

지원하는 대표 컬럼명:

- 강좌명: `course_name`, `name`, `subject_name`, `교과목명`, `과목명`, `강좌명`
- 강좌과목코드: `course_code`, `code`, `subject_code`, `교과목번호`, `교과목코드`, `과목코드`
- 학점: `credits`, `credit`, `학점`
- 연도: `year`, `년도`, `개설년도`, `학년도`
- 학기: `semester`, `term`, `학기`, `개설학기`
- 이수구분: `class_type`, `category`, `이수구분`, `교과구분`, `영역`
- 교양영역: `liberal_category`, `첨성인영역`, `교양영역`
- SDG 여부: `is_sdg`, `sdg`, `SDG`

분반 코드는 `CLTR001-003`처럼 끝에 `-숫자`가 붙은 경우 `CLTR001`로 합쳐집니다.

## KNUIN 크롤링

강의계획서 조회 후보 페이지:

```text
https://knuin.knu.ac.kr/public/stddm/lectPlnInqr.knu
```

현재 확인된 점:

- WebSquare 진입점은 `https://knuin.knu.ac.kr/websquare/websquare.html`입니다.
- KNUIN AJAX는 `Content-Type: application/json` POST 요청을 사용합니다.
- 요청 바디는 보통 `{"search": {...}}` 형태입니다.
- 학기 코드는 `CMBS001400001`, `CMBS001400002`, `CMBS001400003`, `CMBS001400004` 형식입니다.
- 이 환경에서 위 `.knu` 화면을 직접 호출하면 서버가 WebSquare view를 못 찾아 HTTP 500을 반환했습니다.
- `/stddm/lectPlnInqr/...` 계열은 JSON 401을 반환해 컨트롤러 존재 가능성은 보였지만, 실제 공개 목록 API는 아직 브라우저 Network 탭에서 최종 확인이 필요합니다.

실제 API 엔드포인트를 확인하면 아래처럼 KNUIN POST JSON 방식으로 수집합니다.

```bash
python3 db/scripts/crawl_knu.py \
  --knuin-endpoint '/public/web/stddm/lsspr/syllabus/lectPlnInqr/selectListLectPlnInqr'
```

엔드포인트가 일반 GET JSON이면 URL 템플릿 방식도 사용할 수 있습니다.

```bash
python3 db/scripts/crawl_knu.py \
  --url-template 'https://example.knu/api/courses?year={year}&semester={semester}&keyword={keyword}'
```

기본 수집 연도는 2023-2026이고, 학기는 위 KNUIN 학기 코드 4개입니다. 실제 파라미터명이 다르면 `crawl_knu.py`의 `payload["search"]` 키만 맞추면 됩니다.

## 졸업요건 계산용 기본 조회

```sql
SELECT
  course_code,
  course_name,
  credits,
  is_major,
  is_liberal_arts,
  is_major_required,
  is_general_elective,
  liberal_category,
  is_sdg
FROM courses
ORDER BY sort_priority, course_name;
```

## 웹사이트용 JSON export

웹 프론트에서 바로 쓰기 위한 경량 JSON은 아래 명령으로 생성합니다.

```bash
python3 db/scripts/export_courses_json.py
```

생성 파일:

```text
db/data/courses.json
```

이 JSON은 분반별 원본 `raw_json`을 제외하고, 과목 단위로 병합된 데이터만 담습니다.

주요 구조:

```json
{
  "metadata": {
    "courseCount": 10782,
    "offeringCount": 46351
  },
  "courses": [
    {
      "code": "CLTR0090",
      "name": "현대사회와법",
      "credits": 3,
      "flags": {
        "major": false,
        "liberalArts": true,
        "majorRequired": false,
        "generalElective": false,
        "sdg": false
      },
      "liberalCategory": null,
      "offeredYears": [2023, 2024, 2025, 2026],
      "offeredSemesters": ["CMBS001400001"],
      "classTypes": ["교양"],
      "departments": ["대학"]
    }
  ]
}
```

## 현재 적재 상태

2026-06-21 기준 KNUIN 강의계획서 조회 API로 2023-2026학년도 데이터를 적재했습니다.

- `courses`: 10,782개 과목
- `course_offerings`: 46,351개 개설 이력
- 연도별 개설 이력:
  - 2023: 11,376
  - 2024: 11,452
  - 2025: 11,686
  - 2026: 11,837

주의할 점:

- `is_major_required`는 현재 KNUIN의 과목별 이수구분이 `전공필수`인 경우를 표시합니다.
- 전자공학부 인공지능전공의 입학년도별 전공필수 기준은 `db/data/ai_major_required_courses.csv`에 별도로 채워야 합니다.
- KNUIN 전체 조회 응답에는 SDG 여부와 첨성인 세부영역이 항상 포함되지 않아, 해당 필드는 추가 API/필터 응답으로 보강이 필요할 수 있습니다.
