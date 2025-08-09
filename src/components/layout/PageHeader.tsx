import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode; // actions
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold">
          <span className="bg-gradient-primary bg-clip-text text-transparent">{title}</span>
        </h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </header>
  );
}
