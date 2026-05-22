interface AppLoadingProps {
  fullScreen?: boolean;
  overlay?: boolean;
  title?: string;
  subtitle?: string;
}

const AppLoading = ({
  fullScreen = false,
  overlay = false,
  title = 'Dang tai du lieu',
  subtitle = 'Vui long cho trong giay lat...'
}: AppLoadingProps) => {
  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 backdrop-blur-[1.5px] px-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-end gap-2">
          <span className="h-3 w-3 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
          <span className="h-3 w-3 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
          <span className="h-3 w-3 rounded-full bg-white animate-bounce" />
        </div>
      </div>
    );
  }

  if (overlay) {
    return (
      <div
        className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-white/60 backdrop-blur-[1px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-end gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-700 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-3 w-3 rounded-full bg-slate-700 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-3 w-3 rounded-full bg-slate-700 animate-bounce" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center py-12 px-4" role="status" aria-live="polite" aria-busy="true">
      <div className="w-full max-w-sm rounded-2xl bg-white/95 shadow-lg ring-1 ring-slate-200 p-6 text-center backdrop-blur">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-sky-400" />
        </div>
      </div>
    </div>
  );
};

export default AppLoading;
