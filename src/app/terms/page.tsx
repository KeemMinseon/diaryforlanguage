"use client";

import { useRouter } from "next/navigation";
import UiIcon from "@/components/icons/UiIcon";

const EFFECTIVE_DATE = "2026년 9월 18일";
const CONTACT_EMAIL = "minseonkeem@gmail.com";

export default function TermsPage() {
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
          이용약관
        </h1>
        <p className="text-xs text-[var(--ink-soft)]">시행일자: {EFFECTIVE_DATE}</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--ink)]">
        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제1조 (목적)</h2>
          <p>
            이 약관은 우표일기(이하 &ldquo;서비스&rdquo;)의 이용조건 및 절차, 이용자와 서비스
            운영자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제2조 (서비스의 내용)</h2>
          <p>서비스는 다음과 같은 기능을 제공합니다.</p>
          <ul className="list-disc pl-5 [&>li]:mt-1">
            <li>학습 언어(현재 일본어)로 일기를 작성하고 저장하는 기능</li>
            <li>작성한 일기를 외부 AI(Anthropic)를 통해 첨삭·번역·읽는 법을 제공받는 기능</li>
            <li>일기 작성에 따라 &ldquo;우표&rdquo;를 모으고, 학습한 단어를 복습하는 기능</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제3조 (회원가입 및 계정)</h2>
          <p>
            이용자는 이메일 주소로 발급받은 인증 코드를 통해 회원가입 및 로그인합니다. 이용자는
            본인의 이메일 계정을 안전하게 관리할 책임이 있으며, 제3자가 무단으로 이용함으로써
            발생하는 손해에 대해 서비스는 책임지지 않습니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제4조 (게시물의 저작권)</h2>
          <p>
            이용자가 작성한 일기, 업로드한 사진의 저작권은 이용자 본인에게 있습니다. 서비스는 첨삭
            결과 생성 등 서비스 제공 목적 범위 내에서만 이를 처리하며, 이용자의 동의 없이 다른
            목적으로 이용하지 않습니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제5조 (AI 첨삭 결과에 관한 유의사항)</h2>
          <p>
            첨삭·번역·읽는 법 등은 외부 AI 모델이 자동으로 생성한 결과로, 항상 정확하거나
            완전하다고 보장되지 않습니다. 어학 학습의 참고 자료로 활용해 주시기 바라며, 중요한
            의사결정이나 공식적인 언어 검증이 필요한 경우 별도의 확인을 거치시기 바랍니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제6조 (이용자의 의무)</h2>
          <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc pl-5 [&>li]:mt-1">
            <li>타인의 이메일 계정을 도용하는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>법령 또는 공서양속에 반하는 내용을 게시하는 행위</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제7조 (서비스의 변경, 중단)</h2>
          <p>
            서비스는 운영상·기술상 필요에 따라 제공하는 기능의 전부 또는 일부를 변경하거나
            중단할 수 있으며, 중요한 변경 사항은 서비스 내 공지를 통해 안내합니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제8조 (계약 해지)</h2>
          <p>
            이용자는 설정 화면의 &ldquo;회원 탈퇴&rdquo;를 통해 언제든지 자유롭게 이용계약을
            해지할 수 있습니다. 탈퇴 시 처리되는 개인정보의 범위는 개인정보처리방침을 따릅니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제9조 (면책조항)</h2>
          <p>
            서비스는 천재지변, 외부 인프라(Supabase, Anthropic 등) 장애 등 서비스 운영자가 통제할
            수 없는 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-bold text-[var(--ink)]">제10조 (문의처)</h2>
          <p>
            이 약관에 관한 문의는 아래 이메일로 연락해 주세요.
            <br />
            이메일: <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
