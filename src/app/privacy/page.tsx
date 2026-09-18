"use client";

import { useRouter } from "next/navigation";
import UiIcon from "@/components/icons/UiIcon";

const EFFECTIVE_DATE = "2026년 9월 18일";
const CONTACT_EMAIL = "minseonkeem@gmail.com";

/** Plain policy text, not a design system page — headings/paragraphs share
 * the app's own paper/ink tokens (so it still respects dark mode) but skip
 * every card/border treatment used elsewhere; this is meant to read like a
 * document, not another screen. */
export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
          ←
        </UiIcon>
        뒤로
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--ink)]">
          개인정보처리방침
        </h1>
        <p className="text-xs text-[var(--ink-soft)]">시행일자: {EFFECTIVE_DATE}</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--ink)]">
        <p>
          우표일기(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 소중히 다루며, 아래와 같이
          개인정보를 수집·이용·보관합니다. 서비스는 개인 개발자가 운영하는 학습용 다이어리
          서비스입니다.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">1. 수집하는 개인정보 항목</h2>
          <ul className="list-disc pl-5 [&>li]:mt-1">
            <li>
              <strong>이메일 주소</strong>: 회원가입 및 로그인(이메일 인증 코드 방식)에
              사용됩니다. 별도의 비밀번호는 수집하지 않습니다.
            </li>
            <li>
              <strong>이용자가 작성한 일기 내용</strong>: 제목, 본문, AI 첨삭 결과(총평, 고칠 곳,
              읽는 법)를 포함합니다. 서버에 저장될 때 암호화됩니다.
            </li>
            <li>
              <strong>이용자가 업로드한 사진</strong>: 일기에 &ldquo;사진 우표&rdquo;로 첨부한
              이미지입니다.
            </li>
            <li>
              <strong>학습 활동 기록</strong>: 모은 우표, 단어장(읽는 법 암기 여부, 단어 테스트
              정답 횟수) 등 서비스 이용 과정에서 생성되는 기록입니다.
            </li>
            <li>
              <strong>자동 수집 정보</strong>: 로그인 상태 유지를 위한 세션 쿠키가 사용됩니다.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">2. 개인정보의 수집 및 이용 목적</h2>
          <ul className="list-disc pl-5 [&>li]:mt-1">
            <li>회원 식별 및 로그인 인증</li>
            <li>일기 작성, 저장, 열람 등 서비스의 핵심 기능 제공</li>
            <li>AI(외부 언어모델)를 통한 일기 첨삭·번역·읽는 법 제공</li>
            <li>우표 수집, 단어장 등 학습 동기부여 기능 제공</li>
            <li>서비스 문의 응대</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">3. 개인정보의 보유 및 이용 기간</h2>
          <p>
            원칙적으로 회원 탈퇴 시까지 보유하며, 탈퇴 시 아래 5항의 절차에 따라 지체 없이
            파기합니다. 관계 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관할
            수 있습니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">4. 개인정보의 제3자 제공 및 처리위탁</h2>
          <p>
            서비스는 별도의 서버를 직접 운영하지 않고, 아래 해외 사업자의 인프라를 이용해 개인정보를
            처리합니다. 이는 제3자 제공이 아닌 처리위탁이며, 각 사업자는 자체 보안 정책에 따라
            데이터를 보호합니다.
          </p>
          <ul className="list-disc pl-5 [&>li]:mt-1">
            <li>
              <strong>Supabase, Inc.</strong> (미국) — 회원 인증, 데이터베이스, 사진 저장소 등 서비스
              전반의 인프라
            </li>
            <li>
              <strong>Anthropic, PBC</strong> (미국) — 이용자가 작성한 일기 본문을 전달받아 AI
              첨삭·번역·읽는 법을 생성. 첨삭 목적으로만 사용되며, 모델 학습에 사용되지 않습니다
              (Anthropic API 이용약관 기준).
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">5. 정보주체의 권리와 회원 탈퇴</h2>
          <p>
            이용자는 언제든지 설정 화면의 &ldquo;회원 탈퇴&rdquo;를 통해 본인의 계정과 아래 모든
            데이터를 즉시, 영구적으로 삭제할 수 있습니다. 탈퇴한 데이터는 복구되지 않습니다.
          </p>
          <ul className="list-disc pl-5 [&>li]:mt-1">
            <li>작성한 모든 일기(암호화된 본문·첨삭 결과 포함)</li>
            <li>업로드한 모든 사진</li>
            <li>모은 우표, 단어장 등 학습 기록</li>
            <li>계정 정보(이메일)</li>
          </ul>
          <p>
            개별 일기만 삭제하고 싶은 경우 일기 상세 화면에서 해당 일기만 따로 삭제할 수도
            있습니다. 그 밖에 개인정보 열람·정정 등을 원하시면 아래 연락처로 문의해 주세요.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">6. 개인정보의 안전성 확보조치</h2>
          <ul className="list-disc pl-5 [&>li]:mt-1">
            <li>일기 본문·제목·첨삭 결과는 AES-256-GCM 방식으로 암호화되어 저장됩니다.</li>
            <li>
              데이터베이스는 행 단위 접근 제어(Row Level Security)가 적용되어, 본인 소유의 데이터만
              조회·수정·삭제할 수 있습니다.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">7. 개인정보 보호책임자 및 문의처</h2>
          <p>
            개인정보 처리에 관한 문의, 열람·정정·삭제 요청은 아래 이메일로 연락해 주세요.
            <br />
            이메일: <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">8. 만 14세 미만 아동의 개인정보</h2>
          <p>
            서비스는 만 14세 이상만 이용할 수 있으며, 만 14세 미만 아동의 개인정보는 수집하지
            않습니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">9. 고지의 의무</h2>
          <p>
            이 방침은 법령, 정책 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시 서비스 내
            공지를 통해 알립니다.
          </p>
        </section>
      </div>
    </div>
  );
}
