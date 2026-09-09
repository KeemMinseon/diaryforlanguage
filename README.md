# 우표일기 (diaryforlanguage)

일본어로 하루를 문단 단위로 적으면:

1. 한 문단을 쓰고 "검토 요청"을 누르면, 그 문단에 대한 짧은 피드백(코멘트 + 단어 제안)이 바로 붙습니다. 이어서 다음 문단을 씁니다 — 실제로 Claude와 대화하며 일기를 쓰는 흐름에 가깝게 만들었습니다.
2. 그 사이 상단의 작은 우표는 지금까지 쓴 내용의 키워드에 맞춰 자동으로 바뀌고, 사진을 첨부하면 **우표 프레임**으로 크롭(확대/이동)해서 그 자리에 붙습니다.
3. "오늘 일기 마치기"를 누르면, 문단별 제안을 모으고 하루 전체에 대한 총평을 한 번 더 생성해서 저장합니다 — 이 시점에 우표 위로 빨간 **添削済 도장**이 찍히고 토스트 알림이 뜹니다.
4. 그 날짜를 다시 열면, 일기 원문 + 전체 총평 + 단어별 제안이 한 화면에 보입니다. 원문에서 밑줄 친 단어를 누르면 해당 제안이 강조됩니다. (주고받은 대화 자체가 아니라, 이렇게 정리된 결과만 남습니다.)
5. 내가 쓴 문장 자체에는 읽는 법을 바로 얹지 않습니다 — 대신 문단마다 코멘트 옆에 "읽는 법" 안내로 한자는 히라가나, 가타카나 단어는 로마자 표기를 따로 모아 보여줍니다. 일기 원문을 그대로 다시 읽을 수 있어야 학습이 되니까요. 문단을 보낼 때 添削과 같이 수집돼서, 나중에 다시 열어도 그대로 보입니다.
6. 이미 완성된 날짜는 리뷰 화면에서 **수정**(전체 내용을 다시 고쳐 쓰고 재검토·재저장) / **이어서 쓰기**(그날 이미 쓴 내용은 그대로 두고 새 문단을 더 추가) / **삭제**(사진까지 함께 정리) 할 수 있습니다. 이어서 쓴 문단은 저장된 시각과 함께 리뷰 화면에 구간별로 나뉘어 보입니다 — 하루에 여러 번 나눠 써도 그날의 일기는 하나입니다.

## 스택

- **Next.js (App Router, TypeScript)** — UI, 라우팅, 서버리스 API 라우트
- **Supabase** — Auth(이메일 매직링크), Postgres(일기 데이터), Storage(첨부 사진)
- **Anthropic (Claude)** — `/api/review-paragraph`, `/api/review-finalize` 서버리스 함수 뒤에서만 호출 (API 키는 서버 환경변수로만 존재, 브라우저에 노출되지 않음)
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
4. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 채웁니다 (Project Settings → API).

### Anthropic 설정

- `ANTHROPIC_API_KEY`를 발급받아 `.env.local`에 채웁니다.
- 모델은 `ANTHROPIC_REVIEW_MODEL`로 바꿀 수 있고, 기본값은 `claude-sonnet-5`입니다.
- 이 키는 `/api/review-paragraph`, `/api/review-finalize` 라우트 핸들러(서버) 안에서만 쓰입니다 — 클라이언트 번들에는 절대 포함되지 않습니다.
- 문단별 첨삭·최종 총평 모두 사용자가 그 화면에 머무는 동안 동기적으로 처리됩니다 — 별도의 백그라운드 작업이나 폴링은 없습니다.

### 암호화

일기의 내용을 담고 있는 필드는 Supabase에 평문으로 남기지 않고, 서버(Vercel의 API 라우트)만 아는 키로 암호화해서 저장합니다.

- **암호화 대상**: 일기 본문(`content`), 문단별/전체 添削 코멘트·교정 제안(`suggestions`, 문단마다의 `comment`), 총평(`overall_comment`).
- **평문 유지**: 우표 메타데이터(`stamp_kind`/`stamp_key`/`photo_path`/`stamps`), 단어장의 단어/읽는 법/뜻 자체(`readings`) — 이것만으로는 그날 일기에 뭐라고 썼는지 드러나지 않습니다.
- **키 관리**: `DIARY_ENCRYPTION_KEY` (서버 환경변수, `openssl rand -base64 32`로 생성) 하나로 AES-256-GCM 암호화/복호화. 학습자 본인만 아는 별도 비밀번호는 없습니다 — "DB를 직접 열어봐도/백업이 유출돼도 평문이 안 보이게" 하는 것이 목적이고, 서버(이 앱의 API 라우트) 자체는 항상 복호화할 수 있습니다. 첨삭을 위해 Claude에게 평문을 보내야 하는 경로도 어차피 있어서, "서버조차 못 읽는" 종단간 암호화는 이 앱의 목표가 아닙니다.
- **적용 범위**: 이 기능이 배포된 이후의 모든 저장(`saveEntry`)부터 암호화됩니다 — 새 일기든, 예전에 평문으로 저장된 날짜를 다시 열어 이어쓰거나 수정한 경우든 그 저장 시점부터. 기존에 이미 평문으로 저장된 내용을 한 번에 다시 암호화하는 마이그레이션은 하지 않습니다 (한 번도 다시 저장되지 않은 옛날 일기는 계속 평문으로 남습니다).
- 구현: `src/lib/crypto/serverEncryption.ts`(원시 암복호화), `src/lib/crypto/entryFields.ts`(어떤 필드를 건드리는지), `/api/diary/encrypt-fields`·`/api/diary/decrypt-fields`(브라우저가 Supabase에 쓰기/읽기 전후로 호출) — `entry/[date]/page.tsx`는 이미 서버에서 실행되므로 이 라우트를 거치지 않고 `decryptEntryFields`를 바로 호출합니다.

## 폴더 구조

```
src/
  app/
    page.tsx                        # 캘린더 (이번 달)
    login/                          # 이메일 매직링크 로그인
    auth/callback, signout          # Supabase auth 라우트
    entry/[date]/page.tsx           # 없으면 편집기, 있으면 리뷰 화면
    api/review-paragraph/route.ts   # 문단 하나에 대한 즉시 첨삭 (서버 전용)
    api/review-finalize/route.ts    # 하루 전체 총평 생성 (서버 전용)
  components/
    calendar/                # 월 그리드, 날짜 셀 (직사각형 우표 칸)
    editor/                  # ChatEditor: 문단 전송 → 피드백 → 다음 문단, 사진 첨부/크롭
    stamps/                  # 우표 프레임, 손그림 아이콘, 添削 도장(hanko)
    review/                  # 리뷰 화면 (원문 + 총평 + 단어별 제안)
    toast/                   # 添削 완료 토스트
  lib/
    stamps/keywordMap.ts     # 키워드 → 우표 매칭 규칙 (다국어 확장 지점)
    review/paragraphPrompt.ts # 문단별 첨삭 + 최종 총평 프롬프트
    supabase/                # 브라우저/서버/미들웨어 클라이언트
supabase/schema.sql          # DB 스키마 + RLS + 스토리지 정책
```

## 디자인

무채색 그레이 톤(배경·테두리·본문 전부 회색/흰색 계열)에, 포인트 컬러(朱 vermilion 계열)는 添削 완료 도장 — 그리고 원문에서 고친 단어를 가리킬 때만 씁니다. 우표는 실제 우표처럼 톱니 모양 테두리(SVG mask)를 가진 세로로 긴 직사각형이고, 添削 완료 도장은 붉은 잉크 질감(SVG turbulence 필터)의 원형 낙관 스타일입니다. 컴포넌트 단위로 나뉘어 있어 값(색상, 크기, 텍스트)만 바꿔 다른 톤으로도 쉽게 확장할 수 있습니다.

## 확장 여지

- **다국어**: `src/lib/stamps/keywordMap.ts`의 `KEYWORD_RULES`에 로케일 키(`ko`, `en`, …)를 추가하고, 편집기/리뷰 프롬프트에서 로케일을 넘겨주면 됩니다. 우표/도장 UI는 언어에 의존하지 않습니다.
- **아이덴티티**: 배경·테두리·잉크 톤은 CSS 변수(`src/app/globals.css`)와 `STAMP_STYLE`(`src/lib/stamps/stampStyle.ts`)에 모여 있어 다른 팔레트로 확장해도 톤을 유지하기 쉽습니다.
- **키워드 아이콘 직접 교체**: Supabase Storage의 `stamp-icons` 버킷(public)에 `<키워드 id>.png`(또는 `.jpg`/`.jpeg`/`.webp`) 파일을 올리면, 코드 배포 없이 해당 키워드의 손그림 아이콘이 그 이미지로 바로 바뀝니다 (`src/components/stamps/KeywordIcon.tsx`). 키워드 id 목록은 `src/lib/stamps/keywordMap.ts`의 `STAMP_IDS`.

## 배포

Vercel에 저장소를 연결하고, 위 환경변수를 Vercel 프로젝트 설정에 동일하게 등록하면 됩니다. Supabase Auth의 이메일 리다이렉트 URL(`/auth/callback`)에 배포 도메인을 추가로 등록해야 합니다.
