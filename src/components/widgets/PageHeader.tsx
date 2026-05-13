import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 py-2 sm:flex-row sm:items-end">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-ink md:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="text-sm font-medium leading-normal text-ink-muted sm:leading-none">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 pb-2 sm:w-auto sm:justify-end sm:pb-0 [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
