import { Toaster as Sonner } from "sonner"
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"

export function Toaster(props) {
  return (
    <Sonner
      className="pointer-events-auto"
      style={{ '--width': 'calc(100vw - 2rem)' }}
      position="top-center"
      expand
      offset={{ top: '2.5rem' }}
      mobileOffset={{ top: '5rem' }}
      closeButton
      icons={{
        success: <CheckCircle2 strokeWidth={1.5} size={18} className="text-success" />,
        error: <AlertCircle strokeWidth={1.5} size={18} className="text-danger" />,
        warning: <AlertTriangle strokeWidth={1.5} size={18} className="text-warning" />,
        info: <Info strokeWidth={1.5} size={18} className="text-brand" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex !w-max !max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-floating max-[600px]:-translate-x-2',
          content: 'min-w-0 flex-auto overflow-hidden',
          title: 'block min-w-0 text-sm font-semibold text-ink',
          actionButton: 'self-center !bg-transparent !p-0 shrink-0 whitespace-nowrap text-sm font-bold !text-brand hover:underline',
          closeButton: 'order-last shrink-0 self-center !border-line !bg-surface text-ink-3 hover:!bg-raised hover:!text-ink',
          icon: 'shrink-0',
        },
      }}
      {...props}
    />
  );
}
