import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
}

export function StatCard({ title, value, subtitle, icon, trend, trendType = 'neutral' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`font-semibold ${
                trendType === 'up'
                  ? 'text-emerald-600'
                  : trendType === 'down'
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {trend}
            </span>
          )}
          {subtitle && <span className="text-slate-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
