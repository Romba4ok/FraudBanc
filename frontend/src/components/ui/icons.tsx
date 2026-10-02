import type { ReactNode, SVGProps } from "react";
import type { DashboardRouteId } from "../../types/dashboard";

type IconProps = SVGProps<SVGSVGElement>;

const paths: Record<DashboardRouteId, ReactNode> = {
  "new-analysis": <><path d="M12 5v14M5 12h14" /></>,
  overview: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  "risk-records": <><path d="M8 3h8l4 4v14H4V3h4Z" /><path d="M14 3v5h6M8 13h8M8 17h5" /></>,
  transactions: <><path d="m7 7 3-3 3 3M10 4v10M17 17l-3 3-3-3M14 20V10" /></>,
  relationships: <><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="6" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="m7.4 11 9-4M7.4 13l9 4" /></>,
  "model-quality": <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" /></>,
  "data-quality": <><path d="M4 6c0-2 3.6-3.5 8-3.5S20 4 20 6s-3.6 3.5-8 3.5S4 8 4 6Z" /><path d="M4 6v6c0 2 3.6 3.5 8 3.5M20 6v5M4 12v6c0 2 3.6 3.5 8 3.5 1.2 0 2.4-.1 3.4-.4" /><path d="m17 17 2 2 4-5" /></>,
};

export function RouteIcon({ route, ...props }: IconProps & { route: DashboardRouteId }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[route]}
    </svg>
  );
}

export function BrandIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 32 32" {...props}>
      <path d="M4 25V13l8-6 6 4 10-7v21H4Z" fill="currentColor" opacity=".2" />
      <path d="M5 25V14l7-5 6 4 9-6v18M4 25h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 25v-7M16 25v-9M22 25V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...props}>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function EmptyStateIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16v12H4zM8 7V5h8v2" />
      <path d="M8 12h8M8 15h5" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M5 14v5h14v-5" />
    </svg>
  );
}

export function FileSearchIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 3h9l5 5v4M14 3v5h5" />
      <path d="M5 3v18h7" />
      <circle cx="16" cy="17" r="3" />
      <path d="m18.3 19.3 2.2 2.2" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17.5h.01" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function TrendArrowIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 16 16 6M9 6h7v7" />
    </svg>
  );
}
