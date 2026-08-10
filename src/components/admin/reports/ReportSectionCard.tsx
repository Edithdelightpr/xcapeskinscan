import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  title: string;
  subtitle?: string;
  isEmpty?: boolean;
  children: ReactNode;
  action?: ReactNode;
}

export const ReportSectionCard = ({ title, subtitle, isEmpty, children, action }: Props) => (
  <Card className="break-inside-avoid">
    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
      <div>
        <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </CardHeader>
    <CardContent className="pt-0">
      {isEmpty ? (
        <p className="text-sm text-muted-foreground italic py-4">
          No activity recorded in this time period.
        </p>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);