import { LinkButton, Page } from '@/components/ui';

export default function OfflinePage() {
  return (
    <Page>
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-bold">오프라인 상태입니다</h1>
        <p className="text-sm text-muted">저장된 계획은 홈에서 계속 볼 수 있습니다. 새 계획 생성은 네트워크가 필요합니다.</p>
        <LinkButton href="/" variant="secondary">
          홈으로
        </LinkButton>
      </div>
    </Page>
  );
}
