import { Card, Typography } from 'antd';

const { Text } = Typography;

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
}

export function StatCard({ label, value, change }: StatCardProps) {
  return (
    <Card className="flex flex-col justify-between overflow-hidden relative border border-slate-200 dark:border-[#303030] bg-white dark:bg-[#141414] shadow-sm hover:shadow-md transition-all duration-300">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <div className="h-12 w-12 rounded-full bg-[#10b981]" />
      </div>

      <div className="space-y-1 relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 m-0">{label}</p>
        <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight truncate m-0">{value}</p>
      </div>

      {change ? (
        <div className="mt-3 flex items-center gap-1.5 relative z-10">
          <span className="inline-flex items-center rounded-full bg-[#10b981]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#10b981]">
            {change}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
