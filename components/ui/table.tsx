import React from "react";
import { Button } from "@/components/ui/button";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className={`bg-transparent md:bg-surface md:rounded-lg md:border md:border-divider overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="block md:table w-full text-left text-sm whitespace-nowrap">
          {children}
        </table>
      </div>
    </div>
  );
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHeader({ children, className = "" }: TableHeaderProps) {
  return (
    <thead className={`hidden md:table-header-group bg-muted text-muted-foreground border-b border-divider font-semibold text-xs uppercase tracking-wider ${className}`}>
      {children}
    </thead>
  );
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHead({ children, className = "" }: TableHeadProps) {
  return (
    <th className={`px-6 py-3.5 ${className}`}>
      {children}
    </th>
  );
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function TableBody({ children, className = "" }: TableBodyProps) {
  return (
    <tbody className={`block md:table-row-group divide-y-0 md:divide-y divide-divider p-4 md:p-0 space-y-4 md:space-y-0 ${className}`}>
      {children}
    </tbody>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

export function TableRow({ children, className = "" }: TableRowProps) {
  return (
    <tr className={`block md:table-row bg-surface border border-divider md:border-0 rounded-lg p-4 md:p-0 md:hover:bg-surface-alt/70 transition-colors ${className}`}>
      {children}
    </tr>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  mobileLabel?: string;
  isHeaderCell?: boolean;
  hideBorderMobile?: boolean;
  noWrapper?: boolean;
}

export function TableCell({
  children,
  className = "",
  mobileLabel,
  isHeaderCell = false,
  hideBorderMobile = false,
  noWrapper = false,
}: TableCellProps) {
  const borderClass = hideBorderMobile ? "" : "border-b border-divider md:border-b-0";

  if (isHeaderCell) {
    return (
      <td className={`block md:table-cell py-2 md:py-4 md:px-6 ${borderClass} ${className}`}>
        {children}
      </td>
    );
  }

  return (
    <td className={`block md:table-cell py-2.5 md:py-4 md:px-6 ${borderClass} flex justify-between md:justify-start items-center gap-2 ${className}`}>
      {mobileLabel && (
        <span className="md:hidden text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
          {mobileLabel}
        </span>
      )}
      {noWrapper ? (
        children
      ) : (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </td>
  );
}

interface TablePaginationProps {
  totalItems: number;
  currentItemsCount: number;
  onNext?: () => void;
  onPrevious?: () => void;
  disableNext?: boolean;
  disablePrevious?: boolean;
  className?: string;
}

export function TablePagination({
  totalItems,
  currentItemsCount,
  onNext,
  onPrevious,
  disableNext = true,
  disablePrevious = true,
  className = "",
}: TablePaginationProps) {
  return (
    <div className={`p-4 bg-surface border border-divider rounded-lg md:rounded-none md:border-0 md:border-t md:border-divider md:bg-muted flex items-center justify-between text-xs text-muted-foreground mt-4 md:mt-0 mx-4 md:mx-0 ${className}`}>
      <div>
        Exibindo {currentItemsCount} de {totalItems} itens
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={disablePrevious}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={disableNext}>
          Próximo
        </Button>
      </div>
    </div>
  );
}
