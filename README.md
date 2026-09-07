# 우표일기 (diaryforlanguage)

일본어로 하루를 짧게 적으면:

1. 사진을 첨부하면 **우표 프레임**으로 크롭(확대/이동)해서 붙이고, 사진이 없으면 일기 내용의 키워드를 읽어 **손그림풍 우표**를 자동으로 골라 붙입니다.
2. 저장 즉시 캘린더로 돌아가고, 그 날짜엔 우표만 붙은 상태로 보입니다.
3. 백그라운드에서 Claude가 어휘/표현을 添削(첨삭)하고, 끝나면 그 우표 위에 빨간 **添削済 도장**이 찍히며 토스트 알림이 뜹니다.
4. 添削이 끝난 날짜를 다시 열면, 일기 원문 + 전체 총평 + 단어별 제안이 한 화면에 보입니다. 원문에서 밑줄 친 단어를 누르면 해당 제안이 강조됩니다.

## 스택

- **Next.js (App Router, TypeScript)** — UI, 라우팅, 서버리스 API 라우트
- **Supabase** — Auth(이메일 매직링크), Postgres(일기 데이터), Storage(첨부 사진)
- **Anthropic (Claude)** — `/api/review` 서버리스 함수 뒤에서만 호출 (API 키는 서버 환경변수로만 존재, 브라우저에 노출되지 않음)
- **Vercel** — 배포 대상

## 로컬 설정

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run dev
```

### Supabase 설정

1. Supabase 프로젝트를 하나 만듭니다.
2. SQL 편집기에서 [`supabase/schema.sql`](./supabase/schema.sql)을 실행합니다.
   - `diary_entries` 테이블 + RLS 정책
   - `diary-photos` 스토리지 버킷 + 사용자별 폴더 정책 (`{user_id}/{entry_date}.jpg`)
3. Authentication → Providers에서 Email(매직 링크)이 켜져 있는지 확인합니다.
4. (선택) Database → Replication에서 `diary_entries`에 Realtime을 켜면, 캘린더 화면의 폴링 대신 더 즉각적인 업데이트로 바꿔볼 수 있습니다. 지금 구현은 폴링(대기 중인 일기가 있을 때만 8초 간격)만으로 동작하므로 필수는 아닙니다.
5. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 채웁니다 (Project Settings → API).

### Anthropic 설정

- `ANTHROPIC_API_KEY`를 발급받아 `.env.local`에 채웁니다.
- 모델은 `ANTHROPIC_REVIEW_MODEL`로 바꿀 수 있고, 기본값은 `claude-sonnet-5`입니다.
- 이 키는 `/api/review` 라우트 핸들러(서버) 안에서만 쓰입니다 — 클라이언트 번들에는 절대 포함되지 않습니다.

## 폴더 구조

```
src/
  app/
    page.tsx                 # 캘린더 (이번 달)
    login/                   # 이메일 매직링크 로그인
    auth/callback, signout   # Supabase auth 라우트
    entry/[date]/page.tsx    # 없으면 편집기, 있으면 리뷰 화면
    api/review/route.ts      # Claude 添削 처리 (서버 전용)
  components/
    calendar/                # 월 그리드, 날짜 셀
    editor/                  # 텍스트 영역 + 사진 첨부 + 크롭 모달
    stamps/                  # 우표 프레임, 손그림 아이콘, 添削 도장(hanko)
    review/                  # 리뷰 화면 (원문 + 총평 + 단어별 제안)
    toast/                   # 添削 완료 토스트
  lib/
    stamps/keywordMap.ts     # 키워드 → 우표 매칭 규칙 (다국어 확장 지점)
    review/prompt.ts         # Claude 添削 프롬프트
    supabase/                # 브라우저/서버/미들웨어 클라이언트
supabase/schema.sql          # DB 스키마 + RLS + 스토리지 정책
```

## 디자인

Washi(和紙) 종이 질감의 크림색 배경, 朱色(vermilion) 포인트, 우표/도장 모티프를 기본 톤으로 잡았습니다. 우표는 실제 우표처럼 톱니 모양 테두리(SVG mask)를 가지며, 添削 완료 도장은 붉은 잉크 질감(SVG turbulence 필터)의 원형 낙관 스타일입니다. 컴포넌트 단위로 나뉘어 있어 Figma 목업이 생기면 `components/` 아래 값(색상, 크기, 텍스트)만 교체하면 됩니다.

## 확장 여지

- **다국어**: `src/lib/stamps/keywordMap.ts`의 `KEYWORD_RULES`에 로케일 키(`ko`, `en`, …)를 추가하고, 편집기/리뷰 프롬프트에서 로케일을 넘겨주면 됩니다. 우표/도장 UI는 언어에 의존하지 않습니다.
- **아이덴티티**: washi 페이퍼, 朱 레드, 우표 톤은 CSS 변수(`src/app/globals.css`)와 `STAMP_STYLE`(`src/lib/stamps/stampStyle.ts`)에 모여 있어 다른 언어/테마로 확장해도 톤을 유지하기 쉽습니다.

## 배포

Vercel에 저장소를 연결하고, 위 환경변수를 Vercel 프로젝트 설정에 동일하게 등록하면 됩니다. Supabase Auth의 이메일 리다이렉트 URL(`/auth/callback`)에 배포 도메인을 추가로 등록해야 합니다.
